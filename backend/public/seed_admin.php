<?php

declare(strict_types=1);

define('BOWWOW_OPTIONAL_BOOTSTRAP', true);

require __DIR__ . '/../bootstrap/app.php';

use BowWowSpa\Database\Database;

$seedKey = getenv('ADMIN_SEED_KEY') ?: '';
if ($seedKey === '') {
    http_response_code(500);
    exit('ADMIN_SEED_KEY is not configured.');
}

$providedKey = (string) ($_REQUEST['key'] ?? '');
if (!hash_equals($seedKey, $providedKey)) {
    http_response_code(403);
    exit('Forbidden');
}

$email = trim((string) ($_REQUEST['email'] ?? getenv('ADMIN_EMAIL') ?? ''));
$password = (string) ($_REQUEST['password'] ?? getenv('ADMIN_PASSWORD') ?? '');
$force = in_array((string) ($_REQUEST['force'] ?? '0'), ['1', 'true', 'on'], true);

if ($email === '' || $password === '') {
    http_response_code(400);
    exit('Email and password are required.');
}

$existing = Database::fetch('SELECT * FROM admin_users WHERE email = :email', ['email' => $email]);
$hash = password_hash($password, PASSWORD_DEFAULT);

if ($existing) {
    if (!$force) {
        http_response_code(409);
        exit('Admin already exists. Pass force=1 to overwrite.');
    }

    Database::run(
        'UPDATE admin_users SET password_hash = :hash, display_name = :display_name, role = :role, is_enabled = 1, updated_at = NOW() WHERE id = :id',
        [
            'hash' => $hash,
            'display_name' => 'admin',
            'role' => 'super_admin',
            'id' => $existing['id'],
        ]
    );
    $message = 'Updated existing admin.';
} else {
    Database::insert(
        'INSERT INTO admin_users (email, display_name, password_hash, role, is_enabled, created_at, updated_at) 
         VALUES (:email, :display_name, :hash, :role, 1, NOW(), NOW())',
        [
            'email' => $email,
            'display_name' => 'admin',
            'hash' => $hash,
            'role' => 'super_admin',
        ]
    );
    $message = 'Created admin.';
}

header('Content-Type: application/json');
echo json_encode([
    'ok' => true,
    'message' => $message,
]);
