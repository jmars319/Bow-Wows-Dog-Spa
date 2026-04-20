<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('backend/tests/run.php must be executed via CLI.');
}

require __DIR__ . '/bootstrap.php';

use BowWowSpa\Tests\TestCase;
use BowWowSpa\Tests\TestEnvironment;

$environment = TestEnvironment::boot();
$filter = $argv[1] ?? null;
$backupPath = null;
$skipBackupRestore = getenv('BOWWOW_TEST_SKIP_BACKUP_RESTORE') === '1';

$files = glob(__DIR__ . '/Feature/*Test.php');
sort($files);

foreach ($files as $file) {
    require_once $file;
}

$testClasses = array_values(array_filter(
    get_declared_classes(),
    static fn (string $class): bool => is_subclass_of($class, TestCase::class)
        && ($filter === null || str_contains($class, (string) $filter))
));
sort($testClasses);

if ($testClasses === []) {
    fwrite(STDERR, "No tests matched.\n");
    exit(1);
}

$passed = 0;
$failed = 0;
$failures = [];

echo 'Using test database: ' . $environment->databaseName() . PHP_EOL;
if ($environment->reusesConfiguredDatabase()) {
    echo $skipBackupRestore
        ? "Reusing configured database for tests without internal backup/restore.\n"
        : "Reusing configured database for tests with automatic backup/restore.\n";
}

try {
    if ($environment->reusesConfiguredDatabase() && !$skipBackupRestore) {
        $backupPath = $environment->backupConfiguredDatabase();
    }

    foreach ($testClasses as $class) {
        $test = new $class($environment);
        $result = $test->run();
        $passed += $result['passed'];
        $failed += $result['failed'];

        echo sprintf(
            "%s: %d passed, %d failed\n",
            $class,
            $result['passed'],
            $result['failed']
        );

        foreach ($result['failures'] as $failure) {
            $failures[] = $failure;
        }
    }
} finally {
    if ($backupPath !== null) {
        $environment->restoreConfiguredDatabase($backupPath);
        echo "Configured database restored from backup.\n";
    }
}

echo PHP_EOL . sprintf("Backend tests complete: %d passed, %d failed\n", $passed, $failed);

if ($failures !== []) {
    echo PHP_EOL . "Failures:\n";
    foreach ($failures as $failure) {
        echo ' - ' . $failure . PHP_EOL;
    }
    exit(1);
}
