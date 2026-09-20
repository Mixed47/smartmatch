CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('student', 'company', 'teacher') NOT NULL,
    mfa_secret VARCHAR(64) NULL,
    mfa_enabled TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Existing databases: add MFA columns if they are missing.
ALTER TABLE users ADD COLUMN mfa_secret VARCHAR(64) NULL;
ALTER TABLE users ADD COLUMN mfa_enabled TINYINT(1) NOT NULL DEFAULT 0;
