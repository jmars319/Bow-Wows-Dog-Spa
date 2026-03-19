<?php

declare(strict_types=1);

define('BOWWOW_APP_PATH', dirname(__DIR__));

require BOWWOW_APP_PATH . '/bootstrap/autoload.php';

use BowWowSpa\Support\Config;
use BowWowSpa\Database\Connection;
use BowWowSpa\Lib\Dotenv;

$envFile = BOWWOW_APP_PATH . '/.env';
Dotenv::load($envFile);

$appEnv = getenv('APP_ENV') ?: 'production';
$appDebug = filter_var(getenv('APP_DEBUG'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? false;
$dbHost = trim((string) (getenv('DB_HOST') ?: ''));
$dbName = trim((string) (getenv('DB_NAME') ?: ''));
$dbUser = trim((string) (getenv('DB_USER') ?: ''));

if ($dbHost === '' || $dbName === '' || $dbUser === '') {
    throw new \RuntimeException('Database environment is not configured. Set DB_HOST, DB_NAME, and DB_USER in backend/.env.');
}

ini_set('display_errors', $appDebug ? '1' : '0');
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');

$config = [
    'app' => [
        'url' => getenv('APP_URL') ?: 'https://bowwowsdogspa.com',
        'env' => $appEnv,
        'debug' => $appDebug,
    ],
    'database' => [
        'dsn' => sprintf(
            'mysql:host=%s;dbname=%s;charset=utf8mb4',
            $dbHost,
            $dbName
        ),
        'username' => $dbUser,
        'password' => getenv('DB_PASS') ?: '',
        'options' => [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ],
    ],
    'session' => [
        'name' => getenv('SESSION_NAME') ?: 'bowwow_admin',
        'lifetime' => (int) (getenv('SESSION_LIFETIME') ?: 60 * 60 * 4),
        'secure' => filter_var(getenv('SESSION_SECURE'), FILTER_VALIDATE_BOOLEAN),
        'same_site' => getenv('SESSION_SAMESITE') ?: 'Lax',
    ],
    'sendgrid' => [
        'enabled' => filter_var(getenv('SENDGRID_ENABLED'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? true,
        'api_key' => getenv('SENDGRID_API_KEY') ?: '',
        'from_email' => getenv('SENDGRID_FROM_EMAIL') ?: '',
        'from_name' => getenv('SENDGRID_FROM_NAME') ?: '',
        'staff_notifications' => array_filter(array_map('trim', explode(',', getenv('SENDGRID_STAFF_NOTIFICATIONS') ?: ''))),
        'send_customer_receipts' => filter_var(getenv('SENDGRID_SEND_CUSTOMER_RECEIPTS'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? true,
        'send_customer_confirmations' => filter_var(getenv('SENDGRID_SEND_CUSTOMER_CONFIRMATIONS'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? true,
    ],
    'media' => [
        'upload_dir' => getenv('UPLOAD_DIR') ?: BOWWOW_APP_PATH . '/uploads',
        'public_url_prefix' => '/uploads',
        'max_bytes' => (int) (getenv('IMAGE_UPLOAD_MAX_BYTES') ?: (8 * 1024 * 1024)),
        'jpeg_quality' => (int) (getenv('IMAGE_JPEG_QUALITY') ?: 88),
        'webp_quality' => (int) (getenv('IMAGE_WEBP_QUALITY') ?: 90),
        'png_compression' => (int) (getenv('IMAGE_PNG_COMPRESSION') ?: 6),
        'width_profiles' => json_decode(getenv('RESPONSIVE_IMAGE_WIDTH_PROFILES') ?: '{
            "default": [480, 960, 1440],
            "gallery": [640, 1280, 1920],
            "retail": [320, 640, 960]
        }', true),
    ],
];

Config::load($config);

try {
    Connection::init($config['database']);
} catch (\Throwable $e) {
    if (!defined('BOWWOW_OPTIONAL_BOOTSTRAP') || !BOWWOW_OPTIONAL_BOOTSTRAP) {
        throw $e;
    }
    error_log('[BowWow] Database connection skipped during optional bootstrap: ' . $e->getMessage());
}

$sessionConfig = $config['session'] ?? [];
$lifetime = (int) ($sessionConfig['lifetime'] ?? 14400);

session_set_cookie_params([
    'lifetime' => $lifetime,
    'path' => '/',
    'domain' => '',
    'secure' => (bool) ($sessionConfig['secure'] ?? false),
    'httponly' => true,
    'samesite' => $sessionConfig['same_site'] ?? 'Lax',
]);

session_name($sessionConfig['name'] ?? 'bowwow_admin');

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}
