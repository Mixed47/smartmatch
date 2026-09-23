package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
)

const maxMessageLength = 2000

// Message is one entry of the universal inbox shared by every role.
type Message struct {
	ID         int64  `json:"id"`
	SenderID   int64  `json:"sender_id"`
	ReceiverID int64  `json:"receiver_id"`
	SenderName string `json:"sender_name"`
	SenderRole string `json:"sender_role"`
	Body       string `json:"body"`
	Mine       bool   `json:"mine"`
	IsRead     bool   `json:"is_read"`
	CreatedAt  string `json:"created_at"`
}

// MessageContact is a person the current user can talk to, plus the preview
// data the inbox list needs.
type MessageContact struct {
	UserID      int64  `json:"user_id"`
	Name        string `json:"name"`
	Email       string `json:"email"`
	Role        string `json:"role"`
	LastMessage string `json:"last_message"`
	LastAt      string `json:"last_at"`
	UnreadCount int    `json:"unread_count"`
	lastID      int64
}

func ensureMessagesTable() {
	if db == nil {
		return
	}
	// user ids are kept as plain BIGINT (no FK) to stay consistent with the
	// other ownership columns added by ensureOwnershipColumns.
	_, _ = db.Exec(`CREATE TABLE IF NOT EXISTS messages (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		sender_id BIGINT NOT NULL,
		receiver_id BIGINT NOT NULL,
		body TEXT NOT NULL,
		is_read TINYINT(1) NOT NULL DEFAULT 0,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		INDEX idx_messages_receiver (receiver_id, is_read),
		INDEX idx_messages_thread (sender_id, receiver_id, id)
	)`)
}

func displayNameFor(role, email, studentName, companyName string) string {
	if role == roleCompany {
		if name := strings.TrimSpace(companyName); name != "" {
			return name
		}
	}
	if name := strings.TrimSpace(studentName); name != "" {
		return name
	}
	if email = strings.TrimSpace(email); email != "" {
		return email
	}
	return "ผู้ใช้ไม่ระบุชื่อ"
}

// listMessageContactsHandler returns every other account with its conversation
// preview, newest conversation first and untouched contacts afterwards.
func listMessageContactsHandler(w http.ResponseWriter, r *http.Request) {
	if !requireDB(w) {
		return
	}
	userID, _, ok := currentUser(w, r)
	if !ok {
		return
	}

	rows, err := db.Query(
		`SELECT u.id, u.email, u.role,
		        TRIM(CONCAT(IFNULL(sp.first_name, ''), ' ', IFNULL(sp.last_name, ''))),
		        IFNULL(cp.company_name, '')
		 FROM users u
		 LEFT JOIN student_profiles sp ON sp.user_id = u.id
		 LEFT JOIN company_profiles cp ON cp.user_id = u.id
		 WHERE u.id <> ?
		 ORDER BY u.role, u.email`,
		userID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load contacts")
		return
	}
	defer rows.Close()

	contacts := []*MessageContact{}
	byID := map[int64]*MessageContact{}
	for rows.Next() {
		var c MessageContact
		var studentName, companyName sql.NullString
		if err := rows.Scan(&c.UserID, &c.Email, &c.Role, &studentName, &companyName); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to read contacts")
			return
		}
		c.Name = displayNameFor(c.Role, c.Email, studentName.String, companyName.String)
		contacts = append(contacts, &c)
		byID[c.UserID] = &c
	}

	if err := fillConversationPreviews(userID, byID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load conversations")
		return
	}

	// Conversations with history bubble to the top, ordered by latest message.
	sortContacts(contacts)
	writeJSON(w, http.StatusOK, contacts)
}

func sortContacts(contacts []*MessageContact) {
	for i := 1; i < len(contacts); i++ {
		for j := i; j > 0 && contactRanksBefore(contacts[j], contacts[j-1]); j-- {
			contacts[j], contacts[j-1] = contacts[j-1], contacts[j]
		}
	}
}

func contactRanksBefore(a, b *MessageContact) bool {
	if (a.lastID > 0) != (b.lastID > 0) {
		return a.lastID > 0
	}
	if a.lastID != b.lastID {
		return a.lastID > b.lastID
	}
	return false
}

