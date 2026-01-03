<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('run_migrations.php must be executed via CLI.');
}

require __DIR__ . '/../bootstrap/app.php';

use BowWowSpa\Database\Connection;

$pdo = Connection::pdo();
$migrationsPath = realpath(__DIR__ . '/../migrations');

if (!$migrationsPath) {
    throw new RuntimeException('Unable to locate migrations directory.');
}

$files = glob($migrationsPath . '/*.sql');
sort($files);

foreach ($files as $file) {
    $sql = file_get_contents($file);
    echo "Running migration: {$file}" . PHP_EOL;
    $pdo->exec($sql);
}

echo "Migrations complete." . PHP_EOL;
