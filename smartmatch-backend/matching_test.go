package main

import "testing"

func TestScoreJobMatchRejectsMissingCriticalSkill(t *testing.T) {
	required := []JobReqSkill{
		{Skill: "Go", Weight: "CRITICAL"},
		{Skill: "React", Weight: "STANDARD"},
	}
	student := []SkillItem{{Name: "React", Grade: "S"}}

	match, rejected := scoreJobMatch(required, student)
	if !rejected {
		t.Fatal("missing CRITICAL skill must reject the job")
	}
	if match.MatchPercentage != 0 {
		t.Fatalf("rejected job must score 0, got %d", match.MatchPercentage)
	}
	if len(match.MissingSkills) != 1 || match.MissingSkills[0] != "Go" {
		t.Fatalf("expected Go listed as missing, got %+v", match.MissingSkills)
	}
}

func TestScoreJobMatchRejectsMissingIsCriticalFlag(t *testing.T) {
	// The weight may be absent while the company ticks is_critical explicitly.
	required := []JobReqSkill{{Skill: "Docker", IsCritical: true}}

	if _, rejected := scoreJobMatch(required, []SkillItem{{Name: "Python", Grade: "S"}}); !rejected {
		t.Fatal("is_critical must behave as a hard filter even without a weight")
	}
	if _, rejected := scoreJobMatch(required, []SkillItem{{Name: "Docker", Grade: "C"}}); rejected {
		t.Fatal("holding the critical skill must not reject the job")
	}
}

func TestScoreJobMatchKeepsJobWhenCriticalSkillsAreCovered(t *testing.T) {
	required := []JobReqSkill{
		{Skill: "Go", Weight: "CRITICAL"},
		{Skill: "Kubernetes", Weight: "STANDARD"},
	}
	student := []SkillItem{{Name: "Go", Grade: "S"}}

	match, rejected := scoreJobMatch(required, student)
	if rejected {
		t.Fatal("only a non-critical skill is missing, the job must stay")
	}
	if match.MatchPercentage <= 0 || match.MatchPercentage >= 100 {
		t.Fatalf("expected a partial score, got %d", match.MatchPercentage)
	}
	if len(match.CriticalSkills) != 1 || match.CriticalSkills[0] != "Go" {
		t.Fatalf("expected Go reported as critical, got %+v", match.CriticalSkills)
	}
}

func TestScoreJobMatchFullCoverageScores100(t *testing.T) {
	required := []JobReqSkill{
		{Skill: "Go", Weight: "CRITICAL"},
		{Skill: "MySQL", Weight: "IMPORTANT"},
	}
	student := []SkillItem{{Name: "Go", Grade: "S"}, {Name: "MySQL", Grade: "S"}}

	match, rejected := scoreJobMatch(required, student)
	if rejected || match.MatchPercentage != 100 {
		t.Fatalf("expected 100%% and no rejection, got %d rejected=%v", match.MatchPercentage, rejected)
	}
}

func TestScoreJobMatchStudentWithoutSkillsIsRejectedFromCriticalJobs(t *testing.T) {
	if _, rejected := scoreJobMatch([]JobReqSkill{{Skill: "Go", Weight: "CRITICAL"}}, nil); !rejected {
		t.Fatal("a student with no skills cannot pass a critical requirement")
	}
}

func TestRequirementWeightDefaults(t *testing.T) {
	if got := requirementWeight(JobReqSkill{Skill: "Go"}); got != 1 {
		t.Fatalf("missing weight must default to STANDARD, got %d", got)
	}
	if got := requirementWeight(JobReqSkill{Skill: "Go", IsCritical: true}); got != 3 {
		t.Fatalf("is_critical must weigh as CRITICAL, got %d", got)
	}
	if got := requirementWeight(JobReqSkill{Skill: "Go", Weight: "important"}); got != 2 {
		t.Fatalf("weight must be case insensitive, got %d", got)
	}
}
