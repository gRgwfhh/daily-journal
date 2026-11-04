USE daily_journal;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(32) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash CHAR(64) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_hash),
  KEY idx_auth_sessions_user (user_id),
  KEY idx_auth_sessions_expiry (expires_at),
  CONSTRAINT fk_auth_sessions_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

ALTER TABLE hobbies
  DROP INDEX uq_hobbies_name,
  ADD COLUMN user_id INT UNSIGNED NULL AFTER id,
  ADD UNIQUE KEY uq_hobbies_user_name (user_id, name),
  ADD CONSTRAINT fk_hobbies_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE;

ALTER TABLE memorable_moments
  DROP PRIMARY KEY,
  ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
  ADD COLUMN user_id INT UNSIGNED NULL AFTER id,
  ADD PRIMARY KEY (id),
  ADD UNIQUE KEY uq_moments_user_date (user_id, moment_date),
  ADD KEY idx_moments_date (moment_date),
  ADD CONSTRAINT fk_moments_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE;

ALTER TABLE sleep_records
  DROP PRIMARY KEY,
  ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
  ADD COLUMN user_id INT UNSIGNED NULL AFTER id,
  ADD PRIMARY KEY (id),
  ADD UNIQUE KEY uq_sleep_user_date (user_id, sleep_date),
  ADD KEY idx_sleep_date (sleep_date),
  ADD CONSTRAINT fk_sleep_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE;
