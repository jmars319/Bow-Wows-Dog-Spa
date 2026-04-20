#!/usr/bin/env php
<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('seed_e2e_fixtures.php must be executed via CLI.');
}

require __DIR__ . '/../bootstrap/app.php';

use BowWowSpa\Database\Database;

$email = getenv('E2E_ADMIN_EMAIL') ?: 'e2e-admin@bowwow.local';
$username = trim((string) (getenv('E2E_ADMIN_USERNAME') ?: 'e2e-admin'));
$password = getenv('E2E_ADMIN_PASSWORD') ?: 'BowWowE2E123!';
$bookingDate = getenv('E2E_BOOKING_DATE') ?: (new DateTimeImmutable('today'))->modify('+14 days')->format('Y-m-d');
$timeSlots = ['09:00:00', '09:30:00', '10:00:00', '10:30:00', '11:00:00'];

$existing = Database::fetch('SELECT * FROM admin_users WHERE email = :email LIMIT 1', ['email' => $email]);
$hash = password_hash($password, PASSWORD_DEFAULT);
$hasUsername = columnExists('admin_users', 'username');
$hasDisplayName = columnExists('admin_users', 'display_name');

if ($existing) {
    $fields = [
        'id' => $existing['id'],
        'email' => $email,
        'hash' => $hash,
        'role' => 'super_admin',
        'username' => $username !== '' ? $username : null,
        'display_name' => 'E2E Admin',
    ];
    $updates = ['email = :email', 'password_hash = :hash', 'role = :role', 'is_enabled = 1', 'updated_at = NOW()'];
    if ($hasUsername) {
        $updates[] = 'username = :username';
    }
    if ($hasDisplayName) {
        $updates[] = 'display_name = :display_name';
    }

    Database::run('UPDATE admin_users SET ' . implode(', ', $updates) . ' WHERE id = :id', $fields);
    $adminId = (int) $existing['id'];
} else {
    $columns = ['email', 'password_hash', 'role', 'is_enabled', 'created_at', 'updated_at'];
    $values = [':email', ':hash', ':role', '1', 'NOW()', 'NOW()'];
    $fields = [
        'email' => $email,
        'hash' => $hash,
        'role' => 'super_admin',
        'username' => $username !== '' ? $username : null,
        'display_name' => 'E2E Admin',
    ];

    if ($hasUsername) {
        $columns[] = 'username';
        $values[] = ':username';
    }
    if ($hasDisplayName) {
        $columns[] = 'display_name';
        $values[] = ':display_name';
    }

    $adminId = Database::insert(
        'INSERT INTO admin_users (' . implode(', ', $columns) . ') VALUES (' . implode(', ', $values) . ')',
        $fields
    );
}

Database::run(
    'INSERT INTO schedule_date_overrides (date, is_closed, times_json, capacity_json)
     VALUES (:date, 0, :times_json, :capacity_json)
     ON DUPLICATE KEY UPDATE is_closed = VALUES(is_closed), times_json = VALUES(times_json), capacity_json = VALUES(capacity_json)',
    [
        'date' => $bookingDate,
        'times_json' => json_encode($timeSlots),
        'capacity_json' => json_encode([]),
    ]
);

Database::run(
    'INSERT INTO site_settings (`key`, `value`)
     VALUES ("booking_hold_minutes", "30"), ("booking_pending_expire_hours", "24")
     ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)'
);

$rootDir = dirname(__DIR__, 2);
$devDir = $rootDir . '/.dev';
if (!is_dir($devDir) && !mkdir($devDir, 0775, true) && !is_dir($devDir)) {
    throw new RuntimeException('Unable to create .dev directory for e2e fixtures.');
}

$payload = [
    'admin_id' => $adminId,
    'admin_email' => $email,
    'admin_username' => $username,
    'admin_password' => $password,
    'booking_date' => $bookingDate,
    'booking_time' => $timeSlots[0],
    'generated_at' => date(DATE_ATOM),
];

$fixturePath = $devDir . '/e2e-fixtures.json';
file_put_contents($fixturePath, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL, LOCK_EX);

echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;

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
