package main

import "testing"

func TestLooksProductionLevel(t *testing.T) {
	if looksProductionLevel("เขียน product backlog และประชุมทีม") {
		t.Fatal("product should not count as production")
	}
	cases := []string{
		"deploy ขึ้น production สำหรับลูกค้าจริง",
		"ใช้งานจริงบนระบบจริง",
		"ขึ้นโปรดักชันให้ลูกค้า",
		"Deploy ขึ้นระบบจริง",
	}
	for _, text := range cases {
		if !looksProductionLevel(text) {
			t.Fatalf("expected production evidence in %q", text)
		}
	}
}

func TestEnforceCandidateSkillGradesDoesNotUpgrade(t *testing.T) {
	got := enforceCandidateSkillGrades([]SkillItem{
		{Name: "React", Grade: "A", Source: "Deploy ขึ้นระบบจริงด้วย React"},
	}, "Deploy ขึ้นระบบจริงด้วย React")
	if !hasSkillGrade(got, "React", "A") {
		t.Fatalf("Go must not upgrade A to S, got %+v", got)
	}
	if !hasSkillGrade(got, "Frontend", "A") || !hasSkillGrade(got, "Web Development", "A") {
		t.Fatalf("expected React to tag Frontend and Web Development, got %+v", got)
	}

	got = enforceCandidateSkillGrades([]SkillItem{
		{Name: "Go", Grade: "B", Source: "ใช้ Go ใน Senior Project / โครงงานจบ"},
	}, "ใช้ Go ใน Senior Project / โครงงานจบ")
	if !hasSkillGrade(got, "Go", "B") {
		t.Fatalf("Go must not upgrade senior project B to A, got %+v", got)
	}
	if !hasSkillGrade(got, "Backend", "B") {
		t.Fatalf("expected Go to tag Backend, got %+v", got)
	}

	got = enforceCandidateSkillGrades([]SkillItem{
		{Name: "Python", Grade: "A", Source: "ทำโปรเจกต์รายวิชาทั่วไปด้วย Python"},
	}, "ทำโปรเจกต์รายวิชาทั่วไปด้วย Python")
	if !hasSkillGrade(got, "Python", "A") {
		t.Fatalf("Go must not remap A from coursework, got %+v", got)
	}
}

func TestEnforceCandidateSkillGradesDowngradesInvalidS(t *testing.T) {
	got := enforceCandidateSkillGrades([]SkillItem{
		{Name: "React", Grade: "S", Source: "พัฒนา Web Application ด้วย React เป็นโปรเจกต์จบ"},
	}, "พัฒนา Web Application ด้วย React เป็นโปรเจกต์จบ")
	if !hasSkillGrade(got, "React", "A") {
		t.Fatalf("expected senior project React S to become A, got %+v", got)
	}

	got = enforceCandidateSkillGrades([]SkillItem{
		{Name: "Docker", Grade: "S", Source: "กำลังศึกษา Docker เบื้องต้น"},
	}, "กำลังศึกษา Docker เบื้องต้น")
	if !hasSkillGrade(got, "Docker", "A") {
		t.Fatalf("expected beginner Docker S without production/freelance evidence to become A, got %+v", got)
	}

	got = enforceCandidateSkillGrades([]SkillItem{
		{Name: "Java", Grade: "S", Source: "การบ้านรายวิชา Java"},
	})
	if !hasSkillGrade(got, "Java", "B") {
		t.Fatalf("expected coursework Java S to become B, got %+v", got)
	}

	got = enforceCandidateSkillGrades([]SkillItem{
		{Name: "Node.js", Grade: "S", Source: "รับจ้างทำระบบด้วย Node.js ให้ลูกค้า"},
	})
	if !hasSkillGrade(got, "Node.js", "S") {
		t.Fatalf("expected freelance Node.js to keep S, got %+v", got)
	}
}

func TestEnforceCandidateSkillGradesKeepsAllThreeSCases(t *testing.T) {
	cases := map[string]string{
		"freelance":       "รับจ้างทำเว็บให้ลูกค้า",
		"production":      "Deploy ขึ้นระบบจริงให้ผู้ใช้งานจริง",
		"work experience": "ประสบการณ์ทำงานจริงที่บริษัทซอฟต์แวร์",
	}
	for name, evidence := range cases {
		got := enforceCandidateSkillGrades([]SkillItem{{Name: "Go", Grade: "S", Source: evidence}})
		if !hasSkillGrade(got, "Go", "S") {
			t.Fatalf("%s evidence must keep grade S, got %+v", name, got)
		}
	}
}

func TestNormalizeLetterGrade(t *testing.T) {
	if normalizeLetterGrade("s") != "S" {
		t.Fatal("expected S")
	}
	if normalizeLetterGrade("Grade A") != "A" {
		t.Fatal("expected A")
	}
}

func TestLetterGradeScoreCountsSHighest(t *testing.T) {
	if letterGradeScore("S") != 5 {
		t.Fatalf("S must score 5, got %d", letterGradeScore("S"))
	}
	if letterGradeScore("A") != 4 || letterGradeScore("D") != 1 {
		t.Fatal("expected A=4 and D=1")
	}
	gradeValues := map[string]int{"S": 5, "A": 4, "B": 3, "C": 2, "D": 1}
	if gradeValues["S"] <= gradeValues["A"] {
		t.Fatal("S must outrank A in job matching")
	}
}

func TestParseGradedSkillsResponseRejectsBadPayload(t *testing.T) {
	if _, err := parseGradedSkillsResponse(""); err == nil {
		t.Fatal("empty AI text must fail")
	}
	if _, err := parseGradedSkillsResponse("not json"); err == nil {
		t.Fatal("invalid JSON must fail")
	}
	if _, err := parseGradedSkillsResponse(`{"skills":[]}`); err == nil {
		t.Fatal("empty skills must fail")
	}
	got, err := parseGradedSkillsResponse("```json\n{\"skills\":[{\"name\":\"Go\",\"grade\":\"S\"}]}\n```")
	if err != nil || len(got) != 1 || got[0].Name != "Go" {
		t.Fatalf("expected parsed Go skill, got %+v err=%v", got, err)
	}
}

func TestParseLogbookEvaluationCriticalFlag(t *testing.T) {
	got, err := parseLogbookEvaluation(`{"feedback":"อันตราย ต้องให้อาจารย์ช่วย","score":"2/10","is_critical":true}`)
	if err != nil {
		t.Fatal(err)
	}
	if !got.IsCritical || got.Score != "2/10" {
		t.Fatalf("expected critical 2/10, got %+v", got)
	}

	got, err = parseLogbookEvaluation("```json\n{\"feedback\":\"งานชัดเจน\",\"score\":8,\"is_critical\":false}\n```")
	if err != nil {
		t.Fatal(err)
	}
	if got.IsCritical || got.Score != "8/10" {
		t.Fatalf("expected non-critical 8/10, got %+v", got)
	}
}

func hasSkillGrade(skills []SkillItem, name, grade string) bool {
	for _, skill := range skills {
		if skill.Name == name && skill.Grade == grade {
			return true
		}
	}
	return false
}
