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

// Chat rooms of one application are kept apart by an explicit suffix. The empty
// suffix is the student ↔ company room; the others each have their own pair of
// participants and must never share messages.
const (
	chatRoomStudentCompany = ""
	chatRoomCompanyTeacher = "-TH"
	chatRoomStudentTeacher = "-TS"
)

// parseAppID reads the numeric application id from "APP-003" or "3". It does
// not accept chat room suffixes: those belong to parseChatThread only.
func parseAppID(raw string) (int64, bool) {
	key := strings.TrimPrefix(strings.ToUpper(strings.TrimSpace(raw)), "APP-")
	key = strings.TrimLeft(key, "0")
	if key == "" {
		return 0, false
	}
	id, err := strconv.ParseInt(key, 10, 64)
	return id, err == nil && id > 0
}

// parseChatThread splits "APP-003-TH" into the application id and the room it
// belongs to.
func parseChatThread(raw string) (appID int64, room string, ok bool) {
	key := strings.ToUpper(strings.TrimSpace(raw))
	switch {
	case strings.HasSuffix(key, chatRoomCompanyTeacher):
		room = chatRoomCompanyTeacher
	case strings.HasSuffix(key, chatRoomStudentTeacher):
		room = chatRoomStudentTeacher
	default:
		room = chatRoomStudentCompany
	}
	appID, ok = parseAppID(strings.TrimSuffix(key, room))
	if !ok {
		return 0, "", false
	}
	return appID, room, true
}

// canonicalChatThread rebuilds the storage key so the same room can never be
// split in two by casing or zero padding differences.
func canonicalChatThread(raw string) string {
	appID, room, ok := parseChatThread(raw)
	if !ok {
		return ""
	}
	return fmt.Sprintf("APP-%03d%s", appID, room)
}

func applicationParties(appID int64) (studentID, companyID int64, ok bool) {
	if db == nil || appID <= 0 {
		return 0, 0, false
	}
	err := db.QueryRow(
		"SELECT IFNULL(student_id, 0), IFNULL(company_user_id, 0) FROM applications WHERE id = ?",
		appID,
	).Scan(&studentID, &companyID)
	if err != nil {
		return 0, 0, false
	}
	return studentID, companyID, true
}

func canAccessApplication(userID int64, role string, appID int64) bool {
	if db == nil || userID <= 0 || appID <= 0 {
		return false
	}
	studentID, companyID, found := applicationParties(appID)
	if !found {
		return false
	}
	switch role {
	case roleTeacher:
		return true
	case roleStudent:
		return studentID == userID
	case roleCompany:
		return companyID == userID
	default:
		return false
	}
}

// canAccessChatThread authorises one room, not one application: a student who
// owns APP-003 may read APP-003 but never APP-003-TH (company ↔ teacher).
func canAccessChatThread(userID int64, role, threadID string) bool {
	appID, room, ok := parseChatThread(threadID)
	if !ok || userID <= 0 {
		return false
	}
	studentID, companyID, found := applicationParties(appID)
	if !found {
		return false
	}
	switch room {
	case chatRoomStudentCompany:
		return (role == roleStudent && studentID == userID) ||
			(role == roleCompany && companyID == userID)
	case chatRoomCompanyTeacher:
		return role == roleTeacher || (role == roleCompany && companyID == userID)
	case chatRoomStudentTeacher:
		return role == roleTeacher || (role == roleStudent && studentID == userID)
	default:
		return false
	}
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

// uploadExtension maps the sniffed content type to the extension the file is
// stored with, so a PDF resume is never saved (and served) as a .png.
func uploadExtension(mimeType string) string {
	base := strings.ToLower(strings.TrimSpace(strings.Split(mimeType, ";")[0]))
	switch base {
	case "application/pdf":
		return ".pdf"
	case "image/jpeg":
		return ".jpg"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	default:
		return ".png"
	}
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
