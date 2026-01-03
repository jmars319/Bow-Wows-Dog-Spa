-- Bow Wow's Dog Spa master schema (idempotent)
-- Safe to run multiple times via phpMyAdmin or CLI.

SET NAMES utf8mb4;
SET @dbName := DATABASE();

CREATE TABLE IF NOT EXISTS admin_users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(191) NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('super_admin', 'manager', 'scheduler', 'content_editor') NOT NULL DEFAULT 'manager',
    is_enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    last_login_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_user_id INT UNSIGNED NULL,
    action VARCHAR(191) NOT NULL,
    entity_type VARCHAR(191) NOT NULL,
    entity_id INT NULL,
    metadata_json JSON NULL,
    ip VARCHAR(64) NULL,
    user_agent VARCHAR(255) NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_audit_admin (admin_user_id),
    CONSTRAINT fk_audit_admin FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS site_settings (
    `key` VARCHAR(100) PRIMARY KEY,
    `value` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS content_blocks (
    `key` VARCHAR(100) PRIMARY KEY,
    content_json JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS retail_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    description TEXT NULL,
    price_cents INT NULL,
    media_id INT NULL,
    is_featured TINYINT(1) NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    is_published TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS media_assets (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    original_path VARCHAR(255) NOT NULL,
    original_url VARCHAR(255) NULL,
    variants_json JSON NULL,
    mime_type VARCHAR(100) NULL,
    intrinsic_width INT NULL,
    intrinsic_height INT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'default',
    title VARCHAR(255) NULL,
    caption TEXT NULL,
    alt_text VARCHAR(255) NULL,
    responsive_variants_json JSON NULL,
    manifest_path VARCHAR(255) NULL,
    optimized_srcset TEXT NULL,
    webp_srcset TEXT NULL,
    fallback_url VARCHAR(255) NULL,
    created_by INT UNSIGNED NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_media_creator (created_by),
    CONSTRAINT fk_media_admin FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS happy_clients (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(191) NOT NULL,
    blurb TEXT NULL,
    before_media_id INT NULL,
    after_media_id INT NULL,
    tags JSON NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_published TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS contact_messages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    email VARCHAR(191) NOT NULL,
    phone VARCHAR(50) NULL,
    message TEXT NOT NULL,
    created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS schedule_weekday_templates (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    weekday TINYINT UNSIGNED NOT NULL,
    times_json JSON NOT NULL,
    capacity_json JSON NULL,
    is_enabled TINYINT(1) NOT NULL DEFAULT 1,
    UNIQUE KEY unique_weekday (weekday)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS schedule_date_overrides (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    is_closed TINYINT(1) NOT NULL DEFAULT 0,
    times_json JSON NULL,
    capacity_json JSON NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS booking_holds (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    time TIME NOT NULL,
    expires_at DATETIME NOT NULL,
    token CHAR(64) NOT NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_hold_date_time (date, time),
    INDEX idx_hold_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS booking_requests (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    time TIME NOT NULL,
    end_time TIME NULL,
    customer_name VARCHAR(191) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(191) NOT NULL,
    dog_name VARCHAR(191) NULL,
    dog_notes TEXT NULL,
    services_json JSON NULL,
    status ENUM('pending_confirmation', 'confirmed', 'declined', 'cancelled', 'expired') NOT NULL DEFAULT 'pending_confirmation',
    admin_notes TEXT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_booking_date_time (date, time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(64) PRIMARY KEY,
    applied_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Column backfills for legacy databases
-- admin_users.display_name
SET @needs_display := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'admin_users' AND column_name = 'display_name'
);
SET @ddl := IF(@needs_display = 0, 'ALTER TABLE admin_users ADD COLUMN display_name VARCHAR(191) NULL AFTER email', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- helper to add a column if missing
SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'media_assets' AND column_name = 'original_url'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE media_assets ADD COLUMN original_url VARCHAR(255) NULL AFTER original_path', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'media_assets' AND column_name = 'mime_type'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE media_assets ADD COLUMN mime_type VARCHAR(100) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'media_assets' AND column_name = 'intrinsic_width'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE media_assets ADD COLUMN intrinsic_width INT NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'media_assets' AND column_name = 'intrinsic_height'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE media_assets ADD COLUMN intrinsic_height INT NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'media_assets' AND column_name = 'category'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE media_assets ADD COLUMN category VARCHAR(100) NOT NULL DEFAULT ''default''', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'media_assets' AND column_name = 'title'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE media_assets ADD COLUMN title VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'media_assets' AND column_name = 'caption'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE media_assets ADD COLUMN caption TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'media_assets' AND column_name = 'responsive_variants_json'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE media_assets ADD COLUMN responsive_variants_json JSON NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'media_assets' AND column_name = 'manifest_path'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE media_assets ADD COLUMN manifest_path VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'media_assets' AND column_name = 'optimized_srcset'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE media_assets ADD COLUMN optimized_srcset TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'media_assets' AND column_name = 'webp_srcset'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE media_assets ADD COLUMN webp_srcset TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'media_assets' AND column_name = 'fallback_url'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE media_assets ADD COLUMN fallback_url VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- default site settings for booking windows
INSERT INTO site_settings (`key`, `value`)
VALUES
    ('booking_hold_minutes', '1440'),
    ('booking_pending_expire_hours', '24')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);

INSERT IGNORE INTO schema_migrations (version, applied_at)
VALUES ('master_20250130_01', NOW());
