package main

import "testing"

func TestLooksProductionLevel(t *testing.T) {
	if looksProductionLevel("เขียน product backlog และประชุมทีม") {
		t.Fatal("product should not count as production")
	}
	cases := []string{
		"deploy ขึ้น production สำหรับลูกค้าจริง",
		"รับจ้าง freelance และขึ้นเซิร์ฟเวอร์",
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

func TestEnforceCandidateSkillGradesPromotesS(t *testing.T) {
	got := enforceCandidateSkillGrades([]SkillItem{
		{Name: "React", Grade: "A", Source: "Resume"},
	}, "Deploy ขึ้นระบบจริงด้วย React")
	if len(got) != 1 || got[0].Grade != "S" {
		t.Fatalf("expected production React A to become S, got %+v", got)
	}

	got = enforceCandidateSkillGrades([]SkillItem{
		{Name: "Go", Grade: "S", Source: "Freelance production deploy"},
	}, "รับจ้าง freelance ให้ลูกค้า")
	if len(got) != 1 || got[0].Grade != "S" {
		t.Fatalf("expected production Go to keep S, got %+v", got)
	}

	got = enforceCandidateSkillGrades([]SkillItem{
		{Name: "React", Grade: "S", Source: "Resume OCR: deploy to production"},
	}, "")
	if len(got) != 1 || got[0].Grade != "S" {
		t.Fatalf("expected AI/resume S evidence in source to stay S, got %+v", got)
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
