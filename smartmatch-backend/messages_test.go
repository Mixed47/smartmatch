package main

import "testing"

func TestDisplayNameForPrefersRoleSpecificName(t *testing.T) {
	if got := displayNameFor(roleCompany, "hr@acme.co", "", "Acme Co."); got != "Acme Co." {
		t.Fatalf("company should show its company name, got %q", got)
	}
	if got := displayNameFor(roleStudent, "som@uni.ac.th", "Somchai Jaidee", ""); got != "Somchai Jaidee" {
		t.Fatalf("student should show its profile name, got %q", got)
	}
	if got := displayNameFor(roleTeacher, "teacher@uni.ac.th", "", ""); got != "teacher@uni.ac.th" {
		t.Fatalf("a profile-less account falls back to email, got %q", got)
	}
	if got := displayNameFor(roleStudent, "", "", ""); got == "" {
		t.Fatal("display name must never be empty")
	}
}

func TestSortContactsPutsLatestConversationFirst(t *testing.T) {
	contacts := []*MessageContact{
		{UserID: 1, Name: "no history"},
		{UserID: 2, Name: "older", lastID: 5},
		{UserID: 3, Name: "newest", lastID: 42},
		{UserID: 4, Name: "also no history"},
	}

	sortContacts(contacts)

	order := []int64{}
	for _, c := range contacts {
		order = append(order, c.UserID)
	}
	want := []int64{3, 2, 1, 4}
	for i := range want {
		if order[i] != want[i] {
			t.Fatalf("expected order %v, got %v", want, order)
		}
	}
}
