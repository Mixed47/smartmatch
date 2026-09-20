package main

import (
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

func looksProductionLevel(text string) bool {
	normalized := strings.ToLower(strings.TrimSpace(text))
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

func candidateScoringPrompt(experience string) string {
	return fmt.Sprintf(`คุณคือ Senior Technical Recruiter AI ของระบบ AI-InternMatch
จงสกัดทักษะจากเรซูเม่/ทรานสคริปต์/ข้อความประสบการณ์ แล้วประเมินเกรดผู้สมัครเป็น JSON ล้วนเท่านั้น ห้ามมี markdown

ข้อความประสบการณ์เพิ่มเติม:
%s

โครงสร้างบังคับ:
{ "skills": [ {"name": "React", "grade": "C", "type": "Hard Skill", "source": "Resume"} ] }

กฎเกรดทักษะ (S, A, B, C, D):
- S: ให้ได้ก็ต่อเมื่อมีหลักฐานงานระดับ Production, ขึ้นระบบจริง, deploy จริง, freelance, app store, รับจ้างจริง, ลูกค้าจริง หรือมีรายได้ ห้ามแจก S พร่ำเพรื่อ
- A: ใช้จริงในโปรเจกต์คุณภาพสูง แต่ยังไม่ชัดว่าขึ้น production
- B: มีการใช้ในโปรเจกต์เรียน/ฝึกงานพอสมควร
- C: ระบุทักษะได้ แต่หลักฐานยังบาง
- D: กล่าวถึงเพียงเล็กน้อยหรือยังไม่ชัด

ถ้ากรอกทักษะหลัก เช่น React ให้ขยายแท็กที่เกี่ยวข้องในรายการด้วย เช่น Frontend และ Web Development`, strings.TrimSpace(experience))
}

func enforceCandidateSkillGrades(skills []SkillItem, evidenceTexts ...string) []SkillItem {
	evidence := strings.Join(evidenceTexts, " ")
	out := make([]SkillItem, 0, len(skills))
	for _, skill := range skills {
		skill.Name = strings.TrimSpace(skill.Name)
		if skill.Name == "" {
			continue
		}
		grade := normalizeLetterGrade(skill.Grade)
		if grade == "" {
			grade = "C"
		}
		combined := evidence + " " + skill.Name + " " + skill.Source + " " + skill.Type
		if grade == "S" && !looksProductionLevel(combined) {
			grade = "A"
		}
		skill.Grade = grade
		if strings.TrimSpace(skill.Type) == "" {
			skill.Type = "Hard Skill"
		}
		out = append(out, skill)
	}
	return out
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
	return ""
}
