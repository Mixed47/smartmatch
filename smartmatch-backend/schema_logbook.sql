CREATE TABLE IF NOT EXISTS logbook_entries (
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
);

ALTER TABLE logbook_entries ADD COLUMN ai_feedback TEXT;
ALTER TABLE logbook_entries ADD COLUMN ai_score VARCHAR(32);
ALTER TABLE logbook_entries ADD COLUMN ai_is_critical TINYINT(1);
ALTER TABLE logbook_entries ADD COLUMN ai_evaluated_at TIMESTAMP NULL;
ALTER TABLE logbook_entries ADD COLUMN is_acknowledged TINYINT(1) NOT NULL DEFAULT 0;
