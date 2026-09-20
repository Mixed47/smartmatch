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
	"go-live",
	"golive",
	"app store",
	"play store",
	"มีผู้ใช้งานจริง",
	"ผู้ใช้งานจริง",
	"ลูกค้าจริง",
	"ลูกค้า",
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
	"ขึ้นโปรดักชัน",
	"โปรดักชัน",
}

var freelanceKeywords = []string{
	"freelance",
	"freelancing",
	"รับจ้าง",
	"รับงานจริง",
	"รับงาน",
	"จ้างทำ",
}

var workExperienceKeywords = []string{
	"work experience",
	"working experience",
	"full-time",
	"full time",
	"part-time job",
	"internship",
	"intern at",
	"co-op",
	"ประสบการณ์ทำงานจริง",
	"ประสบการณ์ทำงาน",
	"ทำงานจริง",
	"พนักงาน",
	"ฝึกงานที่",
	"ฝึกงาน ณ",
	"บริษัท",
}

var seniorProjectKeywords = []string{
	"senior project",
	"thesis",
	"capstone",
	"graduation project",
	"โปรเจกต์จบ",
	"โปรเจคจบ",
	"โครงงานจบ",
	"โครงงานพิเศษ",
	"ปริญญานิพนธ์",
	"วิทยานิพนธ์",
}

var courseworkKeywords = []string{
	"coursework",
	"course project",
	"class project",
	"รายวิชา",
	"วิชาเรียน",
	"โปรเจกต์รายวิชา",
	"งานรายวิชา",
	"mini project",
	"laboratory",
}

var beginnerKeywords = []string{
	"beginner",
	"introductory",
	"currently learning",
	"เพิ่งเริ่ม",
	"กำลังศึกษา",
	"กำลังเรียน",
	"เบื้องต้น",
	"พื้นฐาน",
}

var skillTagGroups = []struct {
	match string
	tags  []string
}{
	{match: "react", tags: []string{"Frontend", "Web Development"}},
	{match: "next.js", tags: []string{"Frontend", "Web Development"}},
	{match: "nextjs", tags: []string{"Frontend", "Web Development"}},
	{match: "vue", tags: []string{"Frontend", "Web Development"}},
	{match: "angular", tags: []string{"Frontend", "Web Development"}},
	{match: "html", tags: []string{"Frontend", "Web Development"}},
	{match: "css", tags: []string{"Frontend", "Web Development"}},
	{match: "tailwind", tags: []string{"Frontend", "Web Development"}},
	{match: "javascript", tags: []string{"Frontend", "Web Development"}},
	{match: "typescript", tags: []string{"Frontend", "Web Development"}},
	{match: "go", tags: []string{"Backend"}},
	{match: "golang", tags: []string{"Backend"}},
	{match: "node", tags: []string{"Backend", "Web Development"}},
	{match: "express", tags: []string{"Backend", "Web Development"}},
	{match: "django", tags: []string{"Backend", "Web Development"}},
	{match: "flask", tags: []string{"Backend", "Web Development"}},
	{match: "spring", tags: []string{"Backend"}},
	{match: "java", tags: []string{"Backend"}},
	{match: "python", tags: []string{"Backend"}},
}

func looksProductionLevel(text string) bool {
	return containsAnyKeyword(text, productionEvidenceKeywords)
}

func looksFreelanceLevel(text string) bool {
	return containsAnyKeyword(text, freelanceKeywords)
}

func looksWorkExperienceLevel(text string) bool {
	return containsAnyKeyword(text, workExperienceKeywords)
}

func looksGradeS(text string) bool {
	return looksProductionLevel(text) || looksFreelanceLevel(text) || looksWorkExperienceLevel(text)
}

func looksGradeA(text string) bool {
	return containsAnyKeyword(text, seniorProjectKeywords) || hasTranscriptGrade(text, "A")
}

func looksGradeB(text string) bool {
	return containsAnyKeyword(text, courseworkKeywords) || hasTranscriptGrade(text, "B")
}

func looksGradeC(text string) bool {
	return hasTranscriptGrade(text, "C") || looksNameOnlySkill(text)
}

func looksGradeD(text string) bool {
	return hasTranscriptGrade(text, "D") || containsAnyKeyword(text, beginnerKeywords)
}

