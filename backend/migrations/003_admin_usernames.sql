SET @dbName := DATABASE();

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'admin_users' AND column_name = 'username'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE admin_users ADD COLUMN username VARCHAR(100) NULL AFTER email', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = @dbName AND table_name = 'admin_users' AND index_name = 'uniq_admin_users_username'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE admin_users ADD UNIQUE KEY uniq_admin_users_username (username)', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
