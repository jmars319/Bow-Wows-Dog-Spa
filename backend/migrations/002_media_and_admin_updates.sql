SET @dbName := DATABASE();

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

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'admin_users' AND column_name = 'display_name'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE admin_users ADD COLUMN display_name VARCHAR(191) NULL AFTER email', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
