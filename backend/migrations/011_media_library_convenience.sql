-- Bow Wow media library convenience fields.
-- Safe to run multiple times.

SET @dbName := DATABASE();

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'media_assets' AND column_name = 'archived_at'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE media_assets ADD COLUMN archived_at DATETIME NULL AFTER checksum_sha256', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'media_assets' AND column_name = 'focal_x'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE media_assets ADD COLUMN focal_x DECIMAL(5,2) NULL AFTER archived_at', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'media_assets' AND column_name = 'focal_y'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE media_assets ADD COLUMN focal_y DECIMAL(5,2) NULL AFTER focal_x', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'media_assets' AND column_name = 'health_status'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE media_assets ADD COLUMN health_status VARCHAR(32) NULL AFTER focal_y', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'media_assets' AND column_name = 'last_verified_at'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE media_assets ADD COLUMN last_verified_at DATETIME NULL AFTER health_status', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = @dbName AND table_name = 'media_assets' AND index_name = 'idx_media_assets_archived_category'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE media_assets ADD INDEX idx_media_assets_archived_category (archived_at, category, created_at)', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = @dbName AND table_name = 'media_assets' AND index_name = 'idx_media_assets_checksum'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE media_assets ADD INDEX idx_media_assets_checksum (checksum_sha256)', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO schema_migrations (version, applied_at)
VALUES ('011_media_library_convenience', NOW())
ON DUPLICATE KEY UPDATE applied_at = VALUES(applied_at);
