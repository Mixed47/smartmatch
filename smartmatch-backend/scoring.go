package main

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"unicode"
)

var letterGradePattern = regexp.MustCompile(`\b([SABCD])\b`)

var productionEvidenceKeywords = []string{
	"production",
	"deploy",
	"deployed",
	"deployment",
	"release",
	"released",
	"go-live",
	"golive",
	"app store",
	"play store",
	"freelance",
	"freelancing",
	"ลูกค้าจริง",
	"รับจ้าง",
	"ขึ้นระบบ",
	"ขึ้นเซิร์ฟเวอร์",
	"ขึ้นเซิฟเวอร์",
	"ขึ้น prod",
	"ขึ้น production",
	"เปิดใช้จริง",
	"งานจริง",
	"ขึ้นโปรดักชัน",
	"โปรดักชัน",
}

func hasProductionEvidence(tasks string) bool {
	normalized := strings.ToLower(strings.TrimSpace(tasks))
	if normalized == "" {
		return false
	}
	for _, keyword := range productionEvidenceKeywords {
		needle := strings.ToLower(keyword)
		if strings.Contains(needle, " ") || !isASCIIWord(needle) {
			if strings.Contains(normalized, needle) {
				return true
			}
			continue
		}
		pattern := regexp.MustCompile(`(^|[^a-z0-9])` + regexp.QuoteMeta(needle) + `([^a-z0-9]|$)`)
		if pattern.MatchString(normalized) {
			return true
		}
	}
	return false
}

func isASCIIWord(s string) bool {
	for _, r := range s {
		if r > unicode.MaxASCII || (!unicode.IsLetter(r) && r != '-') {
			return false
		}
	}
	return true
}

func logbookEvaluationPrompt(tasks, blocker string) string {
	blockerText := strings.TrimSpace(blocker)
	if blockerText == "" {
		blockerText = "(ไม่มีอุปสรรคที่ระบุ)"
	}

	return fmt.Sprintf(`คุณคืออาจารย์ที่ปรึกษาสหกิจศึกษา AI ของระบบ AI-InternMatch
จงประเมินบันทึกประจำวันจาก tasks และ blocker แล้วตอบเป็น JSON ล้วนเท่านั้น ห้ามมี markdown หรือข้อความนอก JSON

งานที่ทำ (tasks):
%s

ปัญหา/อุปสรรค (blocker):
%s

โครงสร้างบังคับ:
{"feedback":"คำแนะนำสั้นๆ ไม่เกิน 2 บรรทัด เป็นภาษาไทย","score":"A","is_critical":false}

กฎเกรด score ต้องเป็นหนึ่งใน S, A, B, C, D เท่านั้น:
- S: ให้ได้ก็ต่อเมื่อ tasks มีหลักฐานชัดเจนว่าเป็นงานระดับ Production, ขึ้นระบบจริง, deploy จริง, รับจ้างจริง, ขึ้นเซิร์ฟเวอร์, ลูกค้าจริง, freelance, app store หรือมีรายได้ ห้ามแจก S พร่ำเพรื่อ ถ้าไม่มี keyword/หลักฐานดังกล่าว ห้ามให้ S
- A: งานคุณภาพสูง มีรายละเอียดชัด แก้ปัญหาได้ดี แต่ยังไม่ถึงงาน production จริง
- B: ทำงานครบตามหน้าที่ รายละเอียดพอใช้
- C: งานบางส่วนหรือรายละเอียดบาง ต้องพัฒนาการจดบันทึก
- D: บันทึกคลุมเครือ น้อยเกินไป หรือแทบไม่สะท้อนงานที่ทำ

กฎ is_critical:
- true เฉพาะเมื่ออุปสรรคร้ายแรงและต้องการความช่วยเหลือจากอาจารย์ด่วน เช่น ความปลอดภัย การกลั่นแกล้ง ไม่มีงานทำ ปัญหาสุขภาพร้ายแรง หรือละเมิดจรรยาบรรณ
- ถ้าไม่มีอุปสรรค หรือเป็นปัญหาเล็กน้อย/เทคนิคทั่วไป ให้เป็น false`, strings.TrimSpace(tasks), blockerText)
}

