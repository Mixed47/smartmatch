package main

import "strings"

// skillAliases maps spellings that mean the same technology onto one canonical
// name, so that word boundary matching does not reject obvious equivalents.
var skillAliases = map[string]string{
	"golang":      "go",
	"js":          "javascript",
	"ts":          "typescript",
	"nodejs":      "node",
	"node.js":     "node",
	"reactjs":     "react",
	"react.js":    "react",
	"vuejs":       "vue",
	"vue.js":      "vue",
	"postgres":    "postgresql",
	"k8s":         "kubernetes",
	"tailwindcss": "tailwind",
}

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

func canonicalSkillName(name string) string {
	lower := strings.ToLower(strings.TrimSpace(name))
	if alias, ok := skillAliases[lower]; ok {
		return alias
	}
	return lower
}

// compactSkillName strips every separator so that "Node.js" and "node js"
// collapse onto the same key.
func compactSkillName(name string) string {
	var b strings.Builder
	for _, r := range name {
		if isSkillWordRune(r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func isSkillWordRune(r rune) bool {
	return (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9')
}

// containsSkillWord reports whether needle appears in haystack delimited by
// non-alphanumeric characters, so "Java" never matches inside "JavaScript".
func containsSkillWord(haystack, needle string) bool {
	if needle == "" || len(needle) > len(haystack) {
		return false
	}
	runes := []rune(haystack)
	needleRunes := []rune(needle)
	for offset := 0; offset+len(needleRunes) <= len(runes); offset++ {
		if string(runes[offset:offset+len(needleRunes)]) != needle {
			continue
		}
		if offset > 0 && isSkillWordRune(runes[offset-1]) {
			continue
		}
		after := offset + len(needleRunes)
		if after < len(runes) && isSkillWordRune(runes[after]) {
			continue
		}
		return true
	}
	return false
}

// skillNamesOverlap compares two skill names on word boundaries instead of raw
// substrings: "Java" must not satisfy a "JavaScript" requirement, while
// "React" still satisfies "React.js".
func skillNamesOverlap(studentSkill, requiredSkill string) bool {
	student := canonicalSkillName(studentSkill)
	required := canonicalSkillName(requiredSkill)
	if student == "" || required == "" {
		return false
	}
	if student == required {
		return true
	}
	if compact := compactSkillName(student); compact != "" && compact == compactSkillName(required) {
		return true
	}
	return containsSkillWord(student, required) || containsSkillWord(required, student)
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
