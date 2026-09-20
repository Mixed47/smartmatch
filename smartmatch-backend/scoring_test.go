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

func TestEnforceCandidateSkillGradesByRubric(t *testing.T) {
	got := enforceCandidateSkillGrades([]SkillItem{
		{Name: "React", Grade: "A", Source: "Resume"},
	}, "Deploy ขึ้นระบบจริงด้วย React")
	if !hasSkillGrade(got, "React", "S") {
		t.Fatalf("expected production React to be S, got %+v", got)
	}
	if !hasSkillGrade(got, "Frontend", "S") || !hasSkillGrade(got, "Web Development", "S") {
		t.Fatalf("expected React to tag Frontend and Web Development, got %+v", got)
	}

	got = enforceCandidateSkillGrades([]SkillItem{
		{Name: "Go", Grade: "B", Source: "Resume"},
	}, "ใช้ Go ใน Senior Project / โครงงานจบ")
	if !hasSkillGrade(got, "Go", "A") {
		t.Fatalf("expected senior project Go to be A, got %+v", got)
	}
	if !hasSkillGrade(got, "Backend", "A") {
		t.Fatalf("expected Go to tag Backend, got %+v", got)
	}

	got = enforceCandidateSkillGrades([]SkillItem{
		{Name: "Python", Grade: "A", Source: "Resume"},
	}, "ทำโปรเจกต์รายวิชาทั่วไปด้วย Python")
	if !hasSkillGrade(got, "Python", "B") {
		t.Fatalf("expected coursework Python to be B, got %+v", got)
	}

	got = enforceCandidateSkillGrades([]SkillItem{
		{Name: "Docker", Grade: "S", Source: "Resume"},
	}, "กำลังศึกษา Docker เบื้องต้น")
	if !hasSkillGrade(got, "Docker", "D") {
		t.Fatalf("expected beginner Docker S to become D, got %+v", got)
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

func hasSkillGrade(skills []SkillItem, name, grade string) bool {
	for _, skill := range skills {
		if skill.Name == name && skill.Grade == grade {
			return true
		}
	}
	return false
}
