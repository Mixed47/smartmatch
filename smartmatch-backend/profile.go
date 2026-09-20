package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type StudentProfile struct {
	FirstName   string      `json:"first_name"`
	LastName    string      `json:"last_name"`
	Nickname    string      `json:"nickname"`
	DOB         string      `json:"dob"`
	Phone       string      `json:"phone"`
	Email       string      `json:"email"`
	University  string      `json:"university"`
	Major       string      `json:"major"`
	Address     string      `json:"address"`
	Github      string      `json:"github"`
	Skills      []SkillItem `json:"skills"`
	ResumeURL   string      `json:"resume_url"`
	Internship  *Internship `json:"internship"`
}

type Internship struct {
	JobTitle string `json:"job_title"`
	Company  string `json:"company"`
	Status   string `json:"status"`
}

type CompanyProfile struct {
	CompanyName string `json:"company_name"`
	Industry    string `json:"industry"`
	Location    string `json:"location"`
	Website     string `json:"website"`
	Culture     string `json:"culture"`
}

func ensureProfileTables() {
	if db == nil {
		return
	}
	_, _ = db.Exec(`CREATE TABLE IF NOT EXISTS student_profiles (
		user_id INT PRIMARY KEY,
		first_name VARCHAR(255) NOT NULL DEFAULT '',
		last_name VARCHAR(255) NOT NULL DEFAULT '',
		nickname VARCHAR(100) NOT NULL DEFAULT '',
		dob DATE NULL,
		phone VARCHAR(50) NOT NULL DEFAULT '',
		contact_email VARCHAR(255) NOT NULL DEFAULT '',
		university VARCHAR(255) NOT NULL DEFAULT '',
		major VARCHAR(255) NOT NULL DEFAULT '',
		address TEXT,
		github VARCHAR(255) NOT NULL DEFAULT '',
		skills JSON NULL,
		resume_url TEXT,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
	)`)
	_, _ = db.Exec(`CREATE TABLE IF NOT EXISTS company_profiles (
		user_id INT PRIMARY KEY,
		company_name VARCHAR(255) NOT NULL DEFAULT '',
		industry VARCHAR(255) NOT NULL DEFAULT '',
		location VARCHAR(255) NOT NULL DEFAULT '',
		website VARCHAR(255) NOT NULL DEFAULT '',
		culture TEXT,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
	)`)
}

func meHandler(w http.ResponseWriter, r *http.Request) {
	if !requireDB(w) {
		return
	}
	userID, role, ok := currentUser(w, r)
	if !ok {
		return
	}
	var email string
	if err := db.QueryRow("SELECT email FROM users WHERE id = ?", userID).Scan(&email); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load account")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"user_id": userID,
		"email":   email,
		"role":    role,
	})
}

func getStudentProfileHandler(w http.ResponseWriter, r *http.Request) {
	if !requireDB(w) {
		return
	}
	userID, _, ok := currentUser(w, r)
	if !ok {
		return
	}
	profile, err := loadStudentProfile(userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load profile")
		return
	}
	writeJSON(w, http.StatusOK, profile)
}

func putStudentProfileHandler(w http.ResponseWriter, r *http.Request) {
	if !requireDB(w) {
		return
	}
	userID, _, ok := currentUser(w, r)
	if !ok {
		return
	}

	var req StudentProfile
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	req.Nickname = strings.TrimSpace(req.Nickname)
	req.Email = strings.TrimSpace(req.Email)
	req.University = strings.TrimSpace(req.University)
	req.Major = strings.TrimSpace(req.Major)
	if req.FirstName == "" {
		writeError(w, http.StatusBadRequest, "first_name is required")
		return
	}

	if err := upsertStudentProfile(userID, req, false); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save profile")
		return
	}
	profile, err := loadStudentProfile(userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to reload profile")
		return
	}
	writeJSON(w, http.StatusOK, profile)
}

func getCompanyProfileHandler(w http.ResponseWriter, r *http.Request) {
	if !requireDB(w) {
		return
	}
	userID, _, ok := currentUser(w, r)
	if !ok {
		return
	}
	profile, err := loadCompanyProfile(userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load company profile")
		return
	}
	writeJSON(w, http.StatusOK, profile)
}

func putCompanyProfileHandler(w http.ResponseWriter, r *http.Request) {
	if !requireDB(w) {
		return
	}
	userID, _, ok := currentUser(w, r)
	if !ok {
		return
	}
	var req CompanyProfile
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	req.CompanyName = strings.TrimSpace(req.CompanyName)
	if req.CompanyName == "" {
		writeError(w, http.StatusBadRequest, "company_name is required")
		return
	}
	_, err := db.Exec(
		`INSERT INTO company_profiles (user_id, company_name, industry, location, website, culture)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON DUPLICATE KEY UPDATE company_name = VALUES(company_name), industry = VALUES(industry),
		   location = VALUES(location), website = VALUES(website), culture = VALUES(culture)`,
		userID, req.CompanyName, strings.TrimSpace(req.Industry), strings.TrimSpace(req.Location),
		strings.TrimSpace(req.Website), strings.TrimSpace(req.Culture),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save company profile")
		return
	}
	profile, err := loadCompanyProfile(userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to reload company profile")
		return
	}
	writeJSON(w, http.StatusOK, profile)
}

