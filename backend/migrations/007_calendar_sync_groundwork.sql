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
