#!/usr/bin/env php
<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('seed_admin.php must be executed via CLI.');
}

require __DIR__ . '/../bootstrap/app.php';

use BowWowSpa\Database\Database;

$argv = $_SERVER['argv'] ?? [];
$force = in_array('--reset', $argv, true) || getenv('ADMIN_FORCE_RESET') === '1';

$email = getenv('ADMIN_EMAIL') ?: prompt('Admin email: ');
$password = getenv('ADMIN_PASSWORD') ?: promptHidden('Admin password: ');

if (!$email || !$password) {
    fwrite(STDERR, "Email and password are required.\n");
    exit(1);
}

$user = Database::fetch('SELECT * FROM admin_users WHERE email = :email', ['email' => $email]);

if ($user && !$force) {
    echo "Admin user already exists. Pass --reset or set ADMIN_FORCE_RESET=1 to update the password.\n";
    exit(0);
}

$hash = password_hash($password, PASSWORD_DEFAULT);

if ($user) {
    Database::run(
        'UPDATE admin_users SET password_hash = :hash, display_name = :display_name, role = :role, is_enabled = 1, updated_at = NOW() WHERE id = :id',
        [
            'hash' => $hash,
            'display_name' => 'admin',
            'role' => 'super_admin',
            'id' => $user['id'],
        ]
    );
    echo "Updated admin user {$email}.\n";
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
    echo "Created admin user {$email}.\n";
}

function prompt(string $label): string
{
    echo $label;
    return trim(fgets(STDIN) ?: '');
}

function promptHidden(string $label): string
{
    if (preg_match('/^win/i', PHP_OS_FAMILY)) {
        return prompt($label);
    }

    echo $label;
    system('stty -echo');
    $value = trim(fgets(STDIN) ?: '');
    system('stty echo');
    echo PHP_EOL;
    return $value;
}
