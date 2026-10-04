package main

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"unicode"
)

func letterGradeScore(grade string) int {
	switch normalizeLetterGrade(grade) {
	case "S":
		return 5
	case "A":
		return 4
	case "B":
		return 3
	case "C":
		return 2
	case "D":
		return 1
	default:
		return 2
	}
}

func parseGradedSkillsResponse(aiText string) ([]SkillItem, error) {
	clean := strings.TrimSpace(aiText)
	if clean == "" {
		return nil, fmt.Errorf("empty AI response")
	}
	if extracted := extractJSONObject(clean); extracted != "" {
		clean = extracted
	}

	var aiData map[string]interface{}
	if err := json.Unmarshal([]byte(clean), &aiData); err != nil {
		return nil, fmt.Errorf("invalid AI JSON: %w", err)
	}
	raw, ok := aiData["skills"]
	if !ok || raw == nil {
		return nil, fmt.Errorf("AI response missing skills")
	}

	encoded, err := json.Marshal(raw)
	if err != nil {
		return nil, fmt.Errorf("invalid skills payload")
	}
	var skills []SkillItem
	if err := json.Unmarshal(encoded, &skills); err != nil {
		return nil, fmt.Errorf("invalid skills payload: %w", err)
	}
	if len(skills) == 0 {
		return nil, fmt.Errorf("AI did not extract any skills")
	}
	return skills, nil
}

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

var internshipContextKeywords = []string{
	"internship",
	"intern",
	"ฝึกงาน",
	"นักศึกษาฝึกงาน",
	"สหกิจศึกษา",
}

var commercialRoleKeywords = []string{
	"programmer",
	"developer",
	"software engineer",
	"software developer",
	"freelance",
	"freelancing",
	"ทำงาน",
	"ทำงานประจำ",
	"รับจ้าง",
}

