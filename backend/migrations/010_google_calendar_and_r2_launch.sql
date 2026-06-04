-- Bow Wow full-app launch foundation: Google Calendar OAuth and R2 media metadata.
-- Safe to run multiple times.

SET @dbName := DATABASE();

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'media_assets' AND column_name = 'storage_provider'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE media_assets ADD COLUMN storage_provider VARCHAR(32) NOT NULL DEFAULT ''local'' AFTER fallback_url', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'media_assets' AND column_name = 'storage_bucket'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE media_assets ADD COLUMN storage_bucket VARCHAR(191) NULL AFTER storage_provider', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'media_assets' AND column_name = 'storage_key'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE media_assets ADD COLUMN storage_key VARCHAR(255) NULL AFTER storage_bucket', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'media_assets' AND column_name = 'checksum_sha256'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE media_assets ADD COLUMN checksum_sha256 CHAR(64) NULL AFTER storage_key', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = @dbName AND table_name = 'media_assets' AND index_name = 'idx_media_assets_storage_provider'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE media_assets ADD INDEX idx_media_assets_storage_provider (storage_provider, category, created_at)', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'booking_request_attachments' AND column_name = 'storage_provider'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE booking_request_attachments ADD COLUMN storage_provider VARCHAR(32) NOT NULL DEFAULT ''local'' AFTER file_size_bytes', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'booking_request_attachments' AND column_name = 'storage_bucket'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE booking_request_attachments ADD COLUMN storage_bucket VARCHAR(191) NULL AFTER storage_provider', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'booking_request_attachments' AND column_name = 'storage_key'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE booking_request_attachments ADD COLUMN storage_key VARCHAR(255) NULL AFTER storage_bucket', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'booking_request_attachments' AND column_name = 'checksum_sha256'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE booking_request_attachments ADD COLUMN checksum_sha256 CHAR(64) NULL AFTER storage_key', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'calendar_integrations' AND column_name = 'google_account_email'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE calendar_integrations ADD COLUMN google_account_email VARCHAR(191) NULL AFTER target_calendar_reference', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'calendar_integrations' AND column_name = 'access_token_encrypted'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE calendar_integrations ADD COLUMN access_token_encrypted TEXT NULL AFTER notes', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'calendar_integrations' AND column_name = 'refresh_token_encrypted'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE calendar_integrations ADD COLUMN refresh_token_encrypted TEXT NULL AFTER access_token_encrypted', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'calendar_integrations' AND column_name = 'token_expires_at'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE calendar_integrations ADD COLUMN token_expires_at DATETIME NULL AFTER refresh_token_encrypted', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'calendar_integrations' AND column_name = 'scopes_json'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE calendar_integrations ADD COLUMN scopes_json JSON NULL AFTER token_expires_at', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'calendar_integrations' AND column_name = 'is_primary_write_target'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE calendar_integrations ADD COLUMN is_primary_write_target TINYINT(1) NOT NULL DEFAULT 0 AFTER scopes_json', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'calendar_integrations' AND column_name = 'blocks_availability'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE calendar_integrations ADD COLUMN blocks_availability TINYINT(1) NOT NULL DEFAULT 1 AFTER is_primary_write_target', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'calendar_integrations' AND column_name = 'last_availability_checked_at'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE calendar_integrations ADD COLUMN last_availability_checked_at DATETIME NULL AFTER last_synced_at', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE media_assets
SET storage_key = original_path
WHERE storage_key IS NULL
  AND original_path IS NOT NULL;

UPDATE booking_request_attachments
SET storage_key = CONCAT('booking-paperwork/', file_path)
WHERE storage_key IS NULL
  AND file_path IS NOT NULL;

INSERT INTO schema_migrations (version, applied_at)
VALUES ('010_google_calendar_and_r2_launch', NOW())
ON DUPLICATE KEY UPDATE applied_at = VALUES(applied_at);
