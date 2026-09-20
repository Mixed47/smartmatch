package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
)

type CreateLogbookRequest struct {
	Date    string `json:"date"`
	Tasks   string `json:"tasks"`
	Blocker string `json:"blocker"`
}

type StudentLogbookEntry struct {
	ID         int64                `json:"id"`
	Date       string               `json:"date"`
	Tasks      string               `json:"tasks"`
	Blocker    string               `json:"blocker"`
	CreatedAt  string               `json:"created_at"`
	Evaluation *LogbookAIEvaluation `json:"evaluation,omitempty"`
}

type LogbookAIEvaluation struct {
	Feedback   string `json:"feedback"`
	Score      string `json:"score"`
	IsCritical bool   `json:"is_critical"`
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

// ListMyLogbookHandler handles GET /api/logbook (and GET /api/logbook/entries).
// It returns every logbook entry belonging to the JWT-authenticated student.
func ListMyLogbookHandler(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		writeError(w, http.StatusServiceUnavailable, "database is not available")
		return
	}

	studentID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "not logged in")
		return
	}
	role := roleFromContext(r.Context())
	if role == roleTeacher {
		listTeacherLogbooks(w)
		return
	}
	if role != roleStudent {
		writeError(w, http.StatusForbidden, "only students can view logbook entries")
		return
	}

	rows, err := db.Query(
		`SELECT id, DATE_FORMAT(date, '%Y-%m-%d'), tasks, IFNULL(blocker, ''), DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s'),
		        ai_feedback, ai_score, ai_is_critical
		 FROM logbook_entries WHERE student_id = ? ORDER BY date DESC, id DESC`,
		studentID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load logbook entries")
		return
	}
	defer rows.Close()

	entries := []StudentLogbookEntry{}
	for rows.Next() {
		var e StudentLogbookEntry
		var feedback, score sql.NullString
		var critical sql.NullBool
		if err := rows.Scan(&e.ID, &e.Date, &e.Tasks, &e.Blocker, &e.CreatedAt, &feedback, &score, &critical); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to read logbook entries")
			return
		}
		e.Evaluation = evaluationFromColumns(feedback, score, critical)
		entries = append(entries, e)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"data": entries})
}

func listTeacherLogbooks(w http.ResponseWriter) {
	rows, err := db.Query(
		`SELECT e.id,
		        COALESCE((SELECT name FROM applications WHERE student_id = e.student_id ORDER BY id DESC LIMIT 1), u.email),
		        e.tasks,
		        IFNULL(e.blocker, ''),
		        DATE_FORMAT(e.date, '%Y-%m-%d')
		 FROM logbook_entries e
		 JOIN users u ON u.id = e.student_id
		 ORDER BY e.date DESC, e.id DESC`,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load logbook entries")
		return
	}
	defer rows.Close()

	logs := []LogbookEntry{}
	for rows.Next() {
		var l LogbookEntry
		if err := rows.Scan(&l.ID, &l.Name, &l.Activity, &l.Blocker, &l.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to read logbook entries")
			return
		}
		l.Category = "Daily"
		logs = append(logs, l)
	}
	writeJSON(w, http.StatusOK, logs)
}

func EvaluateLogbookHandler(w http.ResponseWriter, r *http.Request) {
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
		writeError(w, http.StatusForbidden, "only students can evaluate logbook entries")
		return
	}

	id, err := strconv.ParseInt(mux.Vars(r)["id"], 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "invalid logbook id")
		return
	}

	var tasks string
	var blocker sql.NullString
	err = db.QueryRow(
		"SELECT tasks, blocker FROM logbook_entries WHERE id = ? AND student_id = ?",
		id, studentID,
	).Scan(&tasks, &blocker)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "logbook entry not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load logbook entry")
		return
	}

	if strings.TrimSpace(os.Getenv("GEMINI_API_KEY")) == "" {
		writeError(w, http.StatusServiceUnavailable, "GEMINI_API_KEY is not configured")
		return
	}

	evaluation, err := evaluateLogbookWithGemini(tasks, blocker.String)
	if err != nil {
		log.Printf("logbook evaluate id=%d: %v", id, err)
		if isTimeoutErr(err) {
			writeError(w, http.StatusGatewayTimeout, "AI request timed out")
			return
		}
		writeError(w, http.StatusBadGateway, "AI evaluation failed")
		return
	}

	criticalFlag := 0
	if evaluation.IsCritical {
		criticalFlag = 1
	}
	if _, err := db.Exec(
		`UPDATE logbook_entries
		 SET ai_feedback = ?, ai_score = ?, ai_is_critical = ?, ai_evaluated_at = NOW()
		 WHERE id = ? AND student_id = ?`,
		evaluation.Feedback, evaluation.Score, criticalFlag, id, studentID,
	); err != nil {
		log.Printf("logbook evaluate save id=%d: %v", id, err)
		writeError(w, http.StatusInternalServerError, "failed to save AI evaluation")
		return
	}

	writeJSON(w, http.StatusOK, evaluation)
}

func extractJSONObject(raw string) string {
	clean := strings.TrimSpace(raw)
	clean = strings.TrimPrefix(clean, "```json")
	clean = strings.TrimPrefix(clean, "```JSON")
	clean = strings.TrimPrefix(clean, "```")
	clean = strings.TrimSuffix(clean, "```")
	clean = strings.TrimSpace(clean)
	start := strings.Index(clean, "{")
	end := strings.LastIndex(clean, "}")
	if start >= 0 && end > start {
		return strings.TrimSpace(clean[start : end+1])
	}
	return clean
}

func isTimeoutErr(err error) bool {
	if err == nil {
		return false
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return true
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "timeout") || strings.Contains(msg, "deadline exceeded")
}

func ensureLogbookAIColumns() {
	if db == nil {
		return
	}
	statements := []string{
		"ALTER TABLE logbook_entries ADD COLUMN ai_feedback TEXT",
		"ALTER TABLE logbook_entries ADD COLUMN ai_score VARCHAR(32)",
		"ALTER TABLE logbook_entries ADD COLUMN ai_is_critical TINYINT(1)",
		"ALTER TABLE logbook_entries ADD COLUMN ai_evaluated_at TIMESTAMP NULL",
	}
	for _, stmt := range statements {
		if _, err := db.Exec(stmt); err != nil && !isDuplicateColumnErr(err) {
			log.Printf("logbook schema migrate: %v", err)
		}
	}
}

func isDuplicateColumnErr(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate column") || strings.Contains(msg, "1060")
}

func evaluationFromColumns(feedback, score sql.NullString, critical sql.NullBool) *LogbookAIEvaluation {
	text := strings.TrimSpace(feedback.String)
	if !feedback.Valid || text == "" {
		return nil
	}
	return &LogbookAIEvaluation{
		Feedback:   text,
		Score:      normalizeLetterGrade(strings.TrimSpace(score.String)),
		IsCritical: critical.Valid && critical.Bool,
	}
}
