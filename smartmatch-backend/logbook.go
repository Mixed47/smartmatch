package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type CreateLogbookRequest struct {
	Date    string `json:"date"`
	Tasks   string `json:"tasks"`
	Blocker string `json:"blocker"`
}

func CreateLogbookHandler(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		writeError(w, http.StatusServiceUnavailable, "database is not available")
		return
	}

	studentID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "not logged in")
		return
	}

	if roleFromContext(r.Context()) != roleStudent {
		writeError(w, http.StatusForbidden, "only students can create logbook entries")
		return
	}

	var req CreateLogbookRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	req.Date = strings.TrimSpace(req.Date)
	req.Tasks = strings.TrimSpace(req.Tasks)
	req.Blocker = strings.TrimSpace(req.Blocker)

	if req.Date == "" {
		writeError(w, http.StatusBadRequest, "date is required")
		return
	}
	if req.Tasks == "" {
		writeError(w, http.StatusBadRequest, "tasks is required")
		return
	}
	if _, err := time.Parse("2006-01-02", req.Date); err != nil {
		writeError(w, http.StatusBadRequest, "date must be in YYYY-MM-DD format")
		return
	}

	var blocker interface{}
	if req.Blocker == "" {
		blocker = nil
	} else {
		blocker = req.Blocker
	}

	result, err := db.Exec(
		"INSERT INTO logbook_entries (student_id, date, tasks, blocker) VALUES (?, ?, ?, ?)",
		studentID, req.Date, req.Tasks, blocker,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save logbook entry")
		return
	}

	entryID, err := result.LastInsertId()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read saved logbook entry")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message":    "logbook entry saved",
		"id":         entryID,
		"student_id": studentID,
		"date":       req.Date,
		"tasks":      req.Tasks,
		"blocker":    req.Blocker,
	})
}
