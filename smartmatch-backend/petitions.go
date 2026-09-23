package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
)

var allowedPetitionTypes = map[string]bool{
	"waiver":   true,
	"transfer": true,
	"leave":    true,
	"cancel":   true,
}

type Petition struct {
	ID           int64           `json:"id"`
	UserID       int64           `json:"user_id"`
	StudentName  string          `json:"student_name,omitempty"`
	StudentEmail string          `json:"student_email,omitempty"`
	Type         string          `json:"type"`
	Payload      json.RawMessage `json:"payload"`
	Reason       string          `json:"reason"`
	Status       string          `json:"status"`
	CreatedAt    string          `json:"created_at"`
	// The placement this petition is about, absent for petitions that are not
	// tied to one.
	ApplicationID string `json:"application_id,omitempty"`
	CompanyName   string `json:"company_name,omitempty"`
	JobTitle      string `json:"job_title,omitempty"`
}

type createPetitionRequest struct {
	Type          string          `json:"type"`
	Reason        string          `json:"reason"`
	Payload       json.RawMessage `json:"payload"`
	ApplicationID interface{}     `json:"application_id"`
}

type resolvePetitionRequest struct {
	Status string `json:"status"`
	Action string `json:"action"`
}

func ensurePetitionsTable() {
	if db == nil {
		return
	}
	_, _ = db.Exec(`CREATE TABLE IF NOT EXISTS petitions (
		id INT AUTO_INCREMENT PRIMARY KEY,
		user_id BIGINT NOT NULL,
		type VARCHAR(50) NOT NULL,
		application_id INT NULL,
		payload JSON NOT NULL,
		status VARCHAR(50) NOT NULL DEFAULT 'Pending',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		INDEX idx_petitions_user_id (user_id),
		INDEX idx_petitions_type (type),
		INDEX idx_petitions_status (status),
		INDEX idx_petitions_application_id (application_id)
	)`)
	// application_id is nullable because leave petitions are not tied to a
	// placement. These run for databases created before the column existed.
	for _, stmt := range []string{
		"ALTER TABLE petitions ADD COLUMN application_id INT NULL",
		"CREATE INDEX idx_petitions_application_id ON petitions (application_id)",
	} {
		if _, err := db.Exec(stmt); err != nil && !isDuplicateSchemaErr(err) {
			fmt.Println("petitions schema migrate:", err)
		}
	}
}

// resolveOwnedApplicationID accepts either a numeric id or the "APP-003" display
// form and returns it only when the application belongs to the caller.
func resolveOwnedApplicationID(raw interface{}, userID int64) (int64, bool, error) {
	text := strings.TrimSpace(stringifyJSONValue(raw))
	if text == "" {
		return 0, false, nil
	}
	appID, valid := parseAppID(text)
	if !valid {
		return 0, false, errInvalidApplication
	}
	var owned int
	if err := db.QueryRow(
		"SELECT COUNT(*) FROM applications WHERE id = ? AND student_id = ?",
		appID, userID,
	).Scan(&owned); err != nil {
		return 0, false, err
	}
	if owned == 0 {
		return 0, false, errInvalidApplication
	}
	return appID, true, nil
}

func petitionReasonFromPayload(payload json.RawMessage) string {
	if len(payload) == 0 {
		return ""
	}
	var obj map[string]interface{}
	if err := json.Unmarshal(payload, &obj); err != nil {
		return ""
	}
	if reason, ok := obj["reason"].(string); ok {
		return strings.TrimSpace(reason)
	}
	return ""
}

func buildPetitionPayload(reason string, raw json.RawMessage) (json.RawMessage, string, error) {
	obj := map[string]interface{}{}
	if len(raw) > 0 {
		if !json.Valid(raw) {
			return nil, "", errInvalidPayload
		}
		if err := json.Unmarshal(raw, &obj); err != nil {
			return nil, "", errInvalidPayload
		}
	}
	reason = strings.TrimSpace(reason)
	if reason == "" {
		if existing, ok := obj["reason"].(string); ok {
			reason = strings.TrimSpace(existing)
		}
	}
	if reason != "" {
		obj["reason"] = reason
	}
	if reason == "" {
		return nil, "", errReasonRequired
	}
	encoded, err := json.Marshal(obj)
	if err != nil {
		return nil, "", err
	}
	return encoded, reason, nil
}

