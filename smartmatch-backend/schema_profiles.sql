CREATE TABLE IF NOT EXISTS student_profiles (
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_student_profiles_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS company_profiles (
    user_id INT PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL DEFAULT '',
    industry VARCHAR(255) NOT NULL DEFAULT '',
    location VARCHAR(255) NOT NULL DEFAULT '',
    website VARCHAR(255) NOT NULL DEFAULT '',
    culture TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_company_profiles_user FOREIGN KEY (user_id) REFERENCES users(id)
);