var workExperienceKeywords = []string{
	"work experience",
	"full-time",
	"fulltime",
	"full time",
	"ทำงานประจำ",
	"พนักงานประจำ",
	"งานประจำ",
	"part-time",
	"parttime",
	"บริษัท",
	"ประสบการณ์ทำงาน",
	"ทำงานจริง",
	"ทำงานที่",
	"พนักงาน",
	"ลูกค้าองค์กร",
	"programmer",
	"developer",
	"software engineer",
	"software developer",
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
	"homework",
	"assignment",
	"รายวิชา",
	"วิชาเรียน",
	"โปรเจกต์รายวิชา",
	"งานรายวิชา",
	"การบ้าน",
	"mini project",
	"laboratory",
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

func looksSeniorProjectLevel(text string) bool {
	return containsAnyKeyword(text, seniorProjectKeywords)
}

func looksCourseworkLevel(text string) bool {
	return containsAnyKeyword(text, courseworkKeywords)
}

func looksWorkExperienceLevel(text string) bool {
	return containsAnyKeyword(text, workExperienceKeywords)
}

func looksInternshipLevel(text string) bool {
	return containsAnyKeyword(text, internshipContextKeywords)
}

func looksCommercialRoleLevel(text string) bool {
	return containsAnyKeyword(text, commercialRoleKeywords)
}

func hasProductionOrFreelanceEvidence(text string) bool {
	return looksProductionLevel(text) || looksFreelanceLevel(text)
}

func blocksGradeS(text string) bool {
	return looksInternshipLevel(text) || looksSeniorProjectLevel(text)
}

// hasGradeSEvidence allows S for commercial roles (Programmer, Developer,
// ทำงาน, Freelance) and production work. The intern/senior-project ban
// applies only when those exact context words appear on the skill itself.
func hasGradeSEvidence(text string) bool {
	if blocksGradeS(text) {
		return false
	}
	return hasProductionOrFreelanceEvidence(text) || looksWorkExperienceLevel(text) || looksCommercialRoleLevel(text)
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

func masterSkillNormalizationRules() string {
	return `Master Skill List (ตัวอย่างทักษะยอดฮิต — ใช้ชื่อมาตรฐานเหล่านี้เมื่อความหมายตรงกัน):
React, Vue, Angular, Next.js, HTML, CSS, Tailwind, JavaScript, TypeScript, Node.js, Express, Go, Python, Java, C++, C#, PHP, Django, Flask, Spring, MySQL, MongoDB, PostgreSQL, Redis, Database Management, UI/UX Design, Figma, Docker, Kubernetes, AWS, Git, Flutter, React Native, Dart, Frontend, Backend, Web Development

คุณต้อง Map คำศัพท์ที่สกัดได้จากเอกสาร เข้ากับชื่อทักษะใน Master List หรือชื่อทักษะที่เป็นมาตรฐานสากลเท่านั้น ห้ามสร้างคำศัพท์แยกย่อยที่ความหมายเหมือนกัน (เช่น Database Design กับ Database Development ให้รวบเป็น Database Management หรือเทียบเท่า)`
}

func candidateScoringPrompt(experience string) string {
	return fmt.Sprintf(`คุณคือ Senior Technical Recruiter AI ของระบบ AI-InternMatch
จงอ่านเรซูเม่/ทรานสคริปต์/ข้อความประสบการณ์ทีละประโยค (Evidence) แล้วค่อยตัดสินเกรดตามกฎด้านล่างแบบเป๊ะๆ ห้ามคิดเกณฑ์เอง ห้ามมีข้อความนอก JSON

ข้อความประสบการณ์เพิ่มเติม:
%s

โครงสร้างบังคับ:
{ "skills": [ {"name": "React", "grade": "A", "type": "Hard Skill", "source": "ประโยคหลักฐานที่ใช้อ้าง"} ] }

%s

[CRITICAL GRADING RULES]
บังคับให้อ่าน 'บริบทลำดับชั้น (Hierarchical Context)' ต้องดูว่าทักษะนั้นอยู่ใต้หัวข้อ (Heading) หรือตำแหน่ง (Role) อะไร แล้วใส่หัวข้อ/ตำแหน่งนั้นใน field source เสมอ
กฎห้ามเกรด S (บังคับเกรด A สูงสุด) มีผลเฉพาะประสบการณ์ที่มีคำว่า 'ฝึกงาน', 'นักศึกษาฝึกงาน', 'Internship', 'สหกิจศึกษา' หรือ 'โปรเจกต์จบ' เท่านั้น ห้ามเอาคำเหล่านี้ไปบล็อกทักษะที่อยู่คนละหัวข้อ
หากทักษะอยู่ภายใต้หัวข้อที่เป็นการทำงานประจำ เช่น 'Programmer', 'Developer', 'ทำงาน' หรือ 'Freelance' ต้องอนุญาตให้เกรด S ได้อย่างอิสระเมื่อมีหลักฐานงานจริง ห้ามปฏิเสธเกรด S เพียงเพราะผู้สมัครเป็นนักศึกษา

Strict Instruction (บังคับ):
คุณต้องให้เกรด S, A, B, C, D ตามกฎอย่างเคร่งครัด ห้ามให้เกรด S เฉพาะเมื่องานนั้นมีคำว่าฝึกงาน Internship สหกิจศึกษา หรือโปรเจกต์จบ การบ้านรายวิชาได้สูงสุดเกรด B

กฎเกรด (ใช้ตามนี้เท่านั้น):
- เกรด S: ทักษะที่อยู่ภายใต้หัวข้องานประจำ เช่น Programmer, Developer, ทำงาน, Full-time หรือรับจ้าง Freelance ที่เป็นงาน Commercial / Production จริง ให้อิสระในการให้ S
- เกรด A: ทักษะที่ได้ "เกรด A ในทรานสคริปต์" หรือประสบการณ์ที่มีคำว่าฝึกงาน / นักศึกษาฝึกงาน / Internship / สหกิจศึกษา / โปรเจกต์จบ แม้จะพัฒนาระบบจริงให้บริษัท
- เกรด B: ทักษะที่ได้ "เกรด B ในทรานสคริปต์" หรือ ใช้ใน "การทำงานรายวิชาทั่วไป (Coursework Project) / การบ้านรายวิชา"
- เกรด C: ทักษะที่ได้ "เกรด C ในทรานสคริปต์" หรือ "ในเรซูเม่เขียนระบุมาแค่ชื่อทักษะลอยๆ แต่ไม่ได้เขียนอธิบายเจาะลึกว่าเอาไปทำอะไร"
- เกรด D: ทักษะที่ได้ "เกรด D ในทรานสคริปต์" หรือ "เพิ่งเริ่มเรียนรู้/กำลังศึกษาเบื้องต้น"

วิธีตัดสิน:
1. อ่าน Hierarchical Context (Heading/Role) ของทักษะนั้นเองก่อน แล้วใส่หัวข้อนั้นใน field source ห้ามยืมคำว่าฝึกงานจากหัวข้ออื่นมาบล็อก
2. ตัดสินเกรดจากบริบทหัวข้อของทักษะนั้นเป็นหลัก ห้ามยืมหลักฐานของทักษะหรือหัวข้ออื่นมาอัปเกรดหรือดาวน์เกรด
3. ห้ามให้ S เฉพาะเมื่อ source ของทักษะนั้นมีคำว่าฝึกงาน / นักศึกษาฝึกงาน / Internship / สหกิจศึกษา / โปรเจกต์จบ
4. ห้ามให้เกรด S กับการบ้านรายวิชา แม้เทคโนโลยีจะซับซ้อนแค่ไหน
5. ห้ามให้ A แทน S เมื่ออยู่ใต้หัวข้อ Programmer, Developer, ทำงาน, Full-time หรือ Freelance

ตัวอย่าง (Few-shot — ทำตามนี้เท่านั้น):
- ตัวอย่าง 1: "พัฒนา Web Application ด้วย React เป็นโปรเจกต์จบ" -> {"name": "React", "grade": "A"}
- ตัวอย่าง 2: "เรียนรู้ Dart เบื้องต้น" -> {"name": "Dart", "grade": "D"}
- ตัวอย่าง 3: "รับจ้างทำระบบด้วย Node.js ให้ลูกค้า" -> {"name": "Node.js", "grade": "S"}
- "Programmer: พัฒนาระบบด้วย React ให้บริษัท" -> grade S
- "Developer — ทำงานด้าน Node.js" -> grade S
- "นักศึกษาฝึกงาน: พัฒนาระบบจริงให้บริษัทด้วย React" -> grade A
- "Internship — Deploy production Node.js ให้บริษัท" -> grade A
- "สหกิจศึกษา พัฒนาระบบจริงให้บริษัท" -> grade A
- "รับจ้าง freelance และ Deploy ขึ้นระบบจริงให้ลูกค้า" -> grade S
- "ทำงานประจำ (Full-time) พัฒนาระบบด้วย React" -> grade S
- "ใช้ React ใน Senior Project / โครงงานจบ" -> grade A
- "ได้เกรด A ในทรานสคริปต์วิชา Database" -> grade A สำหรับทักษะนั้น
- "ทำโปรเจกต์รายวิชาทั่วไป" -> grade B
- "ระบุว่ามี Go แต่ไม่มีคำอธิบายว่าเอาไปทำอะไร" -> grade C
- "กำลังศึกษา Docker เบื้องต้น" -> grade D

Skill Tagging (บังคับ):
ทักษะคอมพิวเตอร์และภาษา เช่น React, Go ต้องเพิ่มแท็กกลุ่มเข้าไปในรายการ skills ด้วยเสมอ เช่น
- React -> Frontend และ Web Development
- Go -> Backend
แท็กกลุ่มใช้เกรดเดียวกับทักษะหลักที่โยงมา และต้องใช้ชื่อจาก Master Skill List เท่านั้น`, strings.TrimSpace(experience), masterSkillNormalizationRules())
}

func jdExtractionPrompt(jdText string) string {
	return fmt.Sprintf(`คุณคือ AI ผู้ช่วย HR คัดกรองเรซูเม่ จงอ่าน JD นี้แล้วสกัดชื่อทักษะ IT พร้อม Weight (CRITICAL, IMPORTANT, STANDARD)
ตอบเป็น JSON ล้วนเท่านั้น ห้ามมี markdown หรือข้อความนอก JSON

JD:
%s

โครงสร้างบังคับ:
{ "skills": [{"skill": "React", "weight": "CRITICAL"}] }

%s`, strings.TrimSpace(jdText), masterSkillNormalizationRules())
}

func skillGradeEvidence(skill SkillItem, sharedEvidence string) string {
	source := strings.TrimSpace(skill.Source)
	if source != "" {
		return source
	}
	return strings.TrimSpace(sharedEvidence)
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
		if grade == "S" {
			// Ban intern/senior-project S using this skill's own source only,
			// so a Programmer role is not blocked by an internship heading elsewhere.
			hierarchy := strings.TrimSpace(skill.Source)
			if hierarchy == "" {
				hierarchy = strings.TrimSpace(sharedEvidence)
			}
			evidence := skillGradeEvidence(skill, sharedEvidence)
			switch {
			case looksInternshipLevel(hierarchy) || looksSeniorProjectLevel(hierarchy):
				grade = "A"
			case looksCourseworkLevel(evidence):
				grade = "B"
			case !hasGradeSEvidence(evidence):
				grade = "A"
			}
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