func loadStudentProfile(userID int64) (StudentProfile, error) {
	profile := StudentProfile{Skills: []SkillItem{}}
	var email string
	_ = db.QueryRow("SELECT email FROM users WHERE id = ?", userID).Scan(&email)
	profile.Email = email

	var dob sql.NullTime
	var skillsJSON sql.NullString
	var resumeURL sql.NullString
	err := db.QueryRow(
		`SELECT first_name, last_name, nickname, dob, phone, contact_email, university, major,
		        IFNULL(address, ''), github, skills, resume_url
		 FROM student_profiles WHERE user_id = ?`,
		userID,
	).Scan(
		&profile.FirstName, &profile.LastName, &profile.Nickname, &dob, &profile.Phone,
		&profile.Email, &profile.University, &profile.Major, &profile.Address, &profile.Github,
		&skillsJSON, &resumeURL,
	)
	if err == sql.ErrNoRows {
		profile.Email = email
	} else if err != nil {
		return profile, err
	} else {
		if strings.TrimSpace(profile.Email) == "" {
			profile.Email = email
		}
		if dob.Valid {
			profile.DOB = dob.Time.Format("2006-01-02")
		}
		if resumeURL.Valid {
			profile.ResumeURL = resumeURL.String
		}
		if skillsJSON.Valid && strings.TrimSpace(skillsJSON.String) != "" {
			_ = json.Unmarshal([]byte(skillsJSON.String), &profile.Skills)
			if profile.Skills == nil {
				profile.Skills = []SkillItem{}
			}
		}
	}

	profile.Internship = loadStudentInternship(userID)
	return profile, nil
}

func loadStudentInternship(userID int64) *Internship {
	var intern Internship
	err := db.QueryRow(
		`SELECT job_title, company, status FROM applications
		 WHERE student_id = ? AND status IN ('Matched', 'Completed')
		 ORDER BY id DESC LIMIT 1`,
		userID,
	).Scan(&intern.JobTitle, &intern.Company, &intern.Status)
	if err != nil {
		return nil
	}
	return &intern
}

func loadCompanyProfile(userID int64) (CompanyProfile, error) {
	var p CompanyProfile
	err := db.QueryRow(
		`SELECT company_name, industry, location, website, IFNULL(culture, '')
		 FROM company_profiles WHERE user_id = ?`,
		userID,
	).Scan(&p.CompanyName, &p.Industry, &p.Location, &p.Website, &p.Culture)
	if err == sql.ErrNoRows {
		return CompanyProfile{}, nil
	}
	return p, err
}

func upsertStudentProfile(userID int64, profile StudentProfile, replaceSkills bool) error {
	var existingSkills sql.NullString
	_ = db.QueryRow("SELECT skills FROM student_profiles WHERE user_id = ?", userID).Scan(&existingSkills)

	skills := profile.Skills
	if skills == nil {
		skills = []SkillItem{}
	}
	skillsJSON, err := json.Marshal(skills)
	if err != nil {
		return err
	}
	if !replaceSkills && existingSkills.Valid && strings.TrimSpace(existingSkills.String) != "" && len(profile.Skills) == 0 {
		skillsJSON = []byte(existingSkills.String)
	}

	var dob interface{}
	if strings.TrimSpace(profile.DOB) == "" {
		dob = nil
	} else if _, parseErr := time.Parse("2006-01-02", profile.DOB); parseErr != nil {
		dob = nil
	} else {
		dob = profile.DOB
	}

	_, err = db.Exec(
		`INSERT INTO student_profiles
		 (user_id, first_name, last_name, nickname, dob, phone, contact_email, university, major, address, github, skills, resume_url)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON DUPLICATE KEY UPDATE
		   first_name = VALUES(first_name),
		   last_name = VALUES(last_name),
		   nickname = VALUES(nickname),
		   dob = VALUES(dob),
		   phone = VALUES(phone),
		   contact_email = VALUES(contact_email),
		   university = VALUES(university),
		   major = VALUES(major),
		   address = VALUES(address),
		   github = VALUES(github),
		   skills = IF(? = 1, VALUES(skills), skills),
		   resume_url = IF(VALUES(resume_url) = '' OR VALUES(resume_url) IS NULL, resume_url, VALUES(resume_url))`,
		userID, profile.FirstName, profile.LastName, profile.Nickname, dob, profile.Phone, profile.Email,
		profile.University, profile.Major, profile.Address, profile.Github, skillsJSON, profile.ResumeURL,
		boolToInt(replaceSkills || len(profile.Skills) > 0),
	)
	return err
}

func saveStudentSkills(userID int64, skills []SkillItem, resumeURL string) error {
	if skills == nil {
		skills = []SkillItem{}
	}
	skillsJSON, err := json.Marshal(skills)
	if err != nil {
		return err
	}
	_, err = db.Exec(
		`INSERT INTO student_profiles (user_id, skills, resume_url)
		 VALUES (?, ?, ?)
		 ON DUPLICATE KEY UPDATE
		   skills = VALUES(skills),
		   resume_url = IF(VALUES(resume_url) = '' OR VALUES(resume_url) IS NULL, resume_url, VALUES(resume_url))`,
		userID, skillsJSON, resumeURL,
	)
	return err
}

func loadStudentSkills(userID int64) []SkillItem {
	var raw sql.NullString
	_ = db.QueryRow("SELECT skills FROM student_profiles WHERE user_id = ?", userID).Scan(&raw)
	if !raw.Valid || strings.TrimSpace(raw.String) == "" {
		return []SkillItem{}
	}
	var skills []SkillItem
	if err := json.Unmarshal([]byte(raw.String), &skills); err != nil || skills == nil {
		return []SkillItem{}
	}
	return skills
}

func boolToInt(v bool) int {
	if v {
		return 1
	}
	return 0
}
