<?php

return [
    'app' => [
        'url' => 'https://bowwowsdogspa.com',
        'env' => 'local',
        'debug' => true,
    ],
    'database' => [
        'dsn' => 'mysql:host=127.0.0.1;dbname=bowwow_dev;charset=utf8mb4',
        'username' => 'bowwow_dev_user',
        'password' => 'change-me',
        'options' => [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ],
    ],
    'session' => [
        'name' => 'bowwow_admin',
        'lifetime' => 60 * 60 * 4,
        'secure' => false,
        'same_site' => 'Lax',
    ],
    'sendgrid' => [
        'api_key' => 'SENDGRID_API_KEY',
        'from_email' => 'hello@bowwowsdogspa.com',
        'from_name' => 'Bow Wow\'s Dog Spa',
        'staff_notifications' => ['bowwowsdogspa@gmail.com'],
    ],
    'media' => [
        'upload_dir' => getenv('UPLOAD_DIR') ?: __DIR__ . '/../uploads',
        'public_url_prefix' => '/uploads',
        'max_bytes' => (int) (getenv('IMAGE_UPLOAD_MAX_BYTES') ?: (8 * 1024 * 1024)),
        'jpeg_quality' => (int) (getenv('IMAGE_JPEG_QUALITY') ?: 82),
        'webp_quality' => (int) (getenv('IMAGE_WEBP_QUALITY') ?: 80),
        'png_compression' => (int) (getenv('IMAGE_PNG_COMPRESSION') ?: 6),
        'width_profiles' => json_decode(getenv('RESPONSIVE_IMAGE_WIDTH_PROFILES') ?: '{
            "default": [480, 960, 1440],
            "gallery": [640, 1280, 1920],
            "retail": [320, 640, 960]
        }', true),
    ],
    'calendar_sync' => [
        'enabled' => true,
        'default_timezone' => 'America/New_York',
        'max_job_attempts' => 5,
    ],
];
