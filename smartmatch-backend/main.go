package main

import (
	"bytes"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
)

type SkillItem struct {
	Name   string `json:"name"`
	Grade  string `json:"grade"`
	Type   string `json:"type"`
	Source string `json:"source"`
}
type JobReqSkill struct {
	Skill string `json:"skill"`
	// Weight is the legacy CRITICAL/IMPORTANT/STANDARD label, IsCritical is the
	// explicit hard-filter flag a company can set per skill.
	Weight     string `json:"weight"`
	IsCritical bool   `json:"is_critical"`
}
type JobMatchResponse struct {
	JobTitle        string   `json:"job_title"`
	Company         string   `json:"company"`
	MatchPercentage int      `json:"match_percentage"`
	MatchedSkills   []string `json:"matched_skills"`
	MissingSkills   []string `json:"missing_skills"`
	CriticalSkills  []string `json:"critical_skills"`
}
type Applicant struct {
	ID string `json:"id"`
	// StudentID is the users.id of the applicant, so the teacher UI can open the
	// matching inbox thread instead of guessing from the display name.
	StudentID       int64    `json:"student_id"`
	Name            string   `json:"name"`
	JobTitle        string   `json:"job_title"`
	Company         string   `json:"company"`
	MatchPercentage int      `json:"match_percentage"`
	Skills          []string `json:"skills"`
	ResumeURL       string   `json:"resume_url"`
	Status          string   `json:"status"`
}
type PostJobRequest struct {
	Title          string        `json:"title"`
	Company        string        `json:"company"`
	RequiredSkills []JobReqSkill `json:"required_skills"`
}
type ChatMessage struct {
	ID            int    `json:"id"`
	ApplicationID string `json:"application_id"`
	Sender        string `json:"sender"`
	Text          string `json:"text"`
	CreatedAt     string `json:"created_at"`
}
type LogbookEntry struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	Category  string `json:"category"`
	Activity  string `json:"activity"`
	Blocker   string `json:"blocker"`
	CreatedAt string `json:"created_at"`
}
type ExtractJDRequest struct {
	Text string `json:"text"`
}
type GenerateQuestionsRequest struct {
	JobTitle string `json:"job_title"`
}
type GenerateEmailRequest struct {
	Name     string   `json:"name"`
	JobTitle string   `json:"job_title"`
	Company  string   `json:"company"`
	Skills   []string `json:"skills"`
}
type CancelRequest struct {
	ID          int    `json:"id"`
	AppID       string `json:"application_id"`
	StudentName string `json:"student_name"`
	CompanyName string `json:"company_name"`
	Reason      string `json:"reason"`
	Status      string `json:"status"`
}
type EvaluateRequest struct {
	AppID   string `json:"application_id"`
	Score   int    `json:"score"`
	Comment string `json:"comment"`
}

var db *sql.DB

func loadDotEnv() {
	candidates := []string{".env"}
	if exe, err := os.Executable(); err == nil {
		candidates = append(candidates, filepath.Join(filepath.Dir(exe), ".env"))
	}
	if wd, err := os.Getwd(); err == nil {
		candidates = append(candidates,
			filepath.Join(wd, ".env"),
			filepath.Join(wd, "smartmatch-backend", ".env"),
		)
	}
	for _, path := range candidates {
		_ = godotenv.Load(path)
	}
}

