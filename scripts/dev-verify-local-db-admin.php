<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$envPath = $root . '/backend/.env';

function local_env_file(string $path): array
{
    if (!is_file($path)) {
        throw new RuntimeException('Missing backend/.env');
    }
    $env = [];
    foreach (file($path, FILE_IGNORE_NEW_LINES) ?: [] as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }
        [$key, $value] = explode('=', $line, 2);
        $env[trim($key)] = trim($value, " \t\n\r\0\x0B\"'");
    }
    return $env;
}

function local_env_value(array $env, array $keys, ?string $default = null): ?string
{
    foreach ($keys as $key) {
        if (array_key_exists($key, $env) && $env[$key] !== '') {
            return $env[$key];
        }
    }
    return $default;
}

function fail_local_check(string $message): void
{
    fwrite(STDERR, "[local-db-admin] {$message}\n");
    exit(1);
}

try {
    $env = local_env_file($envPath);
    if (strtolower((string) local_env_value($env, ['APP_ENV'], 'development')) === 'production') {
        fail_local_check('Refusing to run against APP_ENV=production');
    }

    $host = local_env_value($env, ['DB_HOST', 'MYSQL_HOST'], '127.0.0.1');
    $port = local_env_value($env, ['DB_PORT', 'MYSQL_PORT'], '3306') ?: '3306';
    $name = local_env_value($env, ['DB_NAME', 'DB_DATABASE', 'MYSQL_DATABASE']);
    $user = local_env_value($env, ['DB_USER', 'DB_USERNAME', 'MYSQL_USER']);
    $pass = local_env_value($env, ['DB_PASSWORD', 'DB_PASS', 'MYSQL_PASSWORD'], '');
    if (!$name || !$user) {
        fail_local_check('Missing DB_NAME or DB_USER in backend/.env');
    }

    $pdo = new PDO(
        "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4",
        $user,
        $pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );

    $candidates = [
        ['table' => 'admins', 'user' => 'username', 'password' => 'password_hash', 'active' => []],
        ['table' => 'admin_users', 'user' => 'username', 'password' => 'password_hash', 'active' => ['is_enabled', 'is_active']],
        ['table' => 'sc_users', 'user' => 'username', 'password' => 'password_hash', 'active' => ['enabled', 'is_admin']],
        ['table' => 'users', 'user' => 'username', 'password' => 'password_hash', 'active' => ['is_active']],
    ];

    foreach ($candidates as $candidate) {
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?');
        $stmt->execute([$candidate['table']]);
        if (!$stmt->fetchColumn()) {
            continue;
        }

        $columns = array_column($pdo->query("SHOW COLUMNS FROM `{$candidate['table']}`")->fetchAll(), 'Field');
        if (!in_array($candidate['user'], $columns, true) || !in_array($candidate['password'], $columns, true)) {
            continue;
        }

        $stmt = $pdo->prepare("SELECT * FROM `{$candidate['table']}` WHERE `{$candidate['user']}` = ? LIMIT 1");
        $stmt->execute(['admin']);
        $row = $stmt->fetch();
        if (!$row) {
            fail_local_check("No local admin row found in {$candidate['table']}");
        }
        foreach ($candidate['active'] as $activeColumn) {
            if (array_key_exists($activeColumn, $row) && (int) $row[$activeColumn] !== 1) {
                fail_local_check("Local admin is not active for {$activeColumn}");
            }
        }
        if (!password_verify('admin123', (string) $row[$candidate['password']])) {
            fail_local_check('Local admin password is not admin123');
        }

        echo "[local-db-admin] database ok: {$name} as {$user}\n";
        echo "[local-db-admin] admin ok: {$candidate['table']}.admin\n";
        exit(0);
    }

    fail_local_check('No supported admin table found');
} catch (Throwable $error) {
    fail_local_check($error->getMessage());
}
