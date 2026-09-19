package main

import (
	"bytes"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
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
	Skill  string `json:"skill"`
	Weight string `json:"weight"`
}
type JobMatchResponse struct {
	JobTitle        string   `json:"job_title"`
	Company         string   `json:"company"`
	MatchPercentage int      `json:"match_percentage"`
	MatchedSkills   []string `json:"matched_skills"`
	MissingSkills   []string `json:"missing_skills"`
}
type Applicant struct {
	ID              string   `json:"id"`
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

func initDB() {
	loadDotEnv()
	dsn := os.Getenv("DB_URL")
	dsn = strings.Trim(dsn, `"`)
	if dsn == "" {
		fmt.Println("❌ ไม่พบ DB_URL ในไฟล์ .env")
		return
	}

	var err error
	db, err = sql.Open("mysql", dsn)
	if err != nil || db.Ping() != nil {
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
		INDEX idx_logbook_student_id (student_id),
		CONSTRAINT fk_logbook_student FOREIGN KEY (student_id) REFERENCES users(id)
	)`)
	ensureLogbookAIColumns()
}

func main() {
	loadDotEnv()
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	initDB()
	os.MkdirAll("./uploads", os.ModePerm)

	r := mux.NewRouter()
	r.PathPrefix("/uploads/").Handler(http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))

	r.HandleFunc("/api/register", RegisterHandler).Methods("POST")
	r.HandleFunc("/api/login", LoginHandler).Methods("POST")

	r.HandleFunc("/api/extract-skills-graded", extractSkillsGradedHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/match-jobs", matchJobsHandler).Methods("POST", "OPTIONS")
	r.Handle("/api/logbook", jwtAuthMiddleware(http.HandlerFunc(CreateLogbookHandler))).Methods("POST")
	r.Handle("/api/logbook", jwtAuthMiddleware(http.HandlerFunc(ListMyLogbookHandler))).Methods("GET")
	r.Handle("/api/logbook/entries", jwtAuthMiddleware(http.HandlerFunc(ListMyLogbookHandler))).Methods("GET")
	r.Handle("/api/logbook/{id}/evaluate", jwtAuthMiddleware(http.HandlerFunc(EvaluateLogbookHandler))).Methods("POST")
	r.HandleFunc("/api/applications", getApplicationsHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/update-status", updateStatusHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/jobs", postJobHandler).Methods("POST", "GET", "OPTIONS")
	r.HandleFunc("/api/chat/send", sendChatHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/chat/messages", getChatMessagesHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/extract-jd", extractJDHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/apply", applyJobHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/my-applications", getMyApplicationsHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/hr-matches", getHRMatchesHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/generate-questions", generateQuestionsHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/generate-email", generateEmailHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/request-cancel", requestCancelHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/cancel-requests", getCancelRequestsHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/resolve-cancel", resolveCancelHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/evaluate", evaluateStudentHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/evaluations", getEvaluationsHandler).Methods("GET", "OPTIONS")

	r.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) { fmt.Fprintf(w, "API is running!") }).Methods("GET")
	fmt.Println("🚀 Web Server เปิดทำงานที่พอร์ต " + port)
	log.Fatal(http.ListenAndServe(":"+port, enableCORS(r)))
}

func requestCancelHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
	var req CancelRequest
	json.NewDecoder(r.Body).Decode(&req)
	db.Exec("INSERT INTO cancel_requests (application_id, student_name, company_name, reason) VALUES (?, ?, ?, ?)", req.AppID, req.StudentName, req.CompanyName, req.Reason)
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"success": true}`)
}

func getCancelRequestsHandler(w http.ResponseWriter, r *http.Request) {
	reqs := []CancelRequest{}
	rows, err := db.Query("SELECT id, application_id, student_name, company_name, reason, status FROM cancel_requests WHERE status = 'Pending'")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var cr CancelRequest
			rows.Scan(&cr.ID, &cr.AppID, &cr.StudentName, &cr.CompanyName, &cr.Reason, &cr.Status)
			reqs = append(reqs, cr)
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(reqs)
}

func resolveCancelHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
	var req struct {
		ID     int    `json:"id"`
		AppID  string `json:"application_id"`
		Action string `json:"action"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	status := "Rejected"
	if req.Action == "approve" {
		status = "Approved"
	}
	db.Exec("UPDATE cancel_requests SET status = ? WHERE id = ?", status, req.ID)
	if req.Action == "approve" {
		idStr := strings.ReplaceAll(req.AppID, "APP-", "")
		dbID, _ := strconv.Atoi(idStr)
		db.Exec("UPDATE applications SET status = 'Canceled' WHERE id = ?", dbID)
	}
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"success": true}`)
}

func evaluateStudentHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
	var req EvaluateRequest
	json.NewDecoder(r.Body).Decode(&req)
	db.Exec("INSERT INTO evaluations (application_id, score, comment) VALUES (?, ?, ?)", req.AppID, req.Score, req.Comment)
	idStr := strings.ReplaceAll(req.AppID, "APP-", "")
	dbID, _ := strconv.Atoi(idStr)
	db.Exec("UPDATE applications SET status = 'Completed' WHERE id = ?", dbID)
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"success": true}`)
}

func getEvaluationsHandler(w http.ResponseWriter, r *http.Request) {
	evals := []EvaluateRequest{}
	rows, err := db.Query("SELECT application_id, score, comment FROM evaluations")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var e EvaluateRequest
			rows.Scan(&e.AppID, &e.Score, &e.Comment)
			evals = append(evals, e)
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(evals)
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
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
	r.ParseMultipartForm(10 << 20)
	file, _, _ := r.FormFile("resume")
	expText := r.FormValue("experience")
	var base64Data, imageURL, mimeType string
	if file != nil {
		defer file.Close()
		fileBytes, _ := io.ReadAll(file)
		mimeType = http.DetectContentType(fileBytes)
		base64Data = base64.StdEncoding.EncodeToString(fileBytes)
		filename := fmt.Sprintf("%d_resume.png", time.Now().Unix())
		out, _ := os.Create("./uploads/" + filename)
		out.Write(fileBytes)
		out.Close()
		scheme := "http"
		if r.TLS != nil {
			scheme = "https"
		}
		imageURL = fmt.Sprintf("%s://%s/uploads/%s", scheme, r.Host, filename)
	}
	promptText := fmt.Sprintf(`คุณคือ Senior Technical Recruiter AI จงสกัดทักษะ (Skills) จากเอกสาร/ข้อความ: "%s" ประเมินเกรด A, B, C, D ตามกฎเหล็ก: ตอบกลับเป็น JSON ล้วน: { "skills": [ {"name": "React", "grade": "C", "type": "Hard Skill", "source": "Resume"} ] }`, expText)
	aiText, _ := callGeminiAPI(promptText, base64Data, mimeType)
	cleanResponse := strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(aiText, "```json", ""), "```", ""))
	var aiData map[string]interface{}
	json.Unmarshal([]byte(cleanResponse), &aiData)
	if aiData == nil {
		aiData = make(map[string]interface{})
	}
	aiData["resume_url"] = imageURL
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(aiData)
}

func extractJDHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
	var req ExtractJDRequest
	json.NewDecoder(r.Body).Decode(&req)
	promptText := fmt.Sprintf(`คุณคือ AI ผู้ช่วย HR คัดกรองเรซูเม่ จงอ่าน JD นี้: "%s" สกัดชื่อทักษะ IT พร้อม Weight (CRITICAL, IMPORTANT, STANDARD) ตอบเป็น JSON ล้วน: { "skills": [{"skill": "React", "weight": "CRITICAL"}] }`, req.Text)
	aiText, _ := callGeminiAPI(promptText, "", "")
	cleanResponse := strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(aiText, "```json", ""), "```", ""))
	var aiData map[string]interface{}
	json.Unmarshal([]byte(cleanResponse), &aiData)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(aiData)
}

func matchJobsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
	var req struct {
		Skills []SkillItem `json:"skills"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	matches := []JobMatchResponse{}
	rows, _ := db.Query("SELECT title, company, required_skills FROM jobs ORDER BY id DESC")
	defer rows.Close()
	gradeValues := map[string]int{"A": 4, "B": 3, "C": 2, "D": 1}
	weightMultipliers := map[string]int{"CRITICAL": 3, "IMPORTANT": 2, "STANDARD": 1}
	for rows.Next() {
		var title, company, reqSkillsStr string
		rows.Scan(&title, &company, &reqSkillsStr)
		var requiredSkills []JobReqSkill
		json.Unmarshal([]byte(reqSkillsStr), &requiredSkills)
		var matched, missing []string
		totalScore, maxPossibleScore := 0, 0
		missingCritical := false
		for _, reqSkill := range requiredSkills {
			weightVal := weightMultipliers[strings.ToUpper(reqSkill.Weight)]
			if weightVal == 0 {
				weightVal = 1
			}
			maxPossibleScore += 4 * weightVal
			found, studentVal := false, 0
			for _, stdSkill := range req.Skills {
				if strings.Contains(strings.ToLower(stdSkill.Name), strings.ToLower(reqSkill.Skill)) || strings.Contains(strings.ToLower(reqSkill.Skill), strings.ToLower(stdSkill.Name)) {
					studentVal = gradeValues[strings.ToUpper(stdSkill.Grade)]
					if studentVal == 0 {
						studentVal = 2
					}
					matched = append(matched, reqSkill.Skill)
					found = true
					break
				}
			}
			if found {
				totalScore += studentVal * weightVal
			} else {
				missing = append(missing, reqSkill.Skill)
				if strings.ToUpper(reqSkill.Weight) == "CRITICAL" {
					missingCritical = true
				}
			}
		}
		matchPercent := 0
		if maxPossibleScore > 0 {
			matchPercent = (totalScore * 100) / maxPossibleScore
			if missingCritical && matchPercent > 50 {
				matchPercent = 50
			}
			if matchPercent > 100 {
				matchPercent = 100
			}
		}
		matches = append(matches, JobMatchResponse{JobTitle: title, Company: company, MatchPercentage: matchPercent, MatchedSkills: matched, MissingSkills: missing})
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(matches)
}

func updateStatusHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	idStr := strings.ReplaceAll(req.ID, "APP-", "")
	idStr = strings.TrimLeft(idStr, "0")
	dbID, _ := strconv.Atoi(idStr)
	db.Exec("UPDATE applications SET status = ? WHERE id = ?", req.Status, dbID)
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"success": true}`)
}

func applyJobHandler(w http.ResponseWriter, r *http.Request) {
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
	db.Exec(`INSERT INTO applications (name, job_title, company, match_percentage, skills, resume_url, status) VALUES (?, ?, ?, ?, ?, ?, 'Pending')`, req.Name, req.JobTitle, req.Company, req.MatchPercentage, string(skillsJSON), req.ResumeURL)
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"success": true}`)
}

func getApplicationsHandler(w http.ResponseWriter, r *http.Request) {
	apps := []Applicant{}
	rows, _ := db.Query("SELECT id, name, job_title, company, match_percentage, skills, resume_url, status FROM applications WHERE status = 'Pending'")
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
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(apps)
}

func getHRMatchesHandler(w http.ResponseWriter, r *http.Request) {
	apps := []Applicant{}
	rows, _ := db.Query("SELECT id, name, job_title, company, match_percentage, status FROM applications WHERE status IN ('Matched', 'Completed', 'Canceled') ORDER BY id DESC")
	defer rows.Close()
	for rows.Next() {
		var app Applicant
		var id int
		rows.Scan(&id, &app.Name, &app.JobTitle, &app.Company, &app.MatchPercentage, &app.Status)
		app.ID = fmt.Sprintf("APP-%03d", id)
		apps = append(apps, app)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(apps)
}

func getMyApplicationsHandler(w http.ResponseWriter, r *http.Request) {
	myApps := []Applicant{}
	rows, _ := db.Query("SELECT id, job_title, company, status, name FROM applications ORDER BY id DESC")
	defer rows.Close()
	for rows.Next() {
		var app Applicant
		var id int
		rows.Scan(&id, &app.JobTitle, &app.Company, &app.Status, &app.Name)
		app.ID = fmt.Sprintf("APP-%03d", id)
		myApps = append(myApps, app)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(myApps)
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
	if r.Method == "GET" {
		type JobResponse struct {
			Title   string        `json:"title"`
			Company string        `json:"company"`
			Skills  []JobReqSkill `json:"skills"`
		}
		var jobs []JobResponse
		rows, _ := db.Query("SELECT title, company, required_skills FROM jobs ORDER BY id DESC")
		defer rows.Close()
		for rows.Next() {
			var j JobResponse
			var skillsStr string
			rows.Scan(&j.Title, &j.Company, &skillsStr)
			json.Unmarshal([]byte(skillsStr), &j.Skills)
			jobs = append(jobs, j)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"data": jobs})
		return
	}
	var req PostJobRequest
	json.NewDecoder(r.Body).Decode(&req)
	skillsJSON, _ := json.Marshal(req.RequiredSkills)
	db.Exec("INSERT INTO jobs (title, company, required_skills) VALUES (?, ?, ?)", req.Title, req.Company, string(skillsJSON))
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"success": true}`)
}

func sendChatHandler(w http.ResponseWriter, r *http.Request) {
	var msg ChatMessage
	json.NewDecoder(r.Body).Decode(&msg)
	db.Exec("INSERT INTO chat_messages (application_id, sender, text) VALUES (?, ?, ?)", msg.ApplicationID, msg.Sender, msg.Text)
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"success": true}`)
}