func envOrDefault(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

// mysqlDSN builds the connection string from DB_URL when provided (managed
// databases), otherwise from the discrete DB_* variables used by docker-compose.
func mysqlDSN() (string, error) {
	if raw := strings.Trim(strings.TrimSpace(os.Getenv("DB_URL")), `"`); raw != "" {
		return raw, nil
	}

	user := strings.TrimSpace(os.Getenv("DB_USER"))
	password := os.Getenv("DB_PASSWORD")
	if user == "" || password == "" {
		return "", errors.New("ไม่พบค่าตั้งค่าฐานข้อมูล: ต้องกำหนด DB_URL หรือ DB_USER/DB_PASSWORD/DB_HOST")
	}

	cfg := mysql.NewConfig()
	cfg.Net = "tcp"
	cfg.User = user
	cfg.Passwd = password
	cfg.Addr = net.JoinHostPort(envOrDefault("DB_HOST", "127.0.0.1"), envOrDefault("DB_PORT", "3306"))
	cfg.DBName = envOrDefault("DB_NAME", "smartmatch")
	cfg.ParseTime = true
	cfg.Loc = time.Local
	cfg.TLSConfig = strings.TrimSpace(os.Getenv("DB_TLS"))
	return cfg.FormatDSN(), nil
}

// connectDB retries because MySQL inside docker-compose accepts connections
// a few seconds after the container starts.
func connectDB(dsn string) (*sql.DB, error) {
	conn, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}
	conn.SetMaxOpenConns(25)
	conn.SetMaxIdleConns(5)
	conn.SetConnMaxLifetime(5 * time.Minute)

	attempts := 10
	if parsed, convErr := strconv.Atoi(envOrDefault("DB_CONNECT_ATTEMPTS", "")); convErr == nil && parsed > 0 {
		attempts = parsed
	}
	for attempt := 1; attempt <= attempts; attempt++ {
		if err = conn.Ping(); err == nil {
			return conn, nil
		}
		log.Printf("⏳ รอฐานข้อมูลพร้อมใช้งาน (%d/%d): %v", attempt, attempts, err)
		time.Sleep(3 * time.Second)
	}
	_ = conn.Close()
	return nil, err
}

func initDB() {
	loadDotEnv()
	dsn, err := mysqlDSN()
	if err != nil {
		fmt.Println("❌", err)
		return
	}

	db, err = connectDB(dsn)
	if err != nil {
		fmt.Println("❌ Error เชื่อมต่อฐานข้อมูล:", err)
		return
	}

	fmt.Println("✅ เชื่อมต่อ Database สำเร็จแล้ว!")

	db.Exec(`CREATE TABLE IF NOT EXISTS applications (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), job_title VARCHAR(255), company VARCHAR(255), match_percentage INT, skills TEXT, resume_url TEXT, status VARCHAR(50) DEFAULT 'Pending')`)
	db.Exec(`CREATE TABLE IF NOT EXISTS jobs (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255), company VARCHAR(255), required_skills TEXT)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS chat_messages (id INT AUTO_INCREMENT PRIMARY KEY, application_id VARCHAR(50), sender VARCHAR(50), text TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS logbooks (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), category VARCHAR(100), activity TEXT, blocker TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS cancel_requests (id INT AUTO_INCREMENT PRIMARY KEY, application_id VARCHAR(50), student_name VARCHAR(255), company_name VARCHAR(255), reason TEXT, status VARCHAR(50) DEFAULT 'Pending')`)
	db.Exec(`CREATE TABLE IF NOT EXISTS evaluations (id INT AUTO_INCREMENT PRIMARY KEY, application_id VARCHAR(50), score INT, comment TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS users (
		id INT AUTO_INCREMENT PRIMARY KEY,
		email VARCHAR(255) NOT NULL UNIQUE,
		password_hash VARCHAR(255) NOT NULL,
		role ENUM('student', 'company', 'teacher') NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS logbook_entries (
		id INT AUTO_INCREMENT PRIMARY KEY,
		student_id INT NOT NULL,
		date DATE NOT NULL,
		tasks TEXT NOT NULL,
		blocker TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		ai_feedback TEXT,
		ai_score VARCHAR(32),
		ai_is_critical TINYINT(1),
		ai_evaluated_at TIMESTAMP NULL,
		is_acknowledged TINYINT(1) NOT NULL DEFAULT 0,
		INDEX idx_logbook_student_id (student_id),
		CONSTRAINT fk_logbook_student FOREIGN KEY (student_id) REFERENCES users(id)
	)`)
	ensureLogbookAIColumns()
	ensureOwnershipColumns()
	ensurePetitionsTable()
	ensureMFAColumns()
	ensureProfileTables()
	ensureMessagesTable()
}

