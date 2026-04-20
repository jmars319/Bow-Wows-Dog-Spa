<?php

declare(strict_types=1);

namespace BowWowSpa\Tests;

use BowWowSpa\Database\Connection;
use BowWowSpa\Lib\Dotenv;
use BowWowSpa\Support\Config;
use PDO;
use RuntimeException;

final class TestEnvironment
{
    private static ?self $instance = null;

    private function __construct(
        private readonly string $databaseHost,
        private readonly string $databaseUser,
        private readonly string $databasePassword,
        private readonly string $databaseName,
        private readonly string $schemaPath,
        private readonly string $uploadDir,
        private readonly bool $reusesConfiguredDatabase,
    ) {
    }

    public static function boot(): self
    {
        if (self::$instance !== null) {
            return self::$instance;
        }

        $envPath = BOWWOW_APP_PATH . '/.env';
        Dotenv::load($envPath);

        $dbHost = trim((string) getenv('DB_HOST'));
        $dbName = trim((string) getenv('DB_NAME'));
        $dbUser = trim((string) getenv('DB_USER'));
        $dbPass = (string) getenv('DB_PASS');

        if ($dbHost === '' || $dbName === '' || $dbUser === '') {
            throw new RuntimeException('Database environment is not configured for tests.');
        }

        $reuseConfiguredDatabase = filter_var(getenv('BOWWOW_TEST_REUSE_CONFIGURED_DB'), FILTER_VALIDATE_BOOLEAN);
        $testDbName = trim((string) (getenv('DB_TEST_NAME') ?: ($reuseConfiguredDatabase ? $dbName : ($dbName . '_test'))));
        if ($testDbName === '') {
            throw new RuntimeException('Set DB_TEST_NAME to a dedicated test database name.');
        }

        if (!$reuseConfiguredDatabase) {
            if ($testDbName === $dbName) {
                throw new RuntimeException('Set DB_TEST_NAME to a dedicated test database name.');
            }

            $adminPdo = new PDO(
                sprintf('mysql:host=%s;charset=utf8mb4', $dbHost),
                $dbUser,
                $dbPass,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                ]
            );
            $adminPdo->exec(sprintf('CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', $testDbName));
        }

        $uploadDir = __DIR__ . '/.tmp/uploads';
        self::ensureDirectory($uploadDir);

