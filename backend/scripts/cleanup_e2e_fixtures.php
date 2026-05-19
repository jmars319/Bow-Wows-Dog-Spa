#!/usr/bin/env php
<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('cleanup_e2e_fixtures.php must be executed via CLI.');
}

require __DIR__ . '/../bootstrap/app.php';

use BowWowSpa\Database\Database;
use BowWowSpa\Support\Config;

$appEnv = strtolower((string) Config::get('app.env', 'production'));
if ($appEnv === 'production') {
    fwrite(STDERR, "Refusing to clean E2E fixtures in production.\n");
    exit(1);
}

$summary = [];
$fixtureDate = getenv('E2E_BOOKING_DATE') ?: null;
$fixturePath = BOWWOW_PROJECT_PATH . '/.dev/e2e-fixtures.json';
if (!$fixtureDate && is_file($fixturePath)) {
    $fixture = json_decode((string) file_get_contents($fixturePath), true);
    if (is_array($fixture) && !empty($fixture['booking_date'])) {
        $fixtureDate = (string) $fixture['booking_date'];
    }
}

runCounted(
    'booking_requests',
    'DELETE FROM booking_requests WHERE customer_name LIKE "E2E Owner%" OR email LIKE "%@example.com"',
    [],
    $summary
);
if ($fixtureDate) {
    runCounted('booking_holds', 'DELETE FROM booking_holds WHERE date = :date', ['date' => $fixtureDate], $summary);
}

runCounted('content_blocks', 'DELETE FROM content_blocks WHERE CAST(content_json AS CHAR) LIKE "%E2E%"', [], $summary);
runCounted('site_settings', 'DELETE FROM site_settings WHERE `value` LIKE "%E2E%"', [], $summary);

runCounted('retail_item_variants', 'DELETE retail_item_variants FROM retail_item_variants INNER JOIN retail_items ON retail_item_variants.retail_item_id = retail_items.id WHERE retail_items.name LIKE "E2E%" OR retail_items.sku LIKE "E2E%"', [], $summary);
runCounted('retail_items', 'DELETE FROM retail_items WHERE name LIKE "E2E%" OR sku LIKE "E2E%" OR description LIKE "%E2E%"', [], $summary);
runCounted('retail_categories', 'DELETE FROM retail_categories WHERE name LIKE "E2E%" OR slug LIKE "e2e%"', [], $summary);

runCounted('gallery_items', 'DELETE FROM gallery_items WHERE title LIKE "E2E%" OR caption LIKE "%E2E%"', [], $summary);
runCounted('featured_reviews', 'DELETE FROM featured_reviews WHERE reviewer_name LIKE "E2E%" OR review_text LIKE "%E2E%"', [], $summary);
runCounted('services', 'DELETE FROM services WHERE name LIKE "E2E%" OR short_summary LIKE "%E2E%" OR description LIKE "%E2E%"', [], $summary);
runCounted('contact_messages', 'DELETE FROM contact_messages WHERE name LIKE "E2E%" OR email LIKE "%@example.com" OR message LIKE "%E2E%"', [], $summary);
runCounted(
    'media_assets',
    'DELETE FROM media_assets
     WHERE title LIKE "E2E%"
        OR alt_text LIKE "E2E%"
        OR caption LIKE "%E2E%"
        OR original_path LIKE "%E2E%"
        OR original_url LIKE "%E2E%"
        OR fallback_url LIKE "%E2E%"',
    [],
    $summary
);

ensureLocalAdmin($summary);

echo json_encode([
    'success' => true,
    'summary' => $summary,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;

function runCounted(string $label, string $sql, array $params, array &$summary): void
{
    try {
        $stmt = Database::run($sql, $params);
        $summary[$label] = $stmt->rowCount();
    } catch (\Throwable $error) {
        $summary[$label] = 'skipped: ' . $error->getMessage();
    }
}

function ensureLocalAdmin(array &$summary): void
{
    $passwordHash = password_hash('admin123', PASSWORD_DEFAULT);
    $hasUsername = columnExists('admin_users', 'username');
    $hasDisplayName = columnExists('admin_users', 'display_name');
    $existing = $hasUsername
        ? Database::fetch('SELECT * FROM admin_users WHERE username = :username LIMIT 1', ['username' => 'admin'])
        : null;
    if (!$existing) {
        $existing = Database::fetch('SELECT * FROM admin_users WHERE email = :email LIMIT 1', ['email' => 'admin@bowwow.local']);
    }

    if ($existing) {
        $fields = [
            'id' => $existing['id'],
            'email' => (string) ($existing['email'] ?: 'admin@bowwow.local'),
            'password_hash' => $passwordHash,
            'role' => 'super_admin',
        ];
        $updates = ['email = :email', 'password_hash = :password_hash', 'role = :role', 'is_enabled = 1', 'updated_at = NOW()'];
        if ($hasUsername) {
            $updates[] = 'username = :username';
            $fields['username'] = 'admin';
        }
        if ($hasDisplayName) {
            $updates[] = 'display_name = :display_name';
            $fields['display_name'] = 'Admin';
        }
        Database::run('UPDATE admin_users SET ' . implode(', ', $updates) . ' WHERE id = :id', $fields);
        $summary['local_admin'] = 'updated';
        return;
    }

    $columns = ['email', 'password_hash', 'role', 'is_enabled', 'created_at', 'updated_at'];
    $values = [':email', ':password_hash', ':role', '1', 'NOW()', 'NOW()'];
    $fields = [
        'email' => 'admin@bowwow.local',
        'password_hash' => $passwordHash,
        'role' => 'super_admin',
    ];
    if ($hasUsername) {
        $columns[] = 'username';
        $values[] = ':username';
        $fields['username'] = 'admin';
    }
    if ($hasDisplayName) {
        $columns[] = 'display_name';
        $values[] = ':display_name';
        $fields['display_name'] = 'Admin';
    }
    Database::insert(
        'INSERT INTO admin_users (' . implode(', ', $columns) . ') VALUES (' . implode(', ', $values) . ')',
        $fields
    );
    $summary['local_admin'] = 'created';
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
