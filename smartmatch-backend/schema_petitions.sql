CREATE TABLE IF NOT EXISTS petitions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    type VARCHAR(50) NOT NULL,
    payload JSON NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_petitions_user_id (user_id),
    INDEX idx_petitions_type (type)
);
