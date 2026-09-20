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
