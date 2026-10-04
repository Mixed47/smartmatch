package main

import "testing"

func TestNormalizeSwipeDecision(t *testing.T) {
	cases := []struct {
		in   string
		want string
		ok   bool
	}{
		{"accepted", swipeAccepted, true},
		{"Rejected", swipeRejected, true},
		{"pass", swipeRejected, true},
		{"apply", swipeAccepted, true},
		{"left", swipeRejected, true},
		{"right", swipeAccepted, true},
		{"undo", "", false},
		{"", "", false},
	}
	for _, tc := range cases {
		got, ok := normalizeSwipeDecision(tc.in)
		if ok != tc.ok || got != tc.want {
			t.Fatalf("normalizeSwipeDecision(%q) = %q, %v; want %q, %v", tc.in, got, ok, tc.want, tc.ok)
		}
	}
}

func TestCanChangeSwipeDecision(t *testing.T) {
	if !canChangeSwipeDecision(swipeRejected) {
		t.Fatal("rejected decisions must be changeable")
	}
	if canChangeSwipeDecision(swipeAccepted) {
		t.Fatal("accepted decisions must not be changed from history")
	}
}

func TestJobDecisionKey(t *testing.T) {
	if jobDecisionKey(" React Intern ", "Acme") != jobDecisionKey("react intern", "acme") {
		t.Fatal("job keys must ignore case and surrounding space")
	}
}

func TestStudentApplicantName(t *testing.T) {
	got := studentApplicantName(StudentProfile{FirstName: "Som", Nickname: "A"})
	if got != "Som (A)" {
		t.Fatalf("got %q", got)
	}
	if studentApplicantName(StudentProfile{FirstName: "Som"}) != "Som" {
		t.Fatal("name without nickname must stay plain")
	}
}

func TestStudentSkillLabels(t *testing.T) {
	got := studentSkillLabels([]SkillItem{{Name: "React", Grade: "A"}, {Name: "  ", Grade: "S"}})
	if len(got) != 1 || got[0] != "React (เกรด A)" {
		t.Fatalf("got %+v", got)
	}
}
