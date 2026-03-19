SET @dbName := DATABASE();

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
    updated_at DATETIME NOT NULL
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

ALTER TABLE booking_requests
    MODIFY COLUMN status ENUM('pending_confirmation', 'confirmed', 'declined', 'cancelled', 'expired', 'completed') NOT NULL DEFAULT 'pending_confirmation';

INSERT INTO site_settings (`key`, `value`)
VALUES
    ('booking_hold_minutes', '30'),
    ('booking_pending_expire_hours', '24')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);

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