// requireSecrets stops the server when secrets are missing so that no request
// is ever served with an implicit fallback credential.
func requireSecrets() {
	if _, err := jwtSecret(); err != nil {
		log.Fatalf("❌ %v — กำหนดค่าใน .env หรือ environment variables ก่อนเริ่มเซิร์ฟเวอร์", err)
	}
	if strings.TrimSpace(os.Getenv("GEMINI_API_KEY")) == "" {
		log.Println("⚠️  GEMINI_API_KEY is not configured — ฟีเจอร์ AI จะตอบกลับเป็น error 500")
	}
}

func main() {
	loadDotEnv()
	requireSecrets()
	port := envOrDefault("PORT", "8080")
	initDB()
	os.MkdirAll("./uploads", os.ModePerm)

	r := mux.NewRouter()

	r.HandleFunc("/api/register", RegisterHandler).Methods("POST")
	r.HandleFunc("/api/login", LoginHandler).Methods("POST")
	r.HandleFunc("/api/verify-mfa", VerifyMFAHandler).Methods("POST")
	r.Handle("/api/me", authed(meHandler)).Methods("GET")
	r.Handle("/api/student/profile", authed(getStudentProfileHandler, roleStudent)).Methods("GET")
	r.Handle("/api/student/profile", authed(putStudentProfileHandler, roleStudent)).Methods("PUT")
	r.Handle("/api/company/profile", authed(getCompanyProfileHandler, roleCompany)).Methods("GET")
	r.Handle("/api/company/profile", authed(putCompanyProfileHandler, roleCompany)).Methods("PUT")

	r.Handle("/api/extract-skills-graded", authed(extractSkillsGradedHandler, roleStudent)).Methods("POST")
	r.Handle("/api/match-jobs", authed(matchJobsHandler, roleStudent)).Methods("POST")
	r.Handle("/api/logbook", authed(CreateLogbookHandler, roleStudent)).Methods("POST")
	r.Handle("/api/logbook", authed(ListMyLogbookHandler, roleStudent, roleTeacher)).Methods("GET")
	r.Handle("/api/logbook/entries", authed(ListMyLogbookHandler, roleStudent, roleTeacher)).Methods("GET")
	r.Handle("/api/logbook/{id}/evaluate", authed(EvaluateLogbookHandler, roleStudent)).Methods("POST")
	r.Handle("/api/teacher/critical-logbooks", authed(ListCriticalLogbooksHandler, roleTeacher)).Methods("GET")
	r.Handle("/api/teacher/critical-logbooks/{id}/acknowledge", authed(AcknowledgeCriticalLogbookHandler, roleTeacher)).Methods("PUT")
	r.Handle("/api/applications", authed(getApplicationsHandler, roleCompany)).Methods("GET")
	r.Handle("/api/update-status", authed(updateStatusHandler, roleCompany)).Methods("POST")
	r.Handle("/api/jobs", authed(postJobHandler, roleCompany)).Methods("POST", "GET")
	r.Handle("/api/chat/send", authed(sendChatHandler, roleStudent, roleCompany, roleTeacher)).Methods("POST")
	r.Handle("/api/chat/messages", authed(getChatMessagesHandler, roleStudent, roleCompany, roleTeacher)).Methods("GET")
	r.Handle("/api/messages/contacts", authed(listMessageContactsHandler, roleStudent, roleCompany, roleTeacher)).Methods("GET")
	r.Handle("/api/messages/unread-count", authed(unreadMessagesHandler, roleStudent, roleCompany, roleTeacher)).Methods("GET")
	r.Handle("/api/messages", authed(listMessagesHandler, roleStudent, roleCompany, roleTeacher)).Methods("GET")
	r.Handle("/api/messages", authed(sendMessageHandler, roleStudent, roleCompany, roleTeacher)).Methods("POST")
	r.Handle("/api/extract-jd", authed(extractJDHandler, roleCompany)).Methods("POST")
	r.Handle("/api/apply", authed(applyJobHandler, roleStudent)).Methods("POST")
	r.Handle("/api/my-applications", authed(getMyApplicationsHandler, roleStudent, roleTeacher)).Methods("GET")
	r.Handle("/api/hr-matches", authed(getHRMatchesHandler, roleCompany)).Methods("GET")
	r.Handle("/api/generate-questions", authed(generateQuestionsHandler, roleStudent)).Methods("POST")
	r.Handle("/api/generate-email", authed(generateEmailHandler, roleStudent)).Methods("POST")
	r.Handle("/api/request-cancel", authed(requestCancelHandler, roleStudent)).Methods("POST")
	r.Handle("/api/cancel-requests", authed(getCancelRequestsHandler, roleTeacher)).Methods("GET")
	r.Handle("/api/resolve-cancel", authed(resolveCancelHandler, roleTeacher)).Methods("POST")
	r.Handle("/api/petitions", authed(createPetitionHandler, roleStudent)).Methods("POST")
	r.Handle("/api/petitions", authed(listPetitionsHandler, roleStudent, roleTeacher)).Methods("GET")
	r.Handle("/api/petitions/{id}/resolve", authed(resolvePetitionHandler, roleTeacher)).Methods("PUT")
	r.Handle("/api/evaluate", authed(evaluateStudentHandler, roleCompany)).Methods("POST")
	r.Handle("/api/evaluations", authed(getEvaluationsHandler, roleTeacher, roleCompany)).Methods("GET")
	r.Handle("/api/files/{filename}", authed(serveProtectedUpload)).Methods("GET")

	r.HandleFunc("/api/health", healthHandler).Methods("GET")
	r.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) { fmt.Fprintf(w, "API is running!") }).Methods("GET")
	fmt.Println("🚀 Web Server เปิดทำงานที่พอร์ต " + port)
	log.Fatal(http.ListenAndServe(":"+port, enableCORS(r)))
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	database := "down"
	if db != nil && db.Ping() == nil {
		database = "up"
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "database": database})
}