var (
	errInvalidPayload     = errors.New("invalid payload")
	errReasonRequired     = errors.New("reason required")
	errInvalidApplication = errors.New("invalid application")
)

func createPetitionHandler(w http.ResponseWriter, r *http.Request) {
	if !requireDB(w) {
		return
	}
	userID, _, ok := currentUser(w, r)
	if !ok {
		return
	}

	var req createPetitionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	req.Type = strings.ToLower(strings.TrimSpace(req.Type))
	if !allowedPetitionTypes[req.Type] {
		writeError(w, http.StatusBadRequest, "type must be waiver, transfer, or leave")
		return
	}

	payload, reason, err := buildPetitionPayload(req.Reason, req.Payload)
	if err != nil {
		if errors.Is(err, errReasonRequired) {
			writeError(w, http.StatusBadRequest, "reason is required")
			return
		}
		writeError(w, http.StatusBadRequest, "payload must be a valid JSON object")
		return
	}

	// Fall back to the payload so older clients that only send it keep working.
	rawApplication := req.ApplicationID
	if rawApplication == nil {
		rawApplication = applicationIDFromPayload(payload)
	}
	appID, hasApp, err := resolveOwnedApplicationID(rawApplication, userID)
	if err != nil {
		if errors.Is(err, errInvalidApplication) {
			writeError(w, http.StatusBadRequest, "application_id must be one of your own applications")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to verify application")
		return
	}

	var appArg interface{}
	if hasApp {
		appArg = appID
		// Keep the payload copy in sync so the waiver side effect and any older
		// reader still find the reference.
		if merged, mergeErr := withPayloadApplicationID(payload, appID); mergeErr == nil {
			payload = merged
		}
	}

	result, err := db.Exec(
		"INSERT INTO petitions (user_id, type, application_id, payload, status) VALUES (?, ?, ?, ?, 'Pending')",
		userID, req.Type, appArg, payload,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save petition")
		return
	}
	id, _ := result.LastInsertId()
	response := map[string]interface{}{
		"success": true,
		"id":      id,
		"user_id": userID,
		"type":    req.Type,
		"reason":  reason,
		"status":  "Pending",
	}
	if hasApp {
		response["application_id"] = formatAppID(appID)
	}
	writeJSON(w, http.StatusCreated, response)
}

func applicationIDFromPayload(payload json.RawMessage) interface{} {
	if len(payload) == 0 {
		return nil
	}
	var obj map[string]interface{}
	if err := json.Unmarshal(payload, &obj); err != nil {
		return nil
	}
	return obj["application_id"]
}

func withPayloadApplicationID(payload json.RawMessage, appID int64) (json.RawMessage, error) {
	obj := map[string]interface{}{}
	if len(payload) > 0 {
		if err := json.Unmarshal(payload, &obj); err != nil {
			return nil, err
		}
	}
	obj["application_id"] = formatAppID(appID)
	return json.Marshal(obj)
}

func formatAppID(appID int64) string {
	return fmt.Sprintf("APP-%03d", appID)
}

func listPetitionsHandler(w http.ResponseWriter, r *http.Request) {
	if !requireDB(w) {
		return
	}
	userID, role, ok := currentUser(w, r)
	if !ok {
		return
	}

	query := `SELECT p.id, p.user_id, p.type, p.payload, p.status,
	                 DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i:%s'),
	                 TRIM(CONCAT(IFNULL(sp.first_name, ''), ' ', IFNULL(sp.last_name, ''))),
	                 IFNULL(u.email, ''),
	                 p.application_id, a.company, a.job_title
	          FROM petitions p
	          LEFT JOIN users u ON u.id = p.user_id
	          LEFT JOIN student_profiles sp ON sp.user_id = p.user_id
	          LEFT JOIN applications a ON a.id = p.application_id`
	args := []interface{}{}
	if role == roleTeacher {
		query += " WHERE p.status = 'Pending'"
	} else {
		query += " WHERE p.user_id = ?"
		args = append(args, userID)
	}
	query += " ORDER BY p.id DESC"

	rows, err := db.Query(query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load petitions")
		return
	}
	defer rows.Close()

	list := []Petition{}
	for rows.Next() {
		var p Petition
		var name sql.NullString
		var email sql.NullString
		var appID sql.NullInt64
		var company, jobTitle sql.NullString
		if err := rows.Scan(
			&p.ID, &p.UserID, &p.Type, &p.Payload, &p.Status, &p.CreatedAt, &name, &email,
			&appID, &company, &jobTitle,
		); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to read petitions")
			return
		}
		if len(p.Payload) == 0 {
			p.Payload = json.RawMessage(`{}`)
		}
		p.Reason = petitionReasonFromPayload(p.Payload)
		p.StudentName = strings.TrimSpace(name.String)
		if p.StudentName == "" {
			p.StudentName = strings.TrimSpace(email.String)
		}
		p.StudentEmail = strings.TrimSpace(email.String)
		if appID.Valid {
			p.ApplicationID = formatAppID(appID.Int64)
			p.CompanyName = strings.TrimSpace(company.String)
			p.JobTitle = strings.TrimSpace(jobTitle.String)
		}
		list = append(list, p)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read petitions")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func resolvePetitionHandler(w http.ResponseWriter, r *http.Request) {
	if !requireDB(w) {
		return
	}
	if _, role, ok := currentUser(w, r); !ok {
		return
	} else if role != roleTeacher {
		writeError(w, http.StatusForbidden, "only teachers can resolve petitions")
		return
	}

	id, err := strconv.ParseInt(mux.Vars(r)["id"], 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "invalid petition id")
		return
	}

	var req resolvePetitionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	status := strings.TrimSpace(req.Status)
	action := strings.ToLower(strings.TrimSpace(req.Action))
	switch {
	case strings.EqualFold(status, "Approved") || action == "approve":
		status = "Approved"
	case strings.EqualFold(status, "Rejected") || action == "reject":
		status = "Rejected"
	default:
		writeError(w, http.StatusBadRequest, "status must be Approved or Rejected")
		return
	}

	var petitionType string
	var payload json.RawMessage
	var appID sql.NullInt64
	err = db.QueryRow(
		"SELECT type, payload, application_id FROM petitions WHERE id = ? AND status = 'Pending'",
		id,
	).Scan(&petitionType, &payload, &appID)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "pending petition not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load petition")
		return
	}

	result, err := db.Exec("UPDATE petitions SET status = ? WHERE id = ? AND status = 'Pending'", status, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update petition")
		return
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		writeError(w, http.StatusNotFound, "pending petition not found")
		return
	}

	if status == "Approved" && (petitionType == "waiver" || petitionType == "cancel") {
		if appID.Valid {
			_, _ = db.Exec("UPDATE applications SET status = 'Canceled' WHERE id = ?", appID.Int64)
		} else {
			applyWaiverSideEffect(payload)
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"id":      id,
		"status":  status,
	})
}

func applyWaiverSideEffect(payload json.RawMessage) {
	if len(payload) == 0 {
		return
	}
	var obj map[string]interface{}
	if err := json.Unmarshal(payload, &obj); err != nil {
		return
	}
	rawID, ok := obj["application_id"]
	if !ok {
		return
	}
	appID := strings.TrimSpace(stringifyJSONValue(rawID))
	if dbID, valid := parseAppID(appID); valid {
		_, _ = db.Exec("UPDATE applications SET status = 'Canceled' WHERE id = ?", dbID)
	}
}

func stringifyJSONValue(v interface{}) string {
	switch t := v.(type) {
	case string:
		return t
	case float64:
		return strconv.FormatInt(int64(t), 10)
	case json.Number:
		return t.String()
	default:
		return ""
	}
}
