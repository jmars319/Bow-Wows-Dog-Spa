<?php

return [
    'app' => [
        'url' => 'https://bowwowsdogspa.example.com',
        'env' => 'local',
        'debug' => true,
    ],
    'database' => [
        'dsn' => 'mysql:host=127.0.0.1;dbname=bowwow;charset=utf8mb4',
        'username' => 'bowwow_user',
        'password' => 'secret',
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
        'from_email' => 'hello@bowwowsdogspa.example.com',
        'from_name' => 'Bow Wow\'s Dog Spa',
        'staff_notifications' => ['team@bowwowsdogspa.example.com'],
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
    'preview' => [
        'enabled' => (bool) (getenv('PREVIEW_GATE_ENABLED') ?? true),
        'password' => getenv('PREVIEW_GATE_PASSWORD') ?: 'bowwow-preview',
        'cookie_name' => getenv('PREVIEW_GATE_COOKIE') ?: 'preview_ok',
        'cookie_ttl' => (int) (getenv('PREVIEW_GATE_COOKIE_TTL') ?: 60 * 60 * 24),
        'secret' => getenv('PREVIEW_GATE_SECRET') ?: 'change-this-preview-secret',
    ],
];