func requestCancelHandler(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := currentUser(w, r)
	if !ok {
		return
	}
	var req CancelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	appID, valid := parseAppID(req.AppID)
	if !valid || !canAccessApplication(userID, roleStudent, appID) {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}
	if strings.TrimSpace(req.Reason) == "" {
		writeError(w, http.StatusBadRequest, "reason is required")
		return
	}
	_, err := db.Exec(
		"INSERT INTO cancel_requests (application_id, student_name, company_name, reason, student_id) VALUES (?, ?, ?, ?, ?)",
		req.AppID, req.StudentName, req.CompanyName, req.Reason, userID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save cancel request")
		return
	}
	payload, _ := json.Marshal(map[string]string{
		"application_id": req.AppID,
		"student_name":   req.StudentName,
		"company_name":   req.CompanyName,
		"reason":         req.Reason,
	})
	_, _ = db.Exec(
		"INSERT INTO petitions (user_id, type, payload, status) VALUES (?, 'cancel', ?, 'Pending')",
		userID, payload,
	)
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func getCancelRequestsHandler(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := currentUser(w, r); !ok {
		return
	}
	reqs := []CancelRequest{}
	rows, err := db.Query("SELECT id, application_id, student_name, company_name, reason, status FROM cancel_requests WHERE status = 'Pending'")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load cancel requests")
		return
	}
	defer rows.Close()
	for rows.Next() {
		var cr CancelRequest
		if err := rows.Scan(&cr.ID, &cr.AppID, &cr.StudentName, &cr.CompanyName, &cr.Reason, &cr.Status); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to read cancel requests")
			return
		}
		reqs = append(reqs, cr)
	}
	writeJSON(w, http.StatusOK, reqs)
}

