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
	"prod",
	"deploy",
	"deployed",
	"deployment",
	"release",
	"released",
	"live",
	"go-live",
	"golive",
	"app store",
	"play store",
	"freelance",
	"freelancing",
	"commercial",
	"ลูกค้าจริง",
	"ลูกค้า",
	"รับจ้าง",
	"ขึ้นระบบ",
	"ขึ้นระบบจริง",
	"ระบบจริง",
	"ใช้งานจริง",
	"ใช้จริง",
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
		if needle == "prod" && strings.Contains(normalized, "product") && !strings.Contains(normalized, "production") && !strings.Contains(normalized, "prod ") && !strings.Contains(normalized, "ขึ้น prod") {
			continue
		}
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
{ "skills": [ {"name": "React", "grade": "S", "type": "Hard Skill", "source": "Resume"} ] }

กฎเกรดทักษะ (S, A, B, C, D) — ทำตามอย่างเคร่งครัด:
- S: หากพบหลักฐานที่ระบุถึงการใช้งานจริง, Production, Deploy, Freelance, รับจ้าง, ขึ้นระบบจริง, ใช้งานจริง, หรือมีลูกค้าจริง ต้องให้เกรด S เท่านั้น ห้ามให้ A
- A: โปรเจกต์คุณภาพสูง แต่ยังไม่มีหลักฐาน production/deploy/freelance/ลูกค้าจริง
- B: ใช้ในโปรเจกต์เรียนหรือฝึกงานพอสมควร
- C: ระบุทักษะได้ แต่หลักฐานยังบาง
- D: กล่าวถึงเพียงเล็กน้อย

ตัวอย่าง (few-shot) — ทำตามนี้:
1) ข้อความ "Deploy ขึ้นระบบจริง" หรือ "ขึ้น production ให้ลูกค้า" -> {"name":"React","grade":"S"}
2) ข้อความ "รับจ้าง freelance ทำเว็บให้ลูกค้าจริง" -> {"name":"Node.js","grade":"S"}
3) ข้อความ "ทำโปรเจกต์ในรายวิชา ยังไม่ขึ้นระบบจริง" -> {"name":"React","grade":"A"} หรือต่ำกว่า ห้ามเป็น S

ห้ามกดเพดานที่เกรด A เมื่อมีหลักฐาน production/freelance
ถ้ากรอกทักษะหลัก เช่น React ให้ขยายแท็กที่เกี่ยวข้องในรายการด้วย เช่น Frontend และ Web Development`, strings.TrimSpace(experience))
}

func enforceCandidateSkillGrades(skills []SkillItem, evidenceTexts ...string) []SkillItem {
	sharedEvidence := strings.Join(evidenceTexts, " ")
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
		combined := strings.Join([]string{sharedEvidence, skill.Name, skill.Source, skill.Type}, " ")
		if looksProductionLevel(combined) {
			grade = "S"
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