func evaluateLogbookWithGemini(tasks, blocker string) (LogbookAIEvaluation, error) {
	raw, err := callGeminiJSON(logbookEvaluationPrompt(tasks, blocker))
	if err != nil {
		return LogbookAIEvaluation{}, err
	}
	evaluation, err := parseLogbookEvaluation(raw)
	if err != nil {
		return LogbookAIEvaluation{}, err
	}
	return enforceLogbookScoring(tasks, evaluation), nil
}

func parseLogbookEvaluation(raw string) (LogbookAIEvaluation, error) {
	clean := extractJSONObject(raw)
	if clean == "" {
		return LogbookAIEvaluation{}, fmt.Errorf("empty AI response")
	}

	var parsed struct {
		Feedback   string      `json:"feedback"`
		Score      interface{} `json:"score"`
		IsCritical interface{} `json:"is_critical"`
	}
	if err := json.Unmarshal([]byte(clean), &parsed); err != nil {
		return LogbookAIEvaluation{}, fmt.Errorf("invalid AI JSON: %w", err)
	}

	feedback := limitFeedbackLines(strings.TrimSpace(parsed.Feedback), 2)
	if feedback == "" {
		return LogbookAIEvaluation{}, fmt.Errorf("AI response missing feedback")
	}

	score := normalizeLetterGrade(parsed.Score)
	if score == "" {
		return LogbookAIEvaluation{}, fmt.Errorf("AI response missing score")
	}

	return LogbookAIEvaluation{
		Feedback:   feedback,
		Score:      score,
		IsCritical: parseIsCritical(parsed.IsCritical),
	}, nil
}

func enforceLogbookScoring(tasks string, evaluation LogbookAIEvaluation) LogbookAIEvaluation {
	evaluation.Score = normalizeLetterGrade(evaluation.Score)
	if evaluation.Score == "" {
		evaluation.Score = "B"
	}
	if evaluation.Score == "S" && !hasProductionEvidence(tasks) {
		evaluation.Score = "A"
	}
	evaluation.Feedback = limitFeedbackLines(evaluation.Feedback, 2)
	return evaluation
}

func normalizeLetterGrade(value interface{}) string {
	raw := strings.ToUpper(strings.TrimSpace(fmt.Sprint(value)))
	if raw == "" || raw == "<NIL>" {
		return ""
	}
	raw = strings.ReplaceAll(raw, "เกรด", " ")
	raw = strings.ReplaceAll(raw, "GRADE", " ")

	switch strings.TrimSpace(raw) {
	case "S", "A", "B", "C", "D":
		return strings.TrimSpace(raw)
	}

	if match := letterGradePattern.FindStringSubmatch(raw); len(match) == 2 {
		return match[1]
	}

	var letters []rune
	for _, r := range raw {
		if unicode.IsLetter(r) {
			letters = append(letters, unicode.ToUpper(r))
		}
	}
	if len(letters) == 1 {
		switch string(letters) {
		case "S", "A", "B", "C", "D":
			return string(letters)
		}
	}

	if n, ok := numericScore(raw); ok {
		switch {
		case n >= 9:
			return "A"
		case n >= 7:
			return "B"
		case n >= 5:
			return "C"
		default:
			return "D"
		}
	}
	return ""
}

func numericScore(raw string) (float64, bool) {
	var digits strings.Builder
	for _, r := range raw {
		if unicode.IsDigit(r) || r == '.' {
			digits.WriteRune(r)
			continue
		}
		if digits.Len() > 0 {
			break
		}
	}
	if digits.Len() == 0 {
		return 0, false
	}
	var n float64
	if _, err := fmt.Sscanf(digits.String(), "%f", &n); err != nil {
		return 0, false
	}
	return n, true
}

func limitFeedbackLines(text string, maxLines int) string {
	text = strings.TrimSpace(text)
	if text == "" || maxLines <= 0 {
		return text
	}
	parts := strings.Split(text, "\n")
	kept := make([]string, 0, maxLines)
	for _, part := range parts {
		line := strings.TrimSpace(part)
		if line == "" {
			continue
		}
		kept = append(kept, line)
		if len(kept) >= maxLines {
			break
		}
	}
	return strings.Join(kept, "\n")
}

func parseIsCritical(value interface{}) bool {
	switch v := value.(type) {
	case bool:
		return v
	case string:
		s := strings.ToLower(strings.TrimSpace(v))
		return s == "true" || s == "1" || s == "yes"
	case float64:
		return v != 0
	case json.Number:
		n, err := v.Float64()
		return err == nil && n != 0
	default:
		return false
	}
}
