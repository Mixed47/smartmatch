package main

import "strings"

var jobGradeValues = map[string]int{"S": 5, "A": 4, "B": 3, "C": 2, "D": 1}

var jobWeightMultipliers = map[string]int{"CRITICAL": 3, "IMPORTANT": 2, "STANDARD": 1}

// A requirement counts as critical either through the explicit is_critical flag
// or through the CRITICAL weight produced by the JD extraction prompt.
func isCriticalRequirement(req JobReqSkill) bool {
	return req.IsCritical || strings.EqualFold(strings.TrimSpace(req.Weight), "CRITICAL")
}

func requirementWeight(req JobReqSkill) int {
	if weight := jobWeightMultipliers[strings.ToUpper(strings.TrimSpace(req.Weight))]; weight > 0 {
		return weight
	}
	if req.IsCritical {
		return jobWeightMultipliers["CRITICAL"]
	}
	return jobWeightMultipliers["STANDARD"]
}

func skillNamesOverlap(studentSkill, requiredSkill string) bool {
	student := strings.ToLower(strings.TrimSpace(studentSkill))
	required := strings.ToLower(strings.TrimSpace(requiredSkill))
	if student == "" || required == "" {
		return false
	}
	return strings.Contains(student, required) || strings.Contains(required, student)
}

// scoreJobMatch grades one job against a student's skills. The second return
// value is true when the student is missing a skill the company marked as
// critical: such a job is a hard reject (score 0) and callers must drop it from
// the recommendation list instead of showing a low percentage.
func scoreJobMatch(requiredSkills []JobReqSkill, studentSkills []SkillItem) (JobMatchResponse, bool) {
	result := JobMatchResponse{
		MatchedSkills:  []string{},
		MissingSkills:  []string{},
		CriticalSkills: []string{},
	}

	totalScore, maxPossibleScore := 0, 0
	rejected := false

	for _, req := range requiredSkills {
		if strings.TrimSpace(req.Skill) == "" {
			continue
		}
		critical := isCriticalRequirement(req)
		if critical {
			result.CriticalSkills = append(result.CriticalSkills, req.Skill)
		}

		weight := requirementWeight(req)
		maxPossibleScore += jobGradeValues["S"] * weight

		matchedValue, found := 0, false
		for _, skill := range studentSkills {
			if !skillNamesOverlap(skill.Name, req.Skill) {
				continue
			}
			matchedValue = jobGradeValues[normalizeLetterGrade(skill.Grade)]
			if matchedValue == 0 {
				matchedValue = jobGradeValues["C"]
			}
			found = true
			break
		}

		if found {
			totalScore += matchedValue * weight
			result.MatchedSkills = append(result.MatchedSkills, req.Skill)
			continue
		}

		result.MissingSkills = append(result.MissingSkills, req.Skill)
		if critical {
			rejected = true
		}
	}

	if rejected {
		result.MatchPercentage = 0
		return result, true
	}
	if maxPossibleScore > 0 {
		result.MatchPercentage = (totalScore * 100) / maxPossibleScore
		if result.MatchPercentage > 100 {
			result.MatchPercentage = 100
		}
	}
	return result, false
}
