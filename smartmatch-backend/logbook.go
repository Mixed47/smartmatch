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
	"regexp"
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

func evaluateLogbookWithGemini(tasks, blocker string) (LogbookAIEvaluation, error) {
	blockerText := strings.TrimSpace(blocker)
	if blockerText == "" {
		blockerText = "(ไม่มีอุปสรรคที่ระบุ)"
	}

	prompt := fmt.Sprintf(`คุณคืออาจารย์ที่ปรึกษาสหกิจศึกษา AI ของระบบ AI-InternMatch
จงประเมินบันทึกประจำวันจากงานที่ทำและอุปสรรค แล้วตอบเป็น JSON ล้วนเท่านั้น ห้ามมี markdown หรือข้อความนอก JSON

งานที่ทำ (tasks):
%s

ปัญหา/อุปสรรค (blocker):
%s

โครงสร้างบังคับ:
{"feedback":"คำแนะนำสั้นๆ ไม่เกิน 2 บรรทัด เป็นภาษาไทย","score":"8/10","is_critical":false}

กฎการให้คะแนน:
- score เป็นคะแนนงานรายวัน 1-10 เท่านั้น เช่น "8/10" ห้ามใช้เกรด S, A, B, C, D
- ประเมินจากความชัดเจนของงาน ความพยายาม และการจัดการอุปสรรคในวันนั้น
- is_critical เป็น true เฉพาะเมื่ออุปสรรคร้ายแรงและต้องการความช่วยเหลือจากอาจารย์ด่วน เช่น ความปลอดภัย การกลั่นแกล้ง ไม่มีงานทำ ปัญหาสุขภาพร้ายแรง หรือละเมิดจรรยาบรรณ
- ถ้าไม่มีอุปสรรค หรือเป็นปัญหาเล็กน้อย/เทคนิคทั่วไป ให้ is_critical เป็น false`, strings.TrimSpace(tasks), blockerText)

	raw, err := callGeminiJSON(prompt)
	if err != nil {
		return LogbookAIEvaluation{}, err
	}
	return parseLogbookEvaluation(raw)
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

	score := formatLogbookDailyScore(parsed.Score)
	if score == "" {
		return LogbookAIEvaluation{}, errors.New("AI response missing score")
	}

	return LogbookAIEvaluation{
		Feedback:   feedback,
		Score:      score,
		IsCritical: parseIsCritical(parsed.IsCritical),
	}, nil
}

func formatLogbookDailyScore(value interface{}) string {
	if value == nil {
		return ""
	}
	raw := strings.TrimSpace(fmt.Sprint(value))
	if raw == "" || strings.EqualFold(raw, "<nil>") {
		return ""
	}
	upper := strings.ToUpper(raw)
	if match := regexp.MustCompile(`\b([SABCD])\b`).FindStringSubmatch(upper); len(match) == 2 && !strings.ContainsAny(raw, "0123456789") {
		return ""
	}

	var digits strings.Builder
	for _, r := range raw {
		if r >= '0' && r <= '9' {
			digits.WriteRune(r)
			if digits.Len() >= 2 {
				break
			}
			continue
		}
		if digits.Len() > 0 {
			break
		}
	}
	if digits.Len() == 0 {
		return ""
	}
	n := 0
	fmt.Sscanf(digits.String(), "%d", &n)
	if n < 1 {
		n = 1
	}
	if n > 10 {
		n = 10
	}
	return fmt.Sprintf("%d/10", n)
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
		"ALTER TABLE logbook_entries ADD COLUMN is_acknowledged TINYINT(1) NOT NULL DEFAULT 0",
	}
	for _, stmt := range statements {
		if _, err := db.Exec(stmt); err != nil && !isDuplicateColumnErr(err) {
			log.Printf("logbook schema migrate: %v", err)
		}
	}
}

type CriticalLogbookAlert struct {
	ID             int64  `json:"id"`
	StudentID      int64  `json:"student_id"`
	FirstName      string `json:"first_name"`
	LastName       string `json:"last_name"`
	StudentName    string `json:"student_name"`
	Date           string `json:"date"`
	Blocker        string `json:"blocker"`
	AIFeedback     string `json:"ai_feedback"`
	Feedback       string `json:"feedback"`
	IsCritical     bool   `json:"is_critical"`
	IsAcknowledged bool   `json:"is_acknowledged"`
}

// ListCriticalLogbooksHandler handles GET /api/teacher/critical-logbooks.
func ListCriticalLogbooksHandler(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		writeError(w, http.StatusServiceUnavailable, "database is not available")
		return
	}
	if roleFromContext(r.Context()) != roleTeacher {
		writeError(w, http.StatusForbidden, "only teachers can view critical logbooks")
		return
	}

	rows, err := db.Query(
		`SELECT e.id,
		        e.student_id,
		        IFNULL(sp.first_name, ''),
		        IFNULL(sp.last_name, ''),
		        DATE_FORMAT(e.date, '%Y-%m-%d'),
		        IFNULL(e.blocker, ''),
		        IFNULL(e.ai_feedback, ''),
		        IFNULL(e.ai_is_critical, 0),
		        IFNULL(e.is_acknowledged, 0)
		 FROM logbook_entries e
		 INNER JOIN users u ON u.id = e.student_id
		 LEFT JOIN student_profiles sp ON sp.user_id = u.id
		 WHERE IFNULL(e.ai_is_critical, 0) = 1
		   AND IFNULL(e.is_acknowledged, 0) = 0
		 ORDER BY e.date DESC, e.id DESC`,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load critical logbooks")
		return
	}
	defer rows.Close()

	alerts := []CriticalLogbookAlert{}
	for rows.Next() {
		var a CriticalLogbookAlert
		var criticalFlag, ackFlag int
		if err := rows.Scan(
			&a.ID,
			&a.StudentID,
			&a.FirstName,
			&a.LastName,
			&a.Date,
			&a.Blocker,
			&a.AIFeedback,
			&criticalFlag,
			&ackFlag,
		); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to read critical logbooks")
			return
		}
		a.IsCritical = criticalFlag == 1
		a.IsAcknowledged = ackFlag == 1
		a.Feedback = a.AIFeedback
		a.StudentName = strings.TrimSpace(a.FirstName + " " + a.LastName)
		if a.StudentName == "" {
			a.StudentName = "นักศึกษา"
		}
		alerts = append(alerts, a)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read critical logbooks")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"data": alerts})
}

// AcknowledgeCriticalLogbookHandler handles PUT /api/teacher/critical-logbooks/{id}/acknowledge.
func AcknowledgeCriticalLogbookHandler(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		writeError(w, http.StatusServiceUnavailable, "database is not available")
		return
	}
	if roleFromContext(r.Context()) != roleTeacher {
		writeError(w, http.StatusForbidden, "only teachers can acknowledge critical logbooks")
		return
	}

	id, err := strconv.ParseInt(mux.Vars(r)["id"], 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "invalid logbook id")
		return
	}

	result, err := db.Exec(
		`UPDATE logbook_entries
		 SET is_acknowledged = 1
		 WHERE id = ? AND IFNULL(ai_is_critical, 0) = 1`,
		id,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to acknowledge logbook")
		return
	}
	affected, err := result.RowsAffected()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to acknowledge logbook")
		return
	}
	if affected == 0 {
		writeError(w, http.StatusNotFound, "critical logbook not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":         "acknowledged",
		"id":              id,
		"is_acknowledged": true,
	})
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
		Score:      strings.TrimSpace(score.String),
		IsCritical: critical.Valid && critical.Bool,
	}
}
