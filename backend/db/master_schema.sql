-- Bow Wow's Dog Spa master schema (idempotent)
-- Safe to run multiple times via phpMyAdmin or CLI.

SET NAMES utf8mb4;
SET @dbName := DATABASE();

CREATE TABLE IF NOT EXISTS admin_users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NULL,
    display_name VARCHAR(191) NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('super_admin', 'manager', 'scheduler', 'content_editor') NOT NULL DEFAULT 'manager',
    is_enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    last_login_at DATETIME NULL,
    UNIQUE KEY uniq_admin_users_username (username)
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

CREATE TABLE IF NOT EXISTS retail_categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    slug VARCHAR(191) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_published TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uniq_retail_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS retail_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_id INT UNSIGNED NULL,
    name VARCHAR(191) NOT NULL,
    sku VARCHAR(100) NULL,
    description TEXT NULL,
    price_cents INT NULL,
    media_id INT NULL,
    online_sale_status ENUM('catalog_only', 'ready', 'in_store_only') NOT NULL DEFAULT 'catalog_only',
    inventory_status ENUM('untracked', 'in_stock', 'limited', 'out_of_stock') NOT NULL DEFAULT 'untracked',
    fulfillment_mode ENUM('undecided', 'pickup_only', 'ship_or_pickup') NOT NULL DEFAULT 'undecided',
    is_featured TINYINT(1) NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    is_published TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uniq_retail_items_sku (sku),
    INDEX idx_retail_items_category_sort (category_id, sort_order, created_at),
    CONSTRAINT fk_retail_items_category FOREIGN KEY (category_id) REFERENCES retail_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS retail_item_variants (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    retail_item_id INT UNSIGNED NOT NULL,
    label VARCHAR(191) NOT NULL,
    sku VARCHAR(100) NULL,
    price_cents INT NULL,
    inventory_status ENUM('untracked', 'in_stock', 'limited', 'out_of_stock') NOT NULL DEFAULT 'untracked',
    stock_quantity INT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_retail_item_variants_item_sort (retail_item_id, is_active, sort_order, created_at),
    UNIQUE KEY uniq_retail_item_variants_sku (sku),
    CONSTRAINT fk_retail_item_variants_item FOREIGN KEY (retail_item_id) REFERENCES retail_items(id) ON DELETE CASCADE
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
    end_time TIME NULL,
    expires_at DATETIME NOT NULL,
    token CHAR(64) NOT NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_hold_date_time (date, time),
    INDEX idx_hold_date_expires (date, expires_at),
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
    pets_json JSON NULL,
    services_json JSON NULL,
    total_duration_minutes INT NOT NULL DEFAULT 30,
    vet_name VARCHAR(191) NULL,
    vet_phone VARCHAR(50) NULL,
    request_notes TEXT NULL,
    paperwork_notes TEXT NULL,
    status ENUM('pending_confirmation', 'confirmed', 'declined', 'cancelled', 'expired', 'completed') NOT NULL DEFAULT 'pending_confirmation',
    admin_notes TEXT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_booking_date_time (date, time),
    INDEX idx_booking_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS booking_request_attachments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_request_id BIGINT UNSIGNED NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    INDEX idx_booking_attachment_booking (booking_request_id),
    CONSTRAINT fk_booking_attachment_booking FOREIGN KEY (booking_request_id) REFERENCES booking_requests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS services (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    short_summary TEXT NULL,
    description TEXT NULL,
    duration_minutes INT NOT NULL DEFAULT 30,
    price_label VARCHAR(100) NULL,
    breed_weight_note VARCHAR(191) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_services_active_sort (is_active, sort_order, created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS featured_reviews (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reviewer_name VARCHAR(191) NOT NULL,
    review_text TEXT NOT NULL,
    star_rating TINYINT UNSIGNED NOT NULL DEFAULT 5,
    source_label VARCHAR(100) NOT NULL DEFAULT 'Google',
    source_url VARCHAR(255) NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_featured TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gallery_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(191) NOT NULL,
    caption TEXT NULL,
    item_type VARCHAR(50) NOT NULL DEFAULT 'groomed_pet',
    primary_media_id INT UNSIGNED NULL,
    secondary_media_id INT UNSIGNED NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_published TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_gallery_primary_media (primary_media_id),
    INDEX idx_gallery_secondary_media (secondary_media_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS calendar_integrations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,
    label VARCHAR(191) NOT NULL,
    target_calendar_name VARCHAR(191) NULL,
    target_calendar_reference VARCHAR(191) NULL,
    connection_status ENUM('not_connected', 'connected', 'error') NOT NULL DEFAULT 'not_connected',
    sync_confirmed_bookings TINYINT(1) NOT NULL DEFAULT 1,
    is_enabled TINYINT(1) NOT NULL DEFAULT 0,
    settings_json JSON NULL,
    notes TEXT NULL,
    last_synced_at DATETIME NULL,
    last_error TEXT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_calendar_integrations_provider (provider),
    INDEX idx_calendar_integrations_enabled (is_enabled, connection_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS calendar_sync_jobs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    calendar_integration_id INT UNSIGNED NOT NULL,
    booking_request_id BIGINT UNSIGNED NOT NULL,
    action ENUM('upsert_booking', 'delete_booking') NOT NULL,
    job_status ENUM('pending', 'processing', 'completed', 'failed', 'skipped') NOT NULL DEFAULT 'pending',
    payload_json JSON NULL,
    attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
    error_message TEXT NULL,
    available_at DATETIME NOT NULL,
    processed_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_calendar_sync_jobs_lookup (calendar_integration_id, booking_request_id, action, job_status),
    INDEX idx_calendar_sync_jobs_available (job_status, available_at),
    CONSTRAINT fk_calendar_sync_jobs_integration FOREIGN KEY (calendar_integration_id) REFERENCES calendar_integrations(id) ON DELETE CASCADE,
    CONSTRAINT fk_calendar_sync_jobs_booking FOREIGN KEY (booking_request_id) REFERENCES booking_requests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS calendar_sync_links (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    calendar_integration_id INT UNSIGNED NOT NULL,
    booking_request_id BIGINT UNSIGNED NOT NULL,
    external_calendar_id VARCHAR(191) NULL,
    external_event_id VARCHAR(191) NOT NULL,
    external_event_version VARCHAR(191) NULL,
    synced_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uniq_calendar_sync_link (calendar_integration_id, booking_request_id),
    INDEX idx_calendar_sync_external_event (calendar_integration_id, external_event_id),
    CONSTRAINT fk_calendar_sync_links_integration FOREIGN KEY (calendar_integration_id) REFERENCES calendar_integrations(id) ON DELETE CASCADE,
    CONSTRAINT fk_calendar_sync_links_booking FOREIGN KEY (booking_request_id) REFERENCES booking_requests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(64) PRIMARY KEY,
    applied_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Column backfills for legacy databases
-- admin_users.username
SET @needs_username := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'admin_users' AND column_name = 'username'
);
SET @ddl := IF(@needs_username = 0, 'ALTER TABLE admin_users ADD COLUMN username VARCHAR(100) NULL AFTER email', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @needs_username_index := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = @dbName AND table_name = 'admin_users' AND index_name = 'uniq_admin_users_username'
);
SET @ddl := IF(@needs_username_index = 0, 'ALTER TABLE admin_users ADD UNIQUE KEY uniq_admin_users_username (username)', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

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

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'booking_holds' AND column_name = 'end_time'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE booking_holds ADD COLUMN end_time TIME NULL AFTER time', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'booking_requests' AND column_name = 'pets_json'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE booking_requests ADD COLUMN pets_json JSON NULL AFTER dog_notes', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'booking_requests' AND column_name = 'total_duration_minutes'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE booking_requests ADD COLUMN total_duration_minutes INT NOT NULL DEFAULT 30 AFTER services_json', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'booking_requests' AND column_name = 'vet_name'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE booking_requests ADD COLUMN vet_name VARCHAR(191) NULL AFTER total_duration_minutes', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'booking_requests' AND column_name = 'vet_phone'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE booking_requests ADD COLUMN vet_phone VARCHAR(50) NULL AFTER vet_name', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'booking_requests' AND column_name = 'request_notes'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE booking_requests ADD COLUMN request_notes TEXT NULL AFTER vet_phone', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'booking_requests' AND column_name = 'paperwork_notes'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE booking_requests ADD COLUMN paperwork_notes TEXT NULL AFTER request_notes', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE BINARY table_schema = BINARY @dbName
      AND BINARY table_name = BINARY 'retail_items'
      AND BINARY column_name = BINARY 'category_id'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE retail_items ADD COLUMN category_id INT UNSIGNED NULL AFTER id', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'retail_items' AND column_name = 'sku'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE retail_items ADD COLUMN sku VARCHAR(100) NULL AFTER name', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'retail_items' AND column_name = 'online_sale_status'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE retail_items ADD COLUMN online_sale_status ENUM(''catalog_only'', ''ready'', ''in_store_only'') NOT NULL DEFAULT ''catalog_only'' AFTER media_id', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'retail_items' AND column_name = 'inventory_status'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE retail_items ADD COLUMN inventory_status ENUM(''untracked'', ''in_stock'', ''limited'', ''out_of_stock'') NOT NULL DEFAULT ''untracked'' AFTER online_sale_status', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'retail_items' AND column_name = 'fulfillment_mode'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE retail_items ADD COLUMN fulfillment_mode ENUM(''undecided'', ''pickup_only'', ''ship_or_pickup'') NOT NULL DEFAULT ''undecided'' AFTER inventory_status', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = @dbName AND table_name = 'retail_items' AND index_name = 'uniq_retail_items_sku'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE retail_items ADD UNIQUE KEY uniq_retail_items_sku (sku)', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE BINARY table_schema = BINARY @dbName
      AND BINARY table_name = BINARY 'retail_items'
      AND BINARY index_name = BINARY 'idx_retail_items_category_sort'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE retail_items ADD INDEX idx_retail_items_category_sort (category_id, sort_order, created_at)', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
    SELECT COUNT(*)
    FROM information_schema.referential_constraints
    WHERE BINARY constraint_schema = BINARY @dbName
      AND BINARY table_name = BINARY 'retail_items'
      AND BINARY constraint_name = BINARY 'fk_retail_items_category'
);
SET @ddl := IF(@exists = 0, 'ALTER TABLE retail_items ADD CONSTRAINT fk_retail_items_category FOREIGN KEY (category_id) REFERENCES retail_categories(id) ON DELETE SET NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO retail_categories (name, slug, sort_order, is_published, created_at, updated_at)
SELECT 'General', 'general', 10, 1, NOW(), NOW()
WHERE EXISTS (SELECT 1 FROM retail_items)
  AND NOT EXISTS (SELECT 1 FROM retail_categories);

SET @defaultRetailCategoryId := (
    SELECT id
    FROM retail_categories
    ORDER BY sort_order ASC, id ASC
    LIMIT 1
);

UPDATE retail_items
SET category_id = @defaultRetailCategoryId
WHERE category_id IS NULL
  AND @defaultRetailCategoryId IS NOT NULL;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = @dbName AND table_name = 'retail_item_variants'
);
SET @ddl := IF(@exists = 0, 'CREATE TABLE retail_item_variants (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    retail_item_id INT UNSIGNED NOT NULL,
    label VARCHAR(191) NOT NULL,
    sku VARCHAR(100) NULL,
    price_cents INT NULL,
    inventory_status ENUM(''''untracked'''', ''''in_stock'''', ''''limited'''', ''''out_of_stock'''') NOT NULL DEFAULT ''''untracked'''',
    stock_quantity INT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_retail_item_variants_item_sort (retail_item_id, is_active, sort_order, created_at),
    UNIQUE KEY uniq_retail_item_variants_sku (sku),
    CONSTRAINT fk_retail_item_variants_item FOREIGN KEY (retail_item_id) REFERENCES retail_items(id) ON DELETE CASCADE
)', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE booking_requests
    MODIFY COLUMN status ENUM('pending_confirmation', 'confirmed', 'declined', 'cancelled', 'expired', 'completed') NOT NULL DEFAULT 'pending_confirmation';

SET @needs_hold_expires_index := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = @dbName AND table_name = 'booking_holds' AND index_name = 'idx_hold_date_expires'
);
SET @ddl := IF(@needs_hold_expires_index = 0, 'ALTER TABLE booking_holds ADD INDEX idx_hold_date_expires (date, expires_at)', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @needs_booking_status_created_index := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = @dbName AND table_name = 'booking_requests' AND index_name = 'idx_booking_status_created'
);
SET @ddl := IF(@needs_booking_status_created_index = 0, 'ALTER TABLE booking_requests ADD INDEX idx_booking_status_created (status, created_at)', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @needs_services_active_sort_index := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = @dbName AND table_name = 'services' AND index_name = 'idx_services_active_sort'
);
SET @ddl := IF(@needs_services_active_sort_index = 0, 'ALTER TABLE services ADD INDEX idx_services_active_sort (is_active, sort_order, created_at, id)', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- default site settings for public contact/location plus booking windows
INSERT INTO site_settings (`key`, `value`)
VALUES
    ('business_name', 'Bow Wow''s Dog Spa'),
    ('serving_area', 'Proudly serving Greater Winston-Salem and the Triad area'),
    ('address', '11141 Old U.S. Hwy 52 #4, Winston-Salem, NC 27107'),
    ('phone', '(336) 842-3723'),
    ('email', 'bowwowsdogspa@gmail.com'),
    ('hours', 'Mon-Thurs 10a-5p · Fri, Sat by special appointment'),
    ('commerce_mode', 'catalog_only'),
    ('commerce_currency', 'USD'),
    ('commerce_provider', ''),
    ('booking_hold_minutes', '30'),
    ('booking_pending_expire_hours', '24')
ON DUPLICATE KEY UPDATE
    `value` = IF(TRIM(COALESCE(`value`, '')) = '', VALUES(`value`), `value`);

INSERT INTO services (name, short_summary, description, duration_minutes, price_label, breed_weight_note, is_active, sort_order, created_at, updated_at)
SELECT *
FROM (
    SELECT
        'Signature Full Groom' AS name,
        'Bath, styling, and finishing details for a polished boutique groom.' AS short_summary,
        'Includes premium bath, coat prep, breed-aware styling, nail trim, ear cleaning, and finishing touches.' AS description,
        120 AS duration_minutes,
        'Starts at $75' AS price_label,
        'Final pricing depends on coat condition, size, and handling needs.' AS breed_weight_note,
        1 AS is_active,
        10 AS sort_order,
        NOW() AS created_at,
        NOW() AS updated_at
    UNION ALL
    SELECT
        'Bath & Brush Refresh',
        'A tidy between-grooms visit focused on comfort, coat health, and cleanup.',
        'Includes bath, blowout, brush out, nail trim, ear cleaning, and light face or paw tidy as needed.',
        90,
        'Starts at $55',
        'Great for regular coat maintenance and in-between visits.',
        1,
        20,
        NOW(),
        NOW()
    UNION ALL
    SELECT
        'Pawdicure & Face Trim',
        'Quick touch-up for paws, face, and photo-ready details.',
        'A shorter refresh focused on nails, paw pads, sanitary clean-up, and face shaping.',
        45,
        'Starts at $25',
        'Available as an add-on or quick maintenance visit.',
        1,
        30,
        NOW(),
        NOW()
) seed_rows
WHERE NOT EXISTS (SELECT 1 FROM services LIMIT 1);

INSERT IGNORE INTO schema_migrations (version, applied_at)
VALUES ('master_20250130_01', NOW());