func resolveCancelHandler(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := currentUser(w, r); !ok {
		return
	}
	var req struct {
		ID     int    `json:"id"`
		AppID  string `json:"application_id"`
		Action string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	status := "Rejected"
	if req.Action == "approve" {
		status = "Approved"
	}
	if _, err := db.Exec("UPDATE cancel_requests SET status = ? WHERE id = ?", status, req.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update cancel request")
		return
	}
	if req.Action == "approve" {
		if dbID, valid := parseAppID(req.AppID); valid {
			_, _ = db.Exec("UPDATE applications SET status = 'Canceled' WHERE id = ?", dbID)
		}
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func evaluateStudentHandler(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := currentUser(w, r)
	if !ok {
		return
	}
	var req EvaluateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	appID, valid := parseAppID(req.AppID)
	if !valid || !canAccessApplication(userID, roleCompany, appID) {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}
	if _, err := db.Exec("INSERT INTO evaluations (application_id, score, comment) VALUES (?, ?, ?)", req.AppID, req.Score, req.Comment); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save evaluation")
		return
	}
	_, _ = db.Exec("UPDATE applications SET status = 'Completed' WHERE id = ? AND company_user_id = ?", appID, userID)
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func getEvaluationsHandler(w http.ResponseWriter, r *http.Request) {
	userID, role, ok := currentUser(w, r)
	if !ok {
		return
	}
	evals := []EvaluateRequest{}
	rows, err := db.Query("SELECT application_id, score, comment FROM evaluations")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load evaluations")
		return
	}
	defer rows.Close()
	for rows.Next() {
		var e EvaluateRequest
		if err := rows.Scan(&e.AppID, &e.Score, &e.Comment); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to read evaluations")
			return
		}
		if role == roleCompany {
			appID, valid := parseAppID(e.AppID)
			if !valid || !canAccessApplication(userID, roleCompany, appID) {
				continue
			}
		}
		evals = append(evals, e)
	}
	writeJSON(w, http.StatusOK, evals)
}

func callGeminiAPI(prompt string, base64Data string, mimeType string) (string, error) {
	return callGeminiGenerate(prompt, base64Data, mimeType, false)
}

func callGeminiJSON(prompt string) (string, error) {
	text, err := callGeminiGenerate(prompt, "", "", true)
	if err == nil {
		return text, nil
	}
	return callGeminiGenerate(prompt, "", "", false)
}

func callGeminiGenerate(prompt string, base64Data string, mimeType string, jsonMode bool) (string, error) {
	apiKey := strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	if apiKey == "" {
		return "", fmt.Errorf("GEMINI_API_KEY is not configured")
	}

	models := []string{"gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"}
	var lastErr error
	for _, modelName := range models {
		url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", modelName, apiKey)
		parts := []map[string]interface{}{{"text": prompt}}

		if base64Data != "" {
			if mimeType == "" {
				mimeType = "image/png"
			}
			parts = append(parts, map[string]interface{}{"inlineData": map[string]string{"mimeType": mimeType, "data": base64Data}})
		}

		payload := map[string]interface{}{
			"contents": []map[string]interface{}{{"parts": parts}},
		}
		if jsonMode {
			payload["generationConfig"] = map[string]interface{}{
				"temperature":      0.4,
				"responseMimeType": "application/json",
			}
		}

		jsonData, err := json.Marshal(payload)
		if err != nil {
			return "", err
		}
		req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
		if err != nil {
			return "", err
		}
		req.Header.Set("Content-Type", "application/json")
		client := &http.Client{Timeout: 60 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			lastErr = fmt.Errorf("%s: %s", modelName, strings.TrimSpace(string(body)))
			continue
		}
		text, err := geminiTextFromBody(body)
		if err != nil {
			lastErr = fmt.Errorf("%s: %w", modelName, err)
			continue
		}
		return text, nil
	}
	return "", fmt.Errorf("all models failed: %v", lastErr)
}

func geminiTextFromBody(body []byte) (string, error) {
	var res struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &res); err != nil {
		return "", err
	}
	if res.Error != nil && strings.TrimSpace(res.Error.Message) != "" {
		return "", fmt.Errorf("%s", res.Error.Message)
	}
	for _, candidate := range res.Candidates {
		for _, part := range candidate.Content.Parts {
			if strings.TrimSpace(part.Text) != "" {
				return part.Text, nil
			}
		}
	}
	return "", fmt.Errorf("empty Gemini response")
}

