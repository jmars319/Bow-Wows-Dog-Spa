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
$username = trim((string) (getenv('ADMIN_USERNAME') ?: 'admin'));
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
$hasUsername = columnExists('admin_users', 'username');
$hasDisplayName = columnExists('admin_users', 'display_name');

if ($user) {
    $fields = [
        'hash' => $hash,
        'role' => 'super_admin',
        'id' => $user['id'],
    ];
    $updates = ['password_hash = :hash', 'role = :role', 'is_enabled = 1', 'updated_at = NOW()'];

    if ($hasUsername) {
        $updates[] = 'username = :username';
        $fields['username'] = $username !== '' ? $username : null;
    }
    if ($hasDisplayName) {
        $updates[] = 'display_name = :display_name';
        $fields['display_name'] = 'admin';
    }

    Database::run('UPDATE admin_users SET ' . implode(', ', $updates) . ' WHERE id = :id', $fields);
    echo "Updated admin user {$email}.\n";
} else {
    $columns = ['email', 'password_hash', 'role', 'is_enabled', 'created_at', 'updated_at'];
    $values = [':email', ':hash', ':role', '1', 'NOW()', 'NOW()'];
    $fields = [
        'email' => $email,
        'hash' => $hash,
        'role' => 'super_admin',
    ];

    if ($hasUsername) {
        $columns[] = 'username';
        $values[] = ':username';
        $fields['username'] = $username !== '' ? $username : null;
    }
    if ($hasDisplayName) {
        $columns[] = 'display_name';
        $values[] = ':display_name';
        $fields['display_name'] = 'admin';
    }

    Database::insert(
        'INSERT INTO admin_users (' . implode(', ', $columns) . ') VALUES (' . implode(', ', $values) . ')',
        $fields
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

function columnExists(string $table, string $column): bool
{
    $row = Database::fetch(
        'SELECT COUNT(*) AS total
         FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = :table_name AND column_name = :column_name',
        [
            'table_name' => $table,
            'column_name' => $column,
        ]
    );

    return ((int) ($row['total'] ?? 0)) > 0;
}
