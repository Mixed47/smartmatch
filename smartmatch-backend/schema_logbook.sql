CREATE TABLE IF NOT EXISTS logbook_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    date DATE NOT NULL,
    tasks TEXT NOT NULL,
    blocker TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_logbook_student_id (student_id),
    CONSTRAINT fk_logbook_student FOREIGN KEY (student_id) REFERENCES users(id)
);
