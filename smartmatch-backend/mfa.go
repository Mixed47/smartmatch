package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image/png"
	"net/http"
	"strings"
	"time"
	"unicode"

	"github.com/golang-jwt/jwt/v5"
	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
)

const (
	mfaIssuer       = "AI-InternMatch"
	tokenPurposeMFA = "mfa"
)

type VerifyMFARequest struct {
	MFAToken string `json:"mfa_token"`
	Code     string `json:"code"`
}

func ensureMFAColumns() {
	if db == nil {
		return
	}
	statements := []string{
		"ALTER TABLE users ADD COLUMN mfa_secret VARCHAR(64) NULL",
		"ALTER TABLE users ADD COLUMN mfa_enabled TINYINT(1) NOT NULL DEFAULT 0",
	}
	for _, stmt := range statements {
		if _, err := db.Exec(stmt); err != nil && !isDuplicateSchemaErr(err) {
			fmt.Println("mfa schema migrate:", err)
		}
	}
}

func generateTOTPSetup(email string) (secret, otpauthURL, qrDataURL string, err error) {
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      mfaIssuer,
		AccountName: email,
		Period:      30,
		SecretSize:  20,
		Digits:      otp.DigitsSix,
		Algorithm:   otp.AlgorithmSHA1,
	})
	if err != nil {
		return "", "", "", err
	}

	img, err := key.Image(240, 240)
	if err != nil {
		return key.Secret(), key.URL(), "", err
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return key.Secret(), key.URL(), "", err
	}
	qrDataURL = "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())
	return key.Secret(), key.URL(), qrDataURL, nil
}

func generateMFAToken(userID int64, role string) (string, error) {
	secret, err := jwtSecret()
	if err != nil {
		return "", err
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims{
		UserID:  userID,
		Role:    role,
		Purpose: tokenPurposeMFA,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(5 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	})
	return token.SignedString(secret)
}

func parseTokenClaims(rawToken string) (*claims, error) {
	secret, err := jwtSecret()
	if err != nil {
		return nil, err
	}
	parsed, err := jwt.ParseWithClaims(strings.TrimSpace(rawToken), &claims{}, func(t *jwt.Token) (interface{}, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return secret, nil
	})
	if err != nil {
		return nil, err
	}
	tokenClaims, ok := parsed.Claims.(*claims)
	if !ok || parsed == nil || !parsed.Valid || tokenClaims.UserID <= 0 {
		return nil, fmt.Errorf("invalid token claims")
	}
	return tokenClaims, nil
}

func normalizeOTPCode(code string) string {
	var b strings.Builder
	for _, r := range strings.TrimSpace(code) {
		if unicode.IsDigit(r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func writeMFAChallenge(w http.ResponseWriter, userID int64, email, role, otpauthURL, qrDataURL string) {
	mfaToken, err := generateMFAToken(userID, role)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to start MFA challenge")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"require_mfa":    true,
		"mfa_token":      mfaToken,
		"user_id":        userID,
		"email":          email,
		"role":           role,
		"otpauth_url":    otpauthURL,
		"qr_image_base64": qrDataURL,
		"message":        "กรุณากรอกรหัส 6 หลักจากแอป Authenticator",
	})
}

func VerifyMFAHandler(w http.ResponseWriter, r *http.Request) {
	if !requireDB(w) {
		return
	}

	var req VerifyMFARequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	code := normalizeOTPCode(req.Code)
	if strings.TrimSpace(req.MFAToken) == "" || len(code) != 6 {
		writeError(w, http.StatusBadRequest, "mfa_token and a 6-digit code are required")
		return
	}

	tokenClaims, err := parseTokenClaims(req.MFAToken)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "MFA session expired or invalid")
		return
	}
	if tokenClaims.Purpose != tokenPurposeMFA {
		writeError(w, http.StatusUnauthorized, "invalid MFA token")
		return
	}

	var email, role, secret string
	var enabled bool
	err = db.QueryRow(
		"SELECT email, role, IFNULL(mfa_secret, ''), IFNULL(mfa_enabled, 0) FROM users WHERE id = ?",
		tokenClaims.UserID,
	).Scan(&email, &role, &secret, &enabled)
	if err != nil || secret == "" {
		writeError(w, http.StatusUnauthorized, "MFA is not set up for this account")
		return
	}

	ok, err := totp.ValidateCustom(code, secret, time.Now().UTC(), totp.ValidateOpts{
		Period:    30,
		Skew:      1,
		Digits:    otp.DigitsSix,
		Algorithm: otp.AlgorithmSHA1,
	})
	if err != nil || !ok {
		writeError(w, http.StatusUnauthorized, "รหัส MFA ไม่ถูกต้องหรือหมดอายุ")
		return
	}

	if !enabled {
		if _, err := db.Exec("UPDATE users SET mfa_enabled = 1 WHERE id = ?", tokenClaims.UserID); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to enable MFA")
			return
		}
	}

	accessToken, err := generateJWT(tokenClaims.UserID, role)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	writeJSON(w, http.StatusOK, AuthResponse{
		Token:  accessToken,
		UserID: tokenClaims.UserID,
		Email:  email,
		Role:   role,
	})
}