func extractSkillsGradedHandler(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := currentUser(w, r)
	if !ok {
		return
	}
	r.ParseMultipartForm(10 << 20)
	file, _, _ := r.FormFile("resume")
	expText := strings.TrimSpace(r.FormValue("experience"))
	var base64Data, imageURL, mimeType string
	var fileBytes []byte
	if file != nil {
		defer file.Close()
		fileBytes, _ = io.ReadAll(file)
		mimeType = http.DetectContentType(fileBytes)
		base64Data = base64.StdEncoding.EncodeToString(fileBytes)
	}
	if len(fileBytes) == 0 && expText == "" {
		writeError(w, http.StatusBadRequest, "resume or experience is required")
		return
	}

	promptText := candidateScoringPrompt(expText)
	aiText, err := callGeminiAPI(promptText, base64Data, mimeType)
	if err != nil {
		log.Printf("extract-skills-graded gemini: %v", err)
		writeError(w, http.StatusInternalServerError, "AI skill extraction failed")
		return
	}

	skills, err := parseGradedSkillsResponse(aiText)
	if err != nil {
		log.Printf("extract-skills-graded parse: %v", err)
		writeError(w, http.StatusInternalServerError, "AI skill extraction failed")
		return
	}
	skills = enforceCandidateSkillGrades(skills, expText)

	if len(fileBytes) > 0 {
		filename := fmt.Sprintf("%d_%d_resume.png", userID, time.Now().Unix())
		out, createErr := os.Create("./uploads/" + filename)
		if createErr == nil {
			_, _ = out.Write(fileBytes)
			_ = out.Close()
			imageURL = "/api/files/" + filename
		}
	}

	if err := saveStudentSkills(userID, skills, imageURL); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save extracted skills")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"skills":     skills,
		"resume_url": imageURL,
	})
}

func extractJDHandler(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := currentUser(w, r); !ok {
		return
	}
	var req ExtractJDRequest
	json.NewDecoder(r.Body).Decode(&req)
	promptText := fmt.Sprintf(`คุณคือ AI ผู้ช่วย HR คัดกรองเรซูเม่ จงอ่าน JD นี้: "%s" สกัดชื่อทักษะ IT พร้อม Weight (CRITICAL, IMPORTANT, STANDARD) ตอบเป็น JSON ล้วน: { "skills": [{"skill": "React", "weight": "CRITICAL"}] }`, req.Text)
	aiText, _ := callGeminiAPI(promptText, "", "")
	cleanResponse := strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(aiText, "```json", ""), "```", ""))
	var aiData map[string]interface{}
	json.Unmarshal([]byte(cleanResponse), &aiData)
	writeJSON(w, http.StatusOK, aiData)
}

