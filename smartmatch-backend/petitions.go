package main

import (
	"encoding/json"
	"net/http"
	"strings"
)

var allowedPetitionTypes = map[string]bool{
	"waiver":   true,
	"transfer": true,
	"leave":    true,
	"cancel":   true,
}

type Petition struct {
	ID        int64           `json:"id"`
	UserID    int64           `json:"user_id"`
	Type      string          `json:"type"`
	Payload   json.RawMessage `json:"payload"`
	Status    string          `json:"status"`
	CreatedAt string          `json:"created_at"`
}

type createPetitionRequest struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

func ensurePetitionsTable() {
	if db == nil {
		return
	}
	_, _ = db.Exec(`CREATE TABLE IF NOT EXISTS petitions (
		id INT AUTO_INCREMENT PRIMARY KEY,
		user_id BIGINT NOT NULL,
		type VARCHAR(50) NOT NULL,
		payload JSON NOT NULL,
		status VARCHAR(50) NOT NULL DEFAULT 'Pending',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		INDEX idx_petitions_user_id (user_id),
		INDEX idx_petitions_type (type)
	)`)
}

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
		writeError(w, http.StatusBadRequest, "type must be waiver, transfer, leave, or cancel")
		return
	}
	if len(req.Payload) == 0 || !json.Valid(req.Payload) {
		writeError(w, http.StatusBadRequest, "payload must be a valid JSON object")
		return
	}

	result, err := db.Exec(
		"INSERT INTO petitions (user_id, type, payload, status) VALUES (?, ?, ?, 'Pending')",
		userID, req.Type, req.Payload,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save petition")
		return
	}
	id, _ := result.LastInsertId()
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"success": true,
		"id":      id,
		"user_id": userID,
		"type":    req.Type,
		"status":  "Pending",
	})
}

func listPetitionsHandler(w http.ResponseWriter, r *http.Request) {
	if !requireDB(w) {
		return
	}
	userID, role, ok := currentUser(w, r)
	if !ok {
		return
	}

	query := `SELECT id, user_id, type, payload, status, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s')
	          FROM petitions`
	args := []interface{}{}
	if role != roleTeacher {
		query += " WHERE user_id = ?"
		args = append(args, userID)
	}
	query += " ORDER BY id DESC"

	rows, err := db.Query(query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load petitions")
		return
	}
	defer rows.Close()

	list := []Petition{}
	for rows.Next() {
		var p Petition
		if err := rows.Scan(&p.ID, &p.UserID, &p.Type, &p.Payload, &p.Status, &p.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to read petitions")
			return
		}
		if len(p.Payload) == 0 {
			p.Payload = json.RawMessage(`{}`)
		}
		list = append(list, p)
	}
	writeJSON(w, http.StatusOK, list)
}
