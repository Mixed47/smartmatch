package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
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
	ID        int64  `json:"id"`
	Date      string `json:"date"`
	Tasks     string `json:"tasks"`
	Blocker   string `json:"blocker"`
	CreatedAt string `json:"created_at"`
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
	if roleFromContext(r.Context()) != roleStudent {
		writeError(w, http.StatusForbidden, "only students can view logbook entries")
		return
	}

	rows, err := db.Query(
		`SELECT id, DATE_FORMAT(date, '%Y-%m-%d'), tasks, IFNULL(blocker, ''), DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s')
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
		if err := rows.Scan(&e.ID, &e.Date, &e.Tasks, &e.Blocker, &e.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to read logbook entries")
			return
		}
		entries = append(entries, e)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"data": entries})
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

	writeJSON(w, http.StatusOK, evaluation)
}

func evaluateLogbookWithGemini(tasks, blocker string) (LogbookAIEvaluation, error) {
	blockerText := strings.TrimSpace(blocker)
	if blockerText == "" {
		blockerText = "(ไม่มีอุปสรรคที่ระบุ)"
	}

	prompt := fmt.Sprintf(`คุณคืออาจารย์ที่ปรึกษาสหกิจศึกษา AI จงประเมินบันทึกประจำวันของนักศึกษาอย่างกระชับ เป็นธรรม และสร้างสรรค์

งานที่ทำ:
%s

ปัญหา/อุปสรรค:
%s

กฎการตอบ:
- ตอบเป็น JSON ล้วนเท่านั้น ห้ามมี markdown หรือข้อความนอก JSON
- โครงสร้างบังคับ:
{
  "feedback": "คำแนะนำภาษาไทย 2-4 ประโยค ชี้จุดเด่นและสิ่งที่ควรปรับในเล่มสหกิจ",
  "score": "คะแนนประเมินในรูปแบบ n/10 เช่น 8/10",
  "is_critical": true หรือ false
}
- is_critical เป็น true เฉพาะเมื่ออุปสรรครุนแรง ควรแจ้งอาจารย์ด่วน เช่น ความปลอดภัย การกลั่นแกล้ง การไม่มีงานทำ ปัญหาสุขภาพ หรือละเมิดจรรยาบรรณ
- ถ้าไม่มีอุปสรรคหรือเป็นปัญหาเล็กน้อย ให้ is_critical เป็น false`, strings.TrimSpace(tasks), blockerText)

	raw, err := callGeminiJSON(prompt)
	if err != nil {
		return LogbookAIEvaluation{}, err
	}

	evaluation, err := parseLogbookEvaluation(raw)
	if err != nil {
		return LogbookAIEvaluation{}, err
	}
	return evaluation, nil
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

func parseLogbookEvaluation(raw string) (LogbookAIEvaluation, error) {
	clean := extractJSONObject(raw)
	if clean == "" {
		return LogbookAIEvaluation{}, errors.New("empty AI response")
	}

	var parsed struct {
		Feedback   string      `json:"feedback"`
		Score      interface{} `json:"score"`
		IsCritical interface{} `json:"is_critical"`
	}
	if err := json.Unmarshal([]byte(clean), &parsed); err != nil {
		return LogbookAIEvaluation{}, fmt.Errorf("invalid AI JSON: %w", err)
	}

	feedback := strings.TrimSpace(parsed.Feedback)
	if feedback == "" {
		return LogbookAIEvaluation{}, errors.New("AI response missing feedback")
	}

	score := formatLogbookScore(parsed.Score)
	if score == "" {
		return LogbookAIEvaluation{}, errors.New("AI response missing score")
	}

	return LogbookAIEvaluation{
		Feedback:   feedback,
		Score:      score,
		IsCritical: parseIsCritical(parsed.IsCritical),
	}, nil
}

func formatLogbookScore(value interface{}) string {
	if value == nil {
		return ""
	}
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	case float64:
		if v == float64(int(v)) {
			return fmt.Sprintf("%d/10", int(v))
		}
		return strings.TrimSpace(fmt.Sprintf("%v/10", v))
	case json.Number:
		return strings.TrimSpace(v.String())
	default:
		return strings.TrimSpace(fmt.Sprintf("%v", v))
	}
}

func parseIsCritical(value interface{}) bool {
	switch v := value.(type) {
	case bool:
		return v
	case string:
		s := strings.ToLower(strings.TrimSpace(v))
		return s == "true" || s == "1" || s == "yes"
	case float64:
		return v != 0
	default:
		return false
	}
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
