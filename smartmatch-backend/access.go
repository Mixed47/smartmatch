package main

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
)

func ensureOwnershipColumns() {
	if db == nil {
		return
	}
	statements := []string{
		"ALTER TABLE jobs ADD COLUMN user_id BIGINT NOT NULL DEFAULT 0",
		"ALTER TABLE applications ADD COLUMN student_id BIGINT NOT NULL DEFAULT 0",
		"ALTER TABLE applications ADD COLUMN company_user_id BIGINT NOT NULL DEFAULT 0",
		"ALTER TABLE cancel_requests ADD COLUMN student_id BIGINT NOT NULL DEFAULT 0",
		"CREATE INDEX idx_jobs_user_id ON jobs (user_id)",
		"CREATE INDEX idx_applications_student_id ON applications (student_id)",
		"CREATE INDEX idx_applications_company_user_id ON applications (company_user_id)",
	}
	for _, stmt := range statements {
		if _, err := db.Exec(stmt); err != nil && !isDuplicateSchemaErr(err) {
			fmt.Println("ownership schema migrate:", err)
		}
	}
}

func isDuplicateSchemaErr(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate column") ||
		strings.Contains(msg, "1060") ||
		strings.Contains(msg, "duplicate key name") ||
		strings.Contains(msg, "1061")
}

func parseAppID(raw string) (int64, bool) {
	key := canonicalChatThread(raw)
	if key == "" {
		return 0, false
	}
	key = strings.TrimPrefix(strings.ToUpper(key), "APP-")
	key = strings.TrimLeft(key, "0")
	if key == "" {
		return 0, false
	}
	id, err := strconv.ParseInt(key, 10, 64)
	return id, err == nil && id > 0
}

func canonicalChatThread(raw string) string {
	key := strings.TrimSpace(raw)
	key = strings.TrimSuffix(key, "-TS")
	key = strings.TrimSuffix(key, "-TH")
	return key
}

func canAccessApplication(userID int64, role string, appID int64) bool {
	if db == nil || userID <= 0 || appID <= 0 {
		return false
	}
	if role == roleTeacher {
		var n int
		_ = db.QueryRow("SELECT COUNT(*) FROM applications WHERE id = ?", appID).Scan(&n)
		return n > 0
	}

	var studentID, companyID int64
	err := db.QueryRow(
		"SELECT IFNULL(student_id, 0), IFNULL(company_user_id, 0) FROM applications WHERE id = ?",
		appID,
	).Scan(&studentID, &companyID)
	if err != nil {
		return false
	}
	switch role {
	case roleStudent:
		return studentID == userID
	case roleCompany:
		return companyID == userID
	default:
		return false
	}
}

// canAccessChatThread guards the per-application chat only. Student/teacher
// conversations belong to the universal inbox (/api/messages), which is keyed by
// user id instead of an application id.
func canAccessChatThread(userID int64, role, threadID string) bool {
	appID, ok := parseAppID(threadID)
	if !ok {
		return false
	}
	return canAccessApplication(userID, role, appID)
}

func lookupJobOwner(title, company string) (jobID, companyUserID int64) {
	if db == nil {
		return 0, 0
	}
	_ = db.QueryRow(
		"SELECT id, IFNULL(user_id, 0) FROM jobs WHERE title = ? AND company = ? ORDER BY id DESC LIMIT 1",
		title, company,
	).Scan(&jobID, &companyUserID)
	return jobID, companyUserID
}

func safeUploadName(name string) (string, bool) {
	base := filepath.Base(strings.TrimSpace(name))
	if base == "" || base == "." || base == ".." {
		return "", false
	}
	if strings.ContainsAny(base, `/\`) {
		return "", false
	}
	return base, true
}

func canReadUpload(userID int64, role, filename string) bool {
	if userID <= 0 || filename == "" {
		return false
	}
	if role == roleTeacher {
		return true
	}
	if strings.HasPrefix(filename, fmt.Sprintf("%d_", userID)) {
		return true
	}
	if db == nil {
		return false
	}
	like := "%" + filename + "%"
	var n int
	_ = db.QueryRow(
		`SELECT COUNT(*) FROM applications
		 WHERE resume_url LIKE ?
		   AND (student_id = ? OR company_user_id = ?)`,
		like, userID, userID,
	).Scan(&n)
	return n > 0
}

func serveProtectedUpload(w http.ResponseWriter, r *http.Request) {
	userID, role, ok := currentUser(w, r)
	if !ok {
		return
	}

	filename, valid := safeUploadName(mux.Vars(r)["filename"])
	if !valid {
		writeError(w, http.StatusBadRequest, "invalid file name")
		return
	}
	if !canReadUpload(userID, role, filename) {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}

	path := filepath.Join("uploads", filename)
	if _, err := os.Stat(path); err != nil {
		writeError(w, http.StatusNotFound, "file not found")
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	http.ServeFile(w, r, path)
}
