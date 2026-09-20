package main

import "testing"

func TestHasProductionEvidence(t *testing.T) {
	if hasProductionEvidence("เขียน product backlog และประชุมทีม") {
		t.Fatal("product should not count as production")
	}
	if !hasProductionEvidence("deploy ขึ้น production สำหรับลูกค้าจริง") {
		t.Fatal("expected production evidence")
	}
	if !hasProductionEvidence("รับจ้าง freelance และขึ้นเซิร์ฟเวอร์") {
		t.Fatal("expected freelance/server evidence")
	}
}

func TestEnforceLogbookScoringDowngradesS(t *testing.T) {
	got := enforceLogbookScoring("เรียนประชุมและจดบันทึก", LogbookAIEvaluation{
		Feedback: "ดี",
		Score:    "S",
	})
	if got.Score != "A" {
		t.Fatalf("expected S to drop to A, got %s", got.Score)
	}
}

func TestNormalizeLetterGrade(t *testing.T) {
	if normalizeLetterGrade("s") != "S" {
		t.Fatal("expected S")
	}
	if normalizeLetterGrade("8/10") != "B" {
		t.Fatal("expected numeric 8/10 to map to B")
	}
}
