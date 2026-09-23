CREATE TABLE IF NOT EXISTS petitions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    type VARCHAR(50) NOT NULL,
    -- Internship this petition refers to. NULL when the petition is not tied to
    -- a placement (sick leave, for example).
    application_id INT NULL,
    payload JSON NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_petitions_user_id (user_id),
    INDEX idx_petitions_type (type),
    INDEX idx_petitions_status (status),
    INDEX idx_petitions_application_id (application_id)
);

-- Migration for databases created before application_id existed.
-- ALTER TABLE petitions ADD COLUMN application_id INT NULL;
-- CREATE INDEX idx_petitions_application_id ON petitions (application_id);
