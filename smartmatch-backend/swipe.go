package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
)

const (
	swipeAccepted = "accepted"
	swipeRejected = "rejected"
)

type SwipeDecision struct {
	ID              int64  `json:"id"`
	JobTitle        string `json:"job_title"`
	Company         string `json:"company"`
	MatchPercentage int    `json:"match_percentage"`
	Decision        string `json:"decision"`
	CreatedAt       string `json:"created_at"`
}

type swipeDecisionRequest struct {
	JobTitle        string `json:"job_title"`
	Company         string `json:"company"`
	MatchPercentage int    `json:"match_percentage"`
	Decision        string `json:"decision"`
}

func ensureSwipeDecisionsTable() {
	if db == nil {
		return
	}
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS swipe_decisions (
		id INT AUTO_INCREMENT PRIMARY KEY,
		student_id BIGINT NOT NULL,
		job_title VARCHAR(255) NOT NULL,
		company VARCHAR(255) NOT NULL,
		match_percentage INT NOT NULL DEFAULT 0,
		decision VARCHAR(20) NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		UNIQUE KEY uniq_student_job (student_id, job_title, company),
		INDEX idx_swipe_student_id (student_id)
	)`)
	if err != nil {
		fmt.Println("swipe_decisions schema:", err)
	}
}

func normalizeSwipeDecision(raw string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case swipeAccepted, "accept", "apply", "right":
		return swipeAccepted, true
	case swipeRejected, "reject", "pass", "left":
		return swipeRejected, true
	default:
		return "", false
	}
}

func canChangeSwipeDecision(current string) bool {
	return current == swipeRejected
}

func jobDecisionKey(title, company string) string {
	return strings.ToLower(strings.TrimSpace(title)) + "@@" + strings.ToLower(strings.TrimSpace(company))
}

func studentApplicantName(profile StudentProfile) string {
	name := strings.TrimSpace(profile.FirstName)
	nick := strings.TrimSpace(profile.Nickname)
	if name == "" {
		name = strings.TrimSpace(profile.Email)
	}
	if nick != "" {
		return name + " (" + nick + ")"
	}
	return name
}

func studentSkillLabels(skills []SkillItem) []string {
	labels := make([]string, 0, len(skills))
	for _, skill := range skills {
		name := strings.TrimSpace(skill.Name)
		if name == "" {
			continue
		}
		grade := strings.TrimSpace(skill.Grade)
		if grade == "" {
			labels = append(labels, name)
			continue
		}
		labels = append(labels, name+" (เกรด "+grade+")")
	}
	return labels
}

func studentAlreadyApplied(userID int64, jobTitle, company string) bool {
	if db == nil {
		return false
	}
	var count int
	_ = db.QueryRow(
		"SELECT COUNT(*) FROM applications WHERE student_id = ? AND job_title = ? AND company = ?",
		userID, jobTitle, company,
	).Scan(&count)
	return count > 0
}

func createStudentApplication(userID int64, name, jobTitle, company string, matchPercentage int, skills []string, resumeURL string) error {
	skillsJSON, err := json.Marshal(skills)
	if err != nil {
		return err
	}
	_, companyUserID := lookupJobOwner(jobTitle, company)
	_, err = db.Exec(
		`INSERT INTO applications (name, job_title, company, match_percentage, skills, resume_url, status, student_id, company_user_id)
		 VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?, ?)`,
		name, jobTitle, company, matchPercentage, string(skillsJSON), resumeURL, userID, companyUserID,
	)
	return err
}

func upsertSwipeDecision(userID int64, jobTitle, company string, matchPercentage int, decision string) (SwipeDecision, error) {
	_, err := db.Exec(
		`INSERT INTO swipe_decisions (student_id, job_title, company, match_percentage, decision)
		 VALUES (?, ?, ?, ?, ?)
		 ON DUPLICATE KEY UPDATE
		   decision = VALUES(decision),
		   match_percentage = VALUES(match_percentage)`,
		userID, jobTitle, company, matchPercentage, decision,
	)
	if err != nil {
		return SwipeDecision{}, err
	}
	return loadSwipeDecision(userID, jobTitle, company)
}

func loadSwipeDecision(userID int64, jobTitle, company string) (SwipeDecision, error) {
	var item SwipeDecision
	err := db.QueryRow(
		`SELECT id, job_title, company, match_percentage, decision, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s')
		 FROM swipe_decisions
		 WHERE student_id = ? AND job_title = ? AND company = ?`,
		userID, jobTitle, company,
	).Scan(&item.ID, &item.JobTitle, &item.Company, &item.MatchPercentage, &item.Decision, &item.CreatedAt)
	return item, err
}

func loadSwipeDecisionByID(id, userID int64) (SwipeDecision, error) {
	var item SwipeDecision
	err := db.QueryRow(
		`SELECT id, job_title, company, match_percentage, decision, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s')
		 FROM swipe_decisions
		 WHERE id = ? AND student_id = ?`,
		id, userID,
	).Scan(&item.ID, &item.JobTitle, &item.Company, &item.MatchPercentage, &item.Decision, &item.CreatedAt)
	return item, err
}

func loadStudentDecidedJobKeys(userID int64) map[string]bool {
	keys := map[string]bool{}
	if db == nil {
		return keys
	}
	rows, err := db.Query(
		"SELECT job_title, company FROM swipe_decisions WHERE student_id = ?",
		userID,
	)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var title, company string
			if rows.Scan(&title, &company) == nil {
				keys[jobDecisionKey(title, company)] = true
			}
		}
	}
	appRows, err := db.Query(
		"SELECT job_title, company FROM applications WHERE student_id = ?",
		userID,
	)
	if err != nil {
		return keys
	}
	defer appRows.Close()
	for appRows.Next() {
		var title, company string
		if appRows.Scan(&title, &company) == nil {
			keys[jobDecisionKey(title, company)] = true
		}
	}
	return keys
}

func applyFromStudentProfile(userID int64, jobTitle, company string, matchPercentage int) error {
	if studentAlreadyApplied(userID, jobTitle, company) {
		return nil
	}
	profile, err := loadStudentProfile(userID)
	if err != nil {
		return err
	}
	return createStudentApplication(
		userID,
		studentApplicantName(profile),
		jobTitle,
		company,
		matchPercentage,
		studentSkillLabels(profile.Skills),
		profile.ResumeURL,
	)
}

func recordSwipeDecisionHandler(w http.ResponseWriter, r *http.Request) {
	if !requireDB(w) {
		return
	}
	userID, _, ok := currentUser(w, r)
	if !ok {
		return
	}
	var req swipeDecisionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	jobTitle := strings.TrimSpace(req.JobTitle)
	company := strings.TrimSpace(req.Company)
	if jobTitle == "" || company == "" {
		writeError(w, http.StatusBadRequest, "job_title and company are required")
		return
	}
	decision, valid := normalizeSwipeDecision(req.Decision)
	if !valid {
		writeError(w, http.StatusBadRequest, "decision must be accepted or rejected")
		return
	}
	item, err := upsertSwipeDecision(userID, jobTitle, company, req.MatchPercentage, decision)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save swipe decision")
		return
	}
	if decision == swipeAccepted {
		if applyErr := applyFromStudentProfile(userID, jobTitle, company, req.MatchPercentage); applyErr != nil {
			writeError(w, http.StatusInternalServerError, "failed to apply")
			return
		}
	}
	writeJSON(w, http.StatusOK, item)
}

func listSwipeDecisionsHandler(w http.ResponseWriter, r *http.Request) {
	if !requireDB(w) {
		return
	}
	userID, _, ok := currentUser(w, r)
	if !ok {
		return
	}
	rows, err := db.Query(
		`SELECT id, job_title, company, match_percentage, decision, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s')
		 FROM swipe_decisions
		 WHERE student_id = ?
		 ORDER BY updated_at DESC, id DESC`,
		userID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load swipe history")
		return
	}
	defer rows.Close()

	items := []SwipeDecision{}
	seen := map[string]bool{}
	for rows.Next() {
		var item SwipeDecision
		if err := rows.Scan(&item.ID, &item.JobTitle, &item.Company, &item.MatchPercentage, &item.Decision, &item.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to load swipe history")
			return
		}
		items = append(items, item)
		seen[jobDecisionKey(item.JobTitle, item.Company)] = true
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load swipe history")
		return
	}

	// Applications created before swipe history existed still belong in the list.
	appRows, err := db.Query(
		`SELECT id, job_title, company, IFNULL(match_percentage, 0)
		 FROM applications
		 WHERE student_id = ?
		 ORDER BY id DESC`,
		userID,
	)
	if err == nil {
		defer appRows.Close()
		for appRows.Next() {
			var item SwipeDecision
			if err := appRows.Scan(&item.ID, &item.JobTitle, &item.Company, &item.MatchPercentage); err != nil {
				continue
			}
			if seen[jobDecisionKey(item.JobTitle, item.Company)] {
				continue
			}
			item.Decision = swipeAccepted
			items = append(items, item)
		}
	}

	writeJSON(w, http.StatusOK, items)
}

func changeSwipeDecisionHandler(w http.ResponseWriter, r *http.Request) {
	if !requireDB(w) {
		return
	}
	userID, _, ok := currentUser(w, r)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(mux.Vars(r)["id"], 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "invalid swipe decision id")
		return
	}
	item, err := loadSwipeDecisionByID(id, userID)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "swipe decision not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load swipe decision")
		return
	}
	if !canChangeSwipeDecision(item.Decision) {
		writeError(w, http.StatusBadRequest, "only a rejected decision can be changed")
		return
	}
	if _, err := db.Exec(
		"UPDATE swipe_decisions SET decision = ? WHERE id = ? AND student_id = ?",
		swipeAccepted, id, userID,
	); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update swipe decision")
		return
	}
	if applyErr := applyFromStudentProfile(userID, item.JobTitle, item.Company, item.MatchPercentage); applyErr != nil {
		writeError(w, http.StatusInternalServerError, "failed to apply after changing decision")
		return
	}
	item.Decision = swipeAccepted
	writeJSON(w, http.StatusOK, item)
}

func getHRDecisionsHandler(w http.ResponseWriter, r *http.Request) {
	if !requireDB(w) {
		return
	}
	userID, _, ok := currentUser(w, r)
	if !ok {
		return
	}
	rows, err := db.Query(
		`SELECT id, name, job_title, company, match_percentage, status, IFNULL(student_id, 0)
		 FROM applications
		 WHERE company_user_id = ? AND status IN ('Rejected', 'Matched', 'Completed', 'Canceled')
		 ORDER BY id DESC`,
		userID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load decision history")
		return
	}
	defer rows.Close()
	apps := []Applicant{}
	for rows.Next() {
		var app Applicant
		var id int
		if err := rows.Scan(&id, &app.Name, &app.JobTitle, &app.Company, &app.MatchPercentage, &app.Status, &app.StudentID); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to load decision history")
			return
		}
		app.ID = fmt.Sprintf("APP-%03d", id)
		apps = append(apps, app)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load decision history")
		return
	}
	writeJSON(w, http.StatusOK, apps)
}