func getChatMessagesHandler(w http.ResponseWriter, r *http.Request) {
	msgs := []ChatMessage{}
	appID := r.URL.Query().Get("application_id")
	rows, _ := db.Query("SELECT id, application_id, sender, text, created_at FROM chat_messages WHERE application_id = ? ORDER BY id ASC", appID)
	defer rows.Close()
	for rows.Next() {
		var m ChatMessage
		var t time.Time
		rows.Scan(&m.ID, &m.ApplicationID, &m.Sender, &m.Text, &t)
		m.CreatedAt = t.Local().Format("15:04 น.")
		msgs = append(msgs, m)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(msgs)
}

func generateQuestionsHandler(w http.ResponseWriter, r *http.Request) {
	var req GenerateQuestionsRequest
	json.NewDecoder(r.Body).Decode(&req)
	aiText, _ := callGeminiAPI(fmt.Sprintf("คุณคือกรรมการสัมภาษณ์งาน ช่วยคิดคำถามตำแหน่ง %s จำนวน 3 ข้อ พร้อมแนวทางการตอบ", req.JobTitle), "", "")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"questions": aiText})
}

func generateEmailHandler(w http.ResponseWriter, r *http.Request) {
	var req GenerateEmailRequest
	json.NewDecoder(r.Body).Decode(&req)
	aiText, _ := callGeminiAPI(fmt.Sprintf("ร่างอีเมลสมัครงานภาษาไทยเป็นทางการ ชื่อ %s ตำแหน่ง %s บริษัท %s ทักษะ %s", req.Name, req.JobTitle, req.Company, strings.Join(req.Skills, ", ")), "", "")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"email": aiText})
}

func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}
