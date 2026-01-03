ALTER TABLE booking_requests
    MODIFY COLUMN status ENUM('pending_confirmation','confirmed','declined','cancelled','expired') NOT NULL DEFAULT 'pending_confirmation';

INSERT INTO site_settings (`key`, `value`)
VALUES
    ('booking_hold_minutes', '1440'),
    ('booking_pending_expire_hours', '24')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);