        Config::load([
            'app' => [
                'url' => 'http://localhost.test',
                'env' => 'testing',
                'debug' => true,
            ],
            'database' => [
                'dsn' => sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $dbHost, $testDbName),
                'username' => $dbUser,
                'password' => $dbPass,
                'options' => [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                ],
            ],
            'session' => [
                'name' => 'bowwow_test',
                'lifetime' => 60,
                'secure' => false,
                'same_site' => 'Lax',
            ],
            'sendgrid' => [
                'enabled' => false,
                'api_key' => '',
                'from_email' => '',
                'from_name' => '',
                'staff_notifications' => [],
                'send_customer_receipts' => false,
                'send_customer_confirmations' => false,
            ],
            'media' => [
                'upload_dir' => $uploadDir,
                'public_url_prefix' => '/uploads',
                'max_bytes' => 8 * 1024 * 1024,
                'jpeg_quality' => 88,
                'webp_quality' => 90,
                'png_compression' => 6,
                'width_profiles' => [
                    'default' => [480, 960, 1440],
                    'gallery' => [640, 1280, 1920],
                    'retail' => [320, 640, 960],
                ],
            ],
            'calendar_sync' => [
                'enabled' => true,
                'default_timezone' => 'America/New_York',
                'max_job_attempts' => 5,
            ],
        ]);

        Connection::init(Config::get('database'));

        self::$instance = new self(
            $dbHost,
            $dbUser,
            $dbPass,
            $testDbName,
            BOWWOW_APP_PATH . '/db/master_schema.sql',
            $uploadDir,
            $reuseConfiguredDatabase,
        );

        return self::$instance;
    }

    public function resetDatabase(): void
    {
        $pdo = Connection::pdo();
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
        foreach ($pdo->query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"')->fetchAll(PDO::FETCH_NUM) as $row) {
            $table = $row[0] ?? null;
            if ($table !== null) {
                $pdo->exec(sprintf('DROP TABLE IF EXISTS `%s`', $table));
            }
        }
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');

        $schema = file_get_contents($this->schemaPath);
        if ($schema === false) {
            throw new RuntimeException('Unable to load master schema for tests.');
        }

        $pdo->exec($schema);
        $this->resetUploads();
        $_SERVER['REMOTE_ADDR'] = '127.0.0.1';
        $_SERVER['HTTP_USER_AGENT'] = 'BowWow Test Runner';
    }

    public function resetUploads(): void
    {
        if (is_dir($this->uploadDir)) {
            $this->deleteDirectoryContents($this->uploadDir);
        }
        self::ensureDirectory($this->uploadDir);
    }

    public function databaseName(): string
    {
        return $this->databaseName;
    }

    public function pdo(): PDO
    {
        return Connection::pdo();
    }

    public function uploadDir(): string
    {
        return $this->uploadDir;
    }

    public function reusesConfiguredDatabase(): bool
    {
        return $this->reusesConfiguredDatabase;
    }

    public function backupConfiguredDatabase(): string
    {
        if (!$this->reusesConfiguredDatabase) {
            throw new RuntimeException('Backup is only required when reusing the configured database.');
        }

        $backupPath = __DIR__ . '/.tmp/' . $this->databaseName . '-backup.sql';
        self::ensureDirectory(dirname($backupPath));

        $command = sprintf(
            'MYSQL_PWD=%s %s --host=%s --user=%s --single-transaction --skip-lock-tables --no-tablespaces --set-gtid-purged=OFF --column-statistics=0 --result-file=%s %s',
            escapeshellarg($this->databasePassword),
            escapeshellcmd($this->requireCommand('mysqldump')),
            escapeshellarg($this->databaseHost),
            escapeshellarg($this->databaseUser),
            escapeshellarg($backupPath),
            escapeshellarg($this->databaseName)
        );

        exec($command, $output, $exitCode);
        if ($exitCode !== 0) {
            throw new RuntimeException('Unable to back up the configured database before running tests.');
        }

        return $backupPath;
    }

    public function restoreConfiguredDatabase(string $backupPath): void
    {
        if (!$this->reusesConfiguredDatabase) {
            return;
        }

        if (!is_file($backupPath)) {
            throw new RuntimeException('Database backup file is missing: ' . $backupPath);
        }

        $command = sprintf(
            'MYSQL_PWD=%s %s --host=%s --user=%s %s < %s',
            escapeshellarg($this->databasePassword),
            escapeshellcmd($this->requireCommand('mysql')),
            escapeshellarg($this->databaseHost),
            escapeshellarg($this->databaseUser),
            escapeshellarg($this->databaseName),
            escapeshellarg($backupPath)
        );

        exec($command, $output, $exitCode);
        if ($exitCode !== 0) {
            throw new RuntimeException('Unable to restore the configured database after running tests.');
        }
    }

    public function seedAdminUser(array $overrides = []): int
    {
        $data = array_merge([
            'email' => 'admin@example.com',
            'username' => 'admin',
            'display_name' => 'Admin User',
            'password_hash' => password_hash('password123', PASSWORD_DEFAULT),
            'role' => 'super_admin',
            'is_enabled' => 1,
        ], $overrides);

        $stmt = $this->pdo()->prepare(
            'INSERT INTO admin_users (email, username, display_name, password_hash, role, is_enabled, created_at, updated_at)
             VALUES (:email, :username, :display_name, :password_hash, :role, :is_enabled, NOW(), NOW())'
        );
        $stmt->execute($data);

        return (int) $this->pdo()->lastInsertId();
    }

    public function insertMediaAsset(array $overrides = []): int
    {
        $data = array_merge([
            'original_path' => 'originals/test-image.jpg',
            'original_url' => '/uploads/originals/test-image.jpg',
            'mime_type' => 'image/jpeg',
            'category' => 'default',
            'created_by' => null,
        ], $overrides);

        $stmt = $this->pdo()->prepare(
            'INSERT INTO media_assets (
                original_path,
                original_url,
                mime_type,
                category,
                created_by,
                created_at
             ) VALUES (
                :original_path,
                :original_url,
                :mime_type,
                :category,
                :created_by,
                NOW()
             )'
        );
        $stmt->execute($data);

        return (int) $this->pdo()->lastInsertId();
    }

    public function insertCalendarIntegration(array $overrides = []): int
    {
        $data = array_merge([
            'provider' => 'google',
            'label' => 'Primary Calendar',
            'target_calendar_name' => 'Primary',
            'target_calendar_reference' => 'calendar-1',
            'connection_status' => 'connected',
            'sync_confirmed_bookings' => 1,
            'is_enabled' => 1,
            'settings_json' => json_encode(['event_prefix' => 'BW']),
            'notes' => null,
        ], $overrides);

        $stmt = $this->pdo()->prepare(
            'INSERT INTO calendar_integrations (
                provider,
                label,
                target_calendar_name,
                target_calendar_reference,
                connection_status,
                sync_confirmed_bookings,
                is_enabled,
                settings_json,
                notes,
                created_at,
                updated_at
            ) VALUES (
                :provider,
                :label,
                :target_calendar_name,
                :target_calendar_reference,
                :connection_status,
                :sync_confirmed_bookings,
                :is_enabled,
                :settings_json,
                :notes,
                NOW(),
                NOW()
            )'
        );
        $stmt->execute($data);

        return (int) $this->pdo()->lastInsertId();
    }

    private static function ensureDirectory(string $path): void
    {
        if (!is_dir($path) && !mkdir($path, 0777, true) && !is_dir($path)) {
            throw new RuntimeException('Unable to create test directory: ' . $path);
        }
    }

    private function deleteDirectoryContents(string $path): void
    {
        $items = scandir($path);
        if ($items === false) {
            return;
        }

        foreach ($items as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }

            $child = $path . DIRECTORY_SEPARATOR . $item;
            if (is_dir($child)) {
                $this->deleteDirectoryContents($child);
                @rmdir($child);
                continue;
            }

            @unlink($child);
        }
    }

    private function requireCommand(string $name): string
    {
        $path = trim((string) shell_exec('command -v ' . escapeshellarg($name)));
        if ($path === '') {
            throw new RuntimeException('Required command is not available: ' . $name);
        }

        return $path;
    }
}