func fillConversationPreviews(userID int64, byID map[int64]*MessageContact) error {
	if len(byID) == 0 {
		return nil
	}
	rows, err := db.Query(
		`SELECT IF(sender_id = ?, receiver_id, sender_id) AS peer_id,
		        MAX(id) AS last_id,
		        CAST(SUM(receiver_id = ? AND is_read = 0) AS SIGNED) AS unread
		 FROM messages
		 WHERE sender_id = ? OR receiver_id = ?
		 GROUP BY peer_id`,
		userID, userID, userID, userID,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	lastIDs := []int64{}
	for rows.Next() {
		var peerID, lastID int64
		var unread sql.NullInt64
		if err := rows.Scan(&peerID, &lastID, &unread); err != nil {
			return err
		}
		contact, known := byID[peerID]
		if !known {
			continue
		}
		contact.lastID = lastID
		contact.UnreadCount = int(unread.Int64)
		lastIDs = append(lastIDs, lastID)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if len(lastIDs) == 0 {
		return nil
	}

	placeholders := strings.TrimSuffix(strings.Repeat("?,", len(lastIDs)), ",")
	args := make([]interface{}, 0, len(lastIDs))
	for _, id := range lastIDs {
		args = append(args, id)
	}
	previewRows, err := db.Query(
		fmt.Sprintf(
			`SELECT id, body, DATE_FORMAT(created_at, '%%Y-%%m-%%d %%H:%%i')
			 FROM messages WHERE id IN (%s)`,
			placeholders,
		),
		args...,
	)
	if err != nil {
		return err
	}
	defer previewRows.Close()

	previews := map[int64][2]string{}
	for previewRows.Next() {
		var id int64
		var body, createdAt string
		if err := previewRows.Scan(&id, &body, &createdAt); err != nil {
			return err
		}
		previews[id] = [2]string{body, createdAt}
	}
	for _, contact := range byID {
		if preview, found := previews[contact.lastID]; found {
			contact.LastMessage = preview[0]
			contact.LastAt = preview[1]
		}
	}
	return previewRows.Err()
}

// listMessagesHandler returns one thread in chronological order and marks the
// messages the caller received as read.
func listMessagesHandler(w http.ResponseWriter, r *http.Request) {
	if !requireDB(w) {
		return
	}
	userID, _, ok := currentUser(w, r)
	if !ok {
		return
	}

	peerID, err := strconv.ParseInt(strings.TrimSpace(r.URL.Query().Get("with")), 10, 64)
	if err != nil || peerID <= 0 {
		writeError(w, http.StatusBadRequest, "with must be a valid user id")
		return
	}
	if peerID == userID {
		writeError(w, http.StatusBadRequest, "cannot open a thread with yourself")
		return
	}

	rows, err := db.Query(
		`SELECT m.id, m.sender_id, m.receiver_id, m.body, m.is_read,
		        DATE_FORMAT(m.created_at, '%Y-%m-%d %H:%i'),
		        u.role, u.email,
		        TRIM(CONCAT(IFNULL(sp.first_name, ''), ' ', IFNULL(sp.last_name, ''))),
		        IFNULL(cp.company_name, '')
		 FROM messages m
		 JOIN users u ON u.id = m.sender_id
		 LEFT JOIN student_profiles sp ON sp.user_id = m.sender_id
		 LEFT JOIN company_profiles cp ON cp.user_id = m.sender_id
		 WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
		 ORDER BY m.id ASC`,
		userID, peerID, peerID, userID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load messages")
		return
	}
	defer rows.Close()

	messages := []Message{}
	for rows.Next() {
		var m Message
		var senderEmail string
		var studentName, companyName sql.NullString
		if err := rows.Scan(
			&m.ID, &m.SenderID, &m.ReceiverID, &m.Body, &m.IsRead, &m.CreatedAt,
			&m.SenderRole, &senderEmail, &studentName, &companyName,
		); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to read messages")
			return
		}
		m.SenderName = displayNameFor(m.SenderRole, senderEmail, studentName.String, companyName.String)
		m.Mine = m.SenderID == userID
		messages = append(messages, m)
	}

	_, _ = db.Exec(
		"UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ? AND is_read = 0",
		userID, peerID,
	)
	writeJSON(w, http.StatusOK, messages)
}

func sendMessageHandler(w http.ResponseWriter, r *http.Request) {
	if !requireDB(w) {
		return
	}
	userID, _, ok := currentUser(w, r)
	if !ok {
		return
	}

	var req struct {
		ReceiverID int64  `json:"receiver_id"`
		Body       string `json:"body"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	req.Body = strings.TrimSpace(req.Body)
	if req.Body == "" {
		writeError(w, http.StatusBadRequest, "body is required")
		return
	}
	if len([]rune(req.Body)) > maxMessageLength {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("body must be at most %d characters", maxMessageLength))
		return
	}
	if req.ReceiverID <= 0 || req.ReceiverID == userID {
		writeError(w, http.StatusBadRequest, "receiver_id must be another user")
		return
	}

	var exists int
	if err := db.QueryRow("SELECT COUNT(*) FROM users WHERE id = ?", req.ReceiverID).Scan(&exists); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to verify receiver")
		return
	}
	if exists == 0 {
		writeError(w, http.StatusNotFound, "receiver not found")
		return
	}

	result, err := db.Exec(
		"INSERT INTO messages (sender_id, receiver_id, body) VALUES (?, ?, ?)",
		userID, req.ReceiverID, req.Body,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to send message")
		return
	}
	id, _ := result.LastInsertId()
	writeJSON(w, http.StatusCreated, map[string]interface{}{"success": true, "id": id})
}

func unreadMessagesHandler(w http.ResponseWriter, r *http.Request) {
	if !requireDB(w) {
		return
	}
	userID, _, ok := currentUser(w, r)
	if !ok {
		return
	}
	var unread int
	if err := db.QueryRow(
		"SELECT COUNT(*) FROM messages WHERE receiver_id = ? AND is_read = 0",
		userID,
	).Scan(&unread); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to count unread messages")
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"unread_count": unread})
}
