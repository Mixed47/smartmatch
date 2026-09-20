package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

const (
	roleStudent = "student"
	roleCompany = "company"
	roleTeacher = "teacher"
)

var allowedRoles = map[string]bool{
	roleStudent: true,
	roleCompany: true,
	roleTeacher: true,
}

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token  string `json:"token"`
	UserID int64  `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
}

type errorResponse struct {
	Error string `json:"error"`
}

type claims struct {
	UserID int64  `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, errorResponse{Error: message})
}

func requireDB(w http.ResponseWriter) bool {
	if db == nil {
		writeError(w, http.StatusServiceUnavailable, "database is not available")
		return false
	}
	return true
}

func jwtSecret() ([]byte, error) {
	secret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if secret == "" {
		secret = "smartmatch-dev-jwt-secret-change-me"
	}
	return []byte(secret), nil
}

func generateJWT(userID int64, role string) (string, error) {
	secret, err := jwtSecret()
	if err != nil {
		return "", err
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	})

	return token.SignedString(secret)
}

func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		writeError(w, http.StatusServiceUnavailable, "database is not available")
		return
	}

	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Role = strings.TrimSpace(strings.ToLower(req.Role))

	if req.Email == "" || req.Password == "" || req.Role == "" {
		writeError(w, http.StatusBadRequest, "email, password, and role are required")
		return
	}
	if !allowedRoles[req.Role] {
		writeError(w, http.StatusBadRequest, "role must be student, company, or teacher")
		return
	}
	if len(req.Password) < 8 {
		writeError(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}

	var existingID int64
	err := db.QueryRow("SELECT id FROM users WHERE email = ?", req.Email).Scan(&existingID)
	if err == nil {
		writeError(w, http.StatusConflict, "email is already registered")
		return
	}
	if err != sql.ErrNoRows {
		writeError(w, http.StatusInternalServerError, "failed to check existing email")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	result, err := db.Exec(
		"INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
		req.Email, string(hash), req.Role,
	)
	if err != nil {
		var mysqlErr *mysql.MySQLError
		if errors.As(err, &mysqlErr) && mysqlErr.Number == 1062 {
			writeError(w, http.StatusConflict, "email is already registered")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to create user")
		return
	}

	userID, err := result.LastInsertId()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read created user")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "registered successfully",
		"user_id": userID,
		"email":   req.Email,
		"role":    req.Role,
	})
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		writeError(w, http.StatusServiceUnavailable, "database is not available")
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "email and password are required")
		return
	}

	var userID int64
	var passwordHash string
	var role string
	err := db.QueryRow(
		"SELECT id, password_hash, role FROM users WHERE email = ?",
		req.Email,
	).Scan(&userID, &passwordHash, &role)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to query user")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	token, err := generateJWT(userID, role)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	writeJSON(w, http.StatusOK, AuthResponse{
		Token:  token,
		UserID: userID,
		Email:  req.Email,
		Role:   role,
	})
}

type ctxKey string

const (
	ctxUserID ctxKey = "user_id"
	ctxRole   ctxKey = "role"
)

func userIDFromContext(ctx context.Context) (int64, bool) {
	id, ok := ctx.Value(ctxUserID).(int64)
	return id, ok && id > 0
}

func roleFromContext(ctx context.Context) string {
	role, _ := ctx.Value(ctxRole).(string)
	return role
}

func requireRoles(roles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]bool, len(roles))
	for _, role := range roles {
		allowed[role] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role := roleFromContext(r.Context())
			if !allowed[role] {
				writeError(w, http.StatusForbidden, "forbidden")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func authed(h http.HandlerFunc, roles ...string) http.Handler {
	handler := http.Handler(http.HandlerFunc(h))
	if len(roles) > 0 {
		handler = requireRoles(roles...)(handler)
	}
	return jwtAuthMiddleware(handler)
}

func currentUser(w http.ResponseWriter, r *http.Request) (int64, string, bool) {
	id, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "not logged in")
		return 0, "", false
	}
	return id, roleFromContext(r.Context()), true
}

func jwtAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := strings.TrimSpace(r.Header.Get("Authorization"))
		if header == "" {
			writeError(w, http.StatusUnauthorized, "not logged in")
			return
		}
		if !strings.HasPrefix(header, "Bearer ") {
			writeError(w, http.StatusUnauthorized, "missing or invalid Authorization header")
			return
		}

		secret, err := jwtSecret()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "JWT is not configured")
			return
		}

		rawToken := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
		if rawToken == "" {
			writeError(w, http.StatusUnauthorized, "not logged in")
			return
		}

		parsed, err := jwt.ParseWithClaims(rawToken, &claims{}, func(t *jwt.Token) (interface{}, error) {
			if t.Method != jwt.SigningMethodHS256 {
				return nil, errors.New("unexpected signing method")
			}
			return secret, nil
		})
		if err != nil {
			if errors.Is(err, jwt.ErrTokenExpired) {
				writeError(w, http.StatusUnauthorized, "token expired")
				return
			}
			writeError(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}
		if parsed == nil || !parsed.Valid {
			writeError(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}

		tokenClaims, ok := parsed.Claims.(*claims)
		if !ok || tokenClaims.UserID <= 0 {
			writeError(w, http.StatusUnauthorized, "invalid token claims")
			return
		}

		ctx := context.WithValue(r.Context(), ctxUserID, tokenClaims.UserID)
		ctx = context.WithValue(ctx, ctxRole, tokenClaims.Role)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