func matchJobsHandler(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := currentUser(w, r)
	if !ok {
		return
	}
	var req struct {
		Skills []SkillItem `json:"skills"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if len(req.Skills) == 0 {
		req.Skills = loadStudentSkills(userID)
	}
	rows, err := db.Query("SELECT title, company, required_skills FROM jobs ORDER BY id DESC")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load jobs")
		return
	}
	defer rows.Close()
	matches := []JobMatchResponse{}
	for rows.Next() {
		var title, company, reqSkillsStr string
		if err := rows.Scan(&title, &company, &reqSkillsStr); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to read jobs")
			return
		}
		var requiredSkills []JobReqSkill
		_ = json.Unmarshal([]byte(reqSkillsStr), &requiredSkills)

		match, rejected := scoreJobMatch(requiredSkills, req.Skills)
		// A missing critical skill is a hard filter: the job never reaches the
		// student's recommendation list.
		if rejected {
			continue
		}
		match.JobTitle = title
		match.Company = company
		matches = append(matches, match)
	}
	writeJSON(w, http.StatusOK, matches)
}

func updateStatusHandler(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := currentUser(w, r)
	if !ok {
		return
	}
	var req struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	dbID, valid := parseAppID(req.ID)
	if !valid || !canAccessApplication(userID, roleCompany, dbID) {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}
	if _, err := db.Exec("UPDATE applications SET status = ? WHERE id = ? AND company_user_id = ?", req.Status, dbID, userID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update status")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func applyJobHandler(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := currentUser(w, r)
	if !ok {
		return
	}
	var req struct {
		Name            string   `json:"name"`
		JobTitle        string   `json:"job_title"`
		Company         string   `json:"company"`
		MatchPercentage int      `json:"match_percentage"`
		Skills          []string `json:"skills"`
		ResumeURL       string   `json:"resume_url"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	skillsJSON, _ := json.Marshal(req.Skills)
	_, companyUserID := lookupJobOwner(req.JobTitle, req.Company)
	_, err := db.Exec(
		`INSERT INTO applications (name, job_title, company, match_percentage, skills, resume_url, status, student_id, company_user_id)
		 VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?, ?)`,
		req.Name, req.JobTitle, req.Company, req.MatchPercentage, string(skillsJSON), req.ResumeURL, userID, companyUserID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to apply")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func getApplicationsHandler(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := currentUser(w, r)
	if !ok {
		return
	}
	apps := []Applicant{}
	rows, err := db.Query(
		"SELECT id, name, job_title, company, match_percentage, skills, resume_url, status FROM applications WHERE status = 'Pending' AND company_user_id = ?",
		userID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load applications")
		return
	}
	defer rows.Close()
	for rows.Next() {
		var a Applicant
		var id int
		var skillsStr string
		rows.Scan(&id, &a.Name, &a.JobTitle, &a.Company, &a.MatchPercentage, &skillsStr, &a.ResumeURL, &a.Status)
		a.ID = fmt.Sprintf("APP-%03d", id)
		json.Unmarshal([]byte(skillsStr), &a.Skills)
		apps = append(apps, a)
	}
	writeJSON(w, http.StatusOK, apps)
}

func getHRMatchesHandler(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := currentUser(w, r)
	if !ok {
		return
	}
	apps := []Applicant{}
	rows, err := db.Query(
		"SELECT id, name, job_title, company, match_percentage, status FROM applications WHERE status IN ('Matched', 'Completed', 'Canceled') AND company_user_id = ? ORDER BY id DESC",
		userID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load matches")
		return
	}
	defer rows.Close()
	for rows.Next() {
		var app Applicant
		var id int
		rows.Scan(&id, &app.Name, &app.JobTitle, &app.Company, &app.MatchPercentage, &app.Status)
		app.ID = fmt.Sprintf("APP-%03d", id)
		apps = append(apps, app)
	}
	writeJSON(w, http.StatusOK, apps)
}

func getMyApplicationsHandler(w http.ResponseWriter, r *http.Request) {
	userID, role, ok := currentUser(w, r)
	if !ok {
		return
	}
	myApps := []Applicant{}
	var rows *sql.Rows
	var err error
	if role == roleTeacher {
		rows, err = db.Query("SELECT id, job_title, company, status, name, IFNULL(student_id, 0) FROM applications ORDER BY id DESC")
	} else {
		rows, err = db.Query("SELECT id, job_title, company, status, name, IFNULL(student_id, 0) FROM applications WHERE student_id = ? ORDER BY id DESC", userID)
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load applications")
		return
	}
	defer rows.Close()
	for rows.Next() {
		var app Applicant
		var id int
		rows.Scan(&id, &app.JobTitle, &app.Company, &app.Status, &app.Name, &app.StudentID)
		app.ID = fmt.Sprintf("APP-%03d", id)
		myApps = append(myApps, app)
	}
	writeJSON(w, http.StatusOK, myApps)
}

func logbookHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "POST" {
		var l LogbookEntry
		json.NewDecoder(r.Body).Decode(&l)
		db.Exec("INSERT INTO logbooks (name, category, activity, blocker) VALUES (?, ?, ?, ?)", l.Name, l.Category, l.Activity, l.Blocker)
		fmt.Fprintf(w, `{"success": true}`)
	} else if r.Method == "GET" {
		logs := []LogbookEntry{}
		rows, _ := db.Query("SELECT id, name, category, activity, blocker, DATE_FORMAT(created_at, '%Y-%m-%d') FROM logbooks ORDER BY id DESC")
		defer rows.Close()
		for rows.Next() {
			var l LogbookEntry
			rows.Scan(&l.ID, &l.Name, &l.Category, &l.Activity, &l.Blocker, &l.CreatedAt)
			logs = append(logs, l)
		}
		json.NewEncoder(w).Encode(logs)
	}
}

func postJobHandler(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := currentUser(w, r)
	if !ok {
		return
	}
	if r.Method == "GET" {
		type JobResponse struct {
			Title   string        `json:"title"`
			Company string        `json:"company"`
			Skills  []JobReqSkill `json:"skills"`
		}
		var jobs []JobResponse
		rows, err := db.Query("SELECT title, company, required_skills FROM jobs WHERE user_id = ? ORDER BY id DESC", userID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to load jobs")
			return
		}
		defer rows.Close()
		for rows.Next() {
			var j JobResponse
			var skillsStr string
			rows.Scan(&j.Title, &j.Company, &skillsStr)
			json.Unmarshal([]byte(skillsStr), &j.Skills)
			jobs = append(jobs, j)
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": jobs})
		return
	}
	var req PostJobRequest
	json.NewDecoder(r.Body).Decode(&req)
	skillsJSON, _ := json.Marshal(req.RequiredSkills)
	if _, err := db.Exec("INSERT INTO jobs (title, company, required_skills, user_id) VALUES (?, ?, ?, ?)", req.Title, req.Company, string(skillsJSON), userID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to post job")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func sendChatHandler(w http.ResponseWriter, r *http.Request) {
	userID, role, ok := currentUser(w, r)
	if !ok {
		return
	}
	var msg ChatMessage
	json.NewDecoder(r.Body).Decode(&msg)
	if !canAccessChatThread(userID, role, msg.ApplicationID) {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}
	if _, err := db.Exec(
		"INSERT INTO chat_messages (application_id, sender, text) VALUES (?, ?, ?)",
		msg.ApplicationID, role, msg.Text,
	); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to send message")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func getChatMessagesHandler(w http.ResponseWriter, r *http.Request) {
	userID, role, ok := currentUser(w, r)
	if !ok {
		return
	}
	appID := r.URL.Query().Get("application_id")
	if !canAccessChatThread(userID, role, appID) {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}
	msgs := []ChatMessage{}
	rows, err := db.Query("SELECT id, application_id, sender, text, created_at FROM chat_messages WHERE application_id = ? ORDER BY id ASC", appID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load messages")
		return
	}
	defer rows.Close()
	for rows.Next() {
		var m ChatMessage
		var t time.Time
		rows.Scan(&m.ID, &m.ApplicationID, &m.Sender, &m.Text, &t)
		m.CreatedAt = t.Local().Format("15:04 น.")
		msgs = append(msgs, m)
	}
	writeJSON(w, http.StatusOK, msgs)
}

func generateQuestionsHandler(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := currentUser(w, r); !ok {
		return
	}
	var req GenerateQuestionsRequest
	json.NewDecoder(r.Body).Decode(&req)
	aiText, _ := callGeminiAPI(fmt.Sprintf("คุณคือกรรมการสัมภาษณ์งาน ช่วยคิดคำถามตำแหน่ง %s จำนวน 3 ข้อ พร้อมแนวทางการตอบ", req.JobTitle), "", "")
	writeJSON(w, http.StatusOK, map[string]string{"questions": aiText})
}

func generateEmailHandler(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := currentUser(w, r); !ok {
		return
	}
	var req GenerateEmailRequest
	json.NewDecoder(r.Body).Decode(&req)
	aiText, _ := callGeminiAPI(fmt.Sprintf("ร่างอีเมลสมัครงานภาษาไทยเป็นทางการ ชื่อ %s ตำแหน่ง %s บริษัท %s ทักษะ %s", req.Name, req.JobTitle, req.Company, strings.Join(req.Skills, ", ")), "", "")
	writeJSON(w, http.StatusOK, map[string]string{"email": aiText})
}

// allowedOrigins reads CORS_ALLOWED_ORIGINS ("*" or a comma separated list).
func allowedOrigins() map[string]bool {
	allowed := map[string]bool{}
	for _, origin := range strings.Split(envOrDefault("CORS_ALLOWED_ORIGINS", "*"), ",") {
		if origin = strings.TrimRight(strings.TrimSpace(origin), "/"); origin != "" {
			allowed[origin] = true
		}
	}
	return allowed
}

func enableCORS(next http.Handler) http.Handler {
	allowed := allowedOrigins()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimRight(strings.TrimSpace(r.Header.Get("Origin")), "/")
		switch {
		case allowed["*"]:
			w.Header().Set("Access-Control-Allow-Origin", "*")
		case origin != "" && allowed[origin]:
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}
