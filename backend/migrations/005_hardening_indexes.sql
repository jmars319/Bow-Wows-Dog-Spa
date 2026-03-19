SET @dbName := DATABASE();

SET @exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = @dbName AND table_name = 'booking_holds' AND index_name = 'idx_hold_date_expires'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE booking_holds ADD INDEX idx_hold_date_expires (date, expires_at)', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = @dbName AND table_name = 'booking_requests' AND index_name = 'idx_booking_status_created'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE booking_requests ADD INDEX idx_booking_status_created (status, created_at)', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = @dbName AND table_name = 'services' AND index_name = 'idx_services_active_sort'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE services ADD INDEX idx_services_active_sort (is_active, sort_order, created_at, id)', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
