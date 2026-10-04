CREATE TABLE IF NOT EXISTS swipe_decisions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id BIGINT NOT NULL,
    job_title VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    match_percentage INT NOT NULL DEFAULT 0,
    decision VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_student_job (student_id, job_title, company),
    INDEX idx_swipe_student_id (student_id)
);
