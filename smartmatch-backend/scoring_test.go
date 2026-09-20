package main

import "testing"

func TestLooksProductionLevel(t *testing.T) {
	if looksProductionLevel("เขียน product backlog และประชุมทีม") {
		t.Fatal("product should not count as production")
	}
	if !looksProductionLevel("deploy ขึ้น production สำหรับลูกค้าจริง") {
		t.Fatal("expected production evidence")
	}
	if !looksProductionLevel("รับจ้าง freelance และขึ้นเซิร์ฟเวอร์") {
		t.Fatal("expected freelance/server evidence")
	}
}

func TestEnforceCandidateSkillGradesDowngradesS(t *testing.T) {
	got := enforceCandidateSkillGrades([]SkillItem{
		{Name: "React", Grade: "S", Source: "Course project"},
	}, "เรียนวิชาเว็บและทำโปรเจกต์ในชั้นเรียน")
	if len(got) != 1 || got[0].Grade != "A" {
		t.Fatalf("expected classroom React S to drop to A, got %+v", got)
	}

	got = enforceCandidateSkillGrades([]SkillItem{
		{Name: "Go", Grade: "S", Source: "Freelance production deploy"},
	}, "deploy ขึ้น production ให้ลูกค้าจริง")
	if len(got) != 1 || got[0].Grade != "S" {
		t.Fatalf("expected production Go to keep S, got %+v", got)
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