func looksNameOnlySkill(text string) bool {
	lower := strings.ToLower(text)
	markers := []string{
		"แค่ชื่อ",
		"ระบุมาแค่",
		"ไม่ได้เขียนอธิบาย",
		"listed only",
		"skill name only",
		"mentioned only",
	}
	for _, marker := range markers {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return false
}

func hasTranscriptGrade(text, grade string) bool {
	lower := strings.ToLower(text)
	g := strings.ToLower(grade)
	patterns := []string{
		"เกรด " + g,
		"ได้เกรด " + g,
		"grade " + g,
		"got " + g,
		"transcript " + g,
	}
	for _, pattern := range patterns {
		if strings.Contains(lower, pattern) {
			return true
		}
	}
	return false
}

func containsAnyKeyword(text string, keywords []string) bool {
	normalized := strings.ToLower(strings.TrimSpace(text))
	if normalized == "" {
		return false
	}
	for _, keyword := range keywords {
		needle := strings.ToLower(keyword)
		if needle == "prod" && strings.Contains(normalized, "product") && !strings.Contains(normalized, "production") && !strings.Contains(normalized, "prod ") && !strings.Contains(normalized, "ขึ้น prod") {
			continue
		}
		if needle == "go" {
			pattern := regexp.MustCompile(`(^|[^a-z0-9])go([^a-z0-9]|$)`)
			if pattern.MatchString(normalized) {
				return true
			}
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

func evidenceGrade(text string) string {
	switch {
	case looksGradeS(text):
		return "S"
	case looksGradeA(text):
		return "A"
	case looksGradeB(text):
		return "B"
	case looksGradeD(text):
		return "D"
	case looksGradeC(text):
		return "C"
	default:
		return ""
	}
}

func candidateScoringPrompt(experience string) string {
	return fmt.Sprintf(`คุณคือ Senior Technical Recruiter AI ของระบบ AI-InternMatch
จงอ่านเรซูเม่/ทรานสคริปต์/ข้อความประสบการณ์ทีละประโยค (Evidence) แล้วค่อยตัดสินเกรดตามกฎด้านล่างแบบเป๊ะๆ ห้ามคิดเกณฑ์เอง ห้ามมีข้อความนอก JSON

ข้อความประสบการณ์เพิ่มเติม:
%s

โครงสร้างบังคับ:
{ "skills": [ {"name": "React", "grade": "A", "type": "Hard Skill", "source": "ประโยคหลักฐานที่ใช้อ้าง"} ] }

กฎเกรด (ใช้ตามนี้เท่านั้น):
- เกรด S: ทักษะที่ใช้ใน "การรับงานจริง (Freelance)" หรือ "มีผู้ใช้งานจริง (Production/Deploy)" หรือ "เป็นประสบการณ์ทำงานจริง (Work Experience)"
- เกรด A: ทักษะที่ได้ "เกรด A ในทรานสคริปต์" หรือ ใช้ใน "การทำโปรเจกต์จบ (Senior Project/Thesis)"
- เกรด B: ทักษะที่ได้ "เกรด B ในทรานสคริปต์" หรือ ใช้ใน "การทำงานรายวิชาทั่วไป (Coursework Project)"
- เกรด C: ทักษะที่ได้ "เกรด C ในทรานสคริปต์" หรือ "ในเรซูเม่เขียนระบุมาแค่ชื่อทักษะลอยๆ แต่ไม่ได้เขียนอธิบายเจาะลึกว่าเอาไปทำอะไร"
- เกรด D: ทักษะที่ได้ "เกรด D ในทรานสคริปต์" หรือ "เพิ่งเริ่มเรียนรู้/กำลังศึกษาเบื้องต้น"

วิธีตัดสิน:
1. อ่านทีละประโยคแล้วจับ Evidence ของแต่ละทักษะ
2. ถ้าประโยคเข้าได้หลายเกรด ให้เลือกเกรดสูงสุดตามลำดับ S > A > B > C > D
3. ห้ามให้ S ถ้าไม่มี Evidence เรื่อง Freelance / Production-Deploy / Work Experience
4. ห้ามให้ A แทน S เมื่อมี Evidence ระดับ S

ตัวอย่าง:
- "รับจ้าง freelance และ Deploy ขึ้นระบบจริงให้ลูกค้า" -> grade S
- "ใช้ React ใน Senior Project / โครงงานจบ" -> grade A
- "ได้เกรด A ในทรานสคริปต์วิชา Database" -> grade A สำหรับทักษะนั้น
- "ทำโปรเจกต์รายวิชาทั่วไป" -> grade B
- "ระบุว่ามี Go แต่ไม่มีคำอธิบายว่าเอาไปทำอะไร" -> grade C
- "กำลังศึกษา Docker เบื้องต้น" -> grade D

Skill Tagging (บังคับ):
ทักษะคอมพิวเตอร์และภาษา เช่น React, Go ต้องเพิ่มแท็กกลุ่มเข้าไปในรายการ skills ด้วยเสมอ เช่น
- React -> Frontend และ Web Development
- Go -> Backend
แท็กกลุ่มใช้เกรดเดียวกับทักษะหลักที่โยงมา`, strings.TrimSpace(experience))
}

func enforceCandidateSkillGrades(skills []SkillItem, evidenceTexts ...string) []SkillItem {
	sharedEvidence := strings.Join(evidenceTexts, " ")
	out := make([]SkillItem, 0, len(skills))
	seen := map[string]bool{}

	for _, skill := range skills {
		skill.Name = strings.TrimSpace(skill.Name)
		if skill.Name == "" {
			continue
		}
		key := strings.ToLower(skill.Name)
		if seen[key] {
			continue
		}
		grade := normalizeLetterGrade(skill.Grade)
		if grade == "" {
			grade = "C"
		}
		combined := strings.Join([]string{sharedEvidence, skill.Name, skill.Source, skill.Type}, " ")
		if ev := evidenceGrade(combined); ev != "" {
			grade = ev
		} else if grade == "S" {
			grade = "A"
		}
		skill.Grade = grade
		if strings.TrimSpace(skill.Type) == "" {
			skill.Type = "Hard Skill"
		}
		seen[key] = true
		out = append(out, skill)
	}
	return expandSkillTags(out)
}

func expandSkillTags(skills []SkillItem) []SkillItem {
	seen := map[string]bool{}
	for _, skill := range skills {
		seen[strings.ToLower(skill.Name)] = true
	}
	out := append([]SkillItem{}, skills...)
	for _, skill := range skills {
		for _, tag := range relatedSkillTags(skill.Name) {
			key := strings.ToLower(tag)
			if seen[key] {
				continue
			}
			seen[key] = true
			out = append(out, SkillItem{
				Name:   tag,
				Grade:  skill.Grade,
				Type:   "Skill Group",
				Source: "Skill tagging from " + skill.Name,
			})
		}
	}
	return out
}

func relatedSkillTags(name string) []string {
	lower := strings.ToLower(strings.TrimSpace(name))
	for _, group := range skillTagGroups {
		if lower == group.match {
			return group.tags
		}
		if len(group.match) >= 4 && strings.Contains(lower, group.match) {
			return group.tags
		}
	}
	return nil
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
