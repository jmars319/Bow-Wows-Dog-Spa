#!/usr/bin/env php
<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('seed_e2e_fixtures.php must be executed via CLI.');
}

require __DIR__ . '/../bootstrap/app.php';

use BowWowSpa\Database\Database;
use BowWowSpa\Database\Connection;

$email = getenv('E2E_ADMIN_EMAIL') ?: 'e2e-admin@bowwow.local';
$username = trim((string) (getenv('E2E_ADMIN_USERNAME') ?: 'e2e-admin'));
$password = getenv('E2E_ADMIN_PASSWORD') ?: 'BowWow123!';
$bookingDate = getenv('E2E_BOOKING_DATE') ?: (new DateTimeImmutable('today'))->modify('+14 days')->format('Y-m-d');
$timeSlots = ['09:00:00', '09:30:00', '10:00:00', '10:30:00', '11:00:00'];
$bookingServiceName = getenv('E2E_BOOKING_SERVICE_NAME') ?: 'E2E Pawdicure & Face Trim';

applyRequiredMigrations();

$hasUsername = columnExists('admin_users', 'username');
$hasDisplayName = columnExists('admin_users', 'display_name');
$existingByEmail = Database::fetch('SELECT * FROM admin_users WHERE email = :email LIMIT 1', ['email' => $email]);
$existingByUsername = null;
if ($hasUsername && $username !== '') {
    $existingByUsername = Database::fetch('SELECT * FROM admin_users WHERE username = :username LIMIT 1', ['username' => $username]);
}

$reusingUsernameOwner = $existingByUsername && (!$existingByEmail || (int) $existingByUsername['id'] !== (int) $existingByEmail['id']);
$existing = $reusingUsernameOwner ? $existingByUsername : $existingByEmail;
if ($reusingUsernameOwner) {
    $email = (string) ($existing['email'] ?? $email);
}

$displayName = $reusingUsernameOwner && $hasDisplayName && !empty($existing['display_name'])
    ? (string) $existing['display_name']
    : 'E2E Admin';
$hash = password_hash($password, PASSWORD_DEFAULT);

if ($existing) {
    $fields = [
        'id' => $existing['id'],
        'email' => $email,
        'hash' => $hash,
        'role' => 'super_admin',
        'username' => $username !== '' ? $username : null,
        'display_name' => $displayName,
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
        'display_name' => $displayName,
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

$bookingServiceId = ensureBookingService($bookingServiceName);

Database::run('DELETE FROM booking_holds WHERE date = :date', ['date' => $bookingDate]);
Database::run(
    'DELETE FROM booking_requests
     WHERE date = :date
       AND (customer_name LIKE "E2E Owner%" OR email LIKE "%@example.com")',
    ['date' => $bookingDate]
);

Database::run(
    'INSERT INTO site_settings (`key`, `value`)
     VALUES
        ("booking_hold_minutes", "30"),
        ("booking_pending_expire_hours", "24"),
        ("booking_pause_enabled", "0"),
        ("booking_pause_message", "Online appointment times are paused right now. Please call or send a message and we will help find a safe appointment time.")
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
    'booking_service_id' => $bookingServiceId,
    'booking_service_name' => $bookingServiceName,
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

function applyRequiredMigrations(): void
{
    $migrationDir = dirname(__DIR__) . '/migrations';
    foreach ([
        '010_google_calendar_and_r2_launch.sql',
        '011_media_library_convenience.sql',
        '012_admin_booking_convenience.sql',
    ] as $migrationFile) {
        $migrationPath = $migrationDir . '/' . $migrationFile;
        $sql = file_get_contents($migrationPath);
        if ($sql === false) {
            throw new RuntimeException('Unable to read migration: ' . $migrationFile);
        }

        Connection::pdo()->exec($sql);
    }
}

function ensureBookingService(string $serviceName): int
{
    $existing = Database::fetch('SELECT id FROM services WHERE name = :name LIMIT 1', ['name' => $serviceName]);
    $fields = [
        'name' => $serviceName,
        'short_summary' => 'E2E service used by browser smoke tests.',
        'description' => 'Short appointment option created by the e2e fixture setup.',
        'duration_minutes' => 45,
        'price_label' => 'Starts at $25',
        'breed_weight_note' => 'Fixture service for automated booking flow checks.',
        'is_active' => 1,
        'sort_order' => 1,
    ];

    if ($existing) {
        $fields['id'] = (int) $existing['id'];
        Database::run(
            'UPDATE services
             SET short_summary = :short_summary,
                 description = :description,
                 duration_minutes = :duration_minutes,
                 price_label = :price_label,
                 breed_weight_note = :breed_weight_note,
                 is_active = :is_active,
                 sort_order = :sort_order,
                 updated_at = NOW()
             WHERE id = :id',
            $fields
        );

        return (int) $existing['id'];
    }

    return Database::insert(
        'INSERT INTO services (name, short_summary, description, duration_minutes, price_label, breed_weight_note, is_active, sort_order, created_at, updated_at)
         VALUES (:name, :short_summary, :description, :duration_minutes, :price_label, :breed_weight_note, :is_active, :sort_order, NOW(), NOW())',
        $fields
    );
}
