USE daily_journal;

ALTER TABLE users
  ADD COLUMN profile_picture MEDIUMBLOB NULL AFTER password_hash,
  ADD COLUMN profile_picture_mime VARCHAR(16) NULL AFTER profile_picture;

CREATE TABLE password_reset_tokens (
  token_hash CHAR(64) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_hash),
  KEY idx_password_reset_tokens_user (user_id),
  KEY idx_password_reset_tokens_expiry (expires_at),
  CONSTRAINT fk_password_reset_tokens_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;
