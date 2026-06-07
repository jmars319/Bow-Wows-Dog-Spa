-- Bow Wow admin booking convenience fields.
-- Safe to run multiple times.

SET @dbName := DATABASE();

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'booking_requests' AND column_name = 'is_internal_test'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE booking_requests ADD COLUMN is_internal_test TINYINT(1) NOT NULL DEFAULT 0 AFTER paperwork_notes', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'booking_requests' AND column_name = 'source'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE booking_requests ADD COLUMN source VARCHAR(64) NOT NULL DEFAULT ''public'' AFTER is_internal_test', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = @dbName AND table_name = 'booking_requests' AND index_name = 'idx_booking_test_status_created'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE booking_requests ADD INDEX idx_booking_test_status_created (is_internal_test, status, created_at)', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO schema_migrations (version, applied_at)
VALUES ('012_admin_booking_convenience', NOW())
ON DUPLICATE KEY UPDATE applied_at = VALUES(applied_at);
