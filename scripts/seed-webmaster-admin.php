#!/usr/bin/env php
<?php

declare(strict_types=1);

$config = [
    'site' => 'Bow Wow Dog Spa',
    'table' => 'admin_users',
    'username' => 'username',
    'email' => 'email',
    'password' => 'password_hash',
    'display' => 'display_name',
    'extras' => ['role' => 'super_admin', 'is_enabled' => 1],
];

main($config);

function main(array $config): void
{
    $options = parse_options($_SERVER['argv'] ?? []);
    if (isset($options['help'])) {
        print_help();
        exit(0);
    }

    $root = dirname(__DIR__);
    $envPath = $options['env'] ?? ($root . '/backend/.env');
    load_env_file((string) $envPath);

    $username = trim((string) getenv_value('WEBMASTER_ADMIN_USERNAME', 'jason'));
    $email = trim((string) getenv_value('WEBMASTER_ADMIN_EMAIL', ''));
    $displayName = trim((string) getenv_value('WEBMASTER_ADMIN_NAME', 'Jason Marshall'));
    $password = (string) getenv_value('WEBMASTER_ADMIN_PASSWORD', '');

    if ($username === '' || !preg_match('/^[A-Za-z0-9._-]{3,100}$/', $username)) {
        fail('WEBMASTER_ADMIN_USERNAME must be 3-100 characters using letters, numbers, dot, dash, or underscore.');
    }
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        fail('WEBMASTER_ADMIN_EMAIL is required and must be a valid email address.');
    }
    if ($password === '') {
        fail('WEBMASTER_ADMIN_PASSWORD is required.');
    }
    if (strlen($password) < 12) {
        fail('WEBMASTER_ADMIN_PASSWORD must be at least 12 characters.');
    }

    if (isset($options['dry-run'])) {
        echo "[webmaster-admin] dry run ok for {$config['site']}: {$username} <{$email}> -> {$config['table']}\n";
        return;
    }

    $pdo = connect_pdo();
    $columns = table_columns($pdo, $config['table']);
    foreach ([$config['username'], $config['email'], $config['password']] as $requiredColumn) {
        if (!in_array($requiredColumn, $columns, true)) {
            fail("Missing expected column {$config['table']}.{$requiredColumn}");
        }
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $existing = find_existing_admin($pdo, $config, $username, $email);
    $values = [
        $config['username'] => $username,
        $config['email'] => $email,
        $config['password'] => $hash,
    ];
    if (($config['display'] ?? null) && in_array($config['display'], $columns, true)) {
        $values[$config['display']] = $displayName !== '' ? $displayName : $username;
    }
    foreach (($config['extras'] ?? []) as $column => $value) {
        if (in_array($column, $columns, true)) {
            $values[$column] = $value;
        }
    }

    if ($existing) {
        update_admin($pdo, $config['table'], $values, (int) $existing['id']);
        echo "[webmaster-admin] updated {$username} for {$config['site']}.\n";
        return;
    }

    insert_admin($pdo, $config['table'], $values);
    echo "[webmaster-admin] created {$username} for {$config['site']}.\n";
}

function parse_options(array $argv): array
{
    $options = [];
    for ($i = 1; $i < count($argv); $i++) {
        $arg = (string) $argv[$i];
        if ($arg === '--help' || $arg === '-h') {
            $options['help'] = true;
        } elseif ($arg === '--dry-run') {
            $options['dry-run'] = true;
        } elseif ($arg === '--env' && isset($argv[$i + 1])) {
            $options['env'] = (string) $argv[++$i];
        } elseif (str_starts_with($arg, '--env=')) {
            $options['env'] = substr($arg, 6);
        } else {
            fail("Unknown option: {$arg}");
        }
    }
    return $options;
}

function print_help(): void
{
    echo "Usage: WEBMASTER_ADMIN_EMAIL=you@example.com WEBMASTER_ADMIN_PASSWORD='...' php scripts/seed-webmaster-admin.php [--env backend/.env] [--dry-run]\n";
}

function load_env_file(string $path): void
{
    if (!is_file($path)) {
        return;
    }
    foreach (file($path, FILE_IGNORE_NEW_LINES) ?: [] as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value, " \t\n\r\0\x0B\"'");
        if ($key !== '' && getenv($key) === false) {
            putenv($key . '=' . $value);
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }
    }
}

function getenv_value(string $key, ?string $default = null): ?string
{
    $value = getenv($key);
    return $value === false ? $default : $value;
}

function connect_pdo(): PDO
{
    $host = getenv_value('DB_HOST', '127.0.0.1');
    $port = getenv_value('DB_PORT', '3306');
    $name = getenv_value('DB_NAME') ?? getenv_value('DB_DATABASE') ?? getenv_value('MYSQL_DATABASE');
    $user = getenv_value('DB_USER') ?? getenv_value('DB_USERNAME') ?? getenv_value('MYSQL_USER');
    $pass = getenv_value('DB_PASSWORD') ?? getenv_value('DB_PASS') ?? getenv_value('MYSQL_PASSWORD') ?? '';
    if (!$name || !$user) {
        fail('Missing DB_NAME or DB_USER in environment file.');
    }
    return new PDO(
        "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4",
        $user,
        $pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
}

function table_columns(PDO $pdo, string $table): array
{
    $stmt = $pdo->query('SHOW COLUMNS FROM `' . str_replace('`', '``', $table) . '`');
    return array_column($stmt->fetchAll(), 'Field');
}

function find_existing_admin(PDO $pdo, array $config, string $username, string $email): ?array
{
    $stmt = $pdo->prepare("SELECT id FROM `{$config['table']}` WHERE `{$config['username']}` = ? OR `{$config['email']}` = ? LIMIT 1");
    $stmt->execute([$username, $email]);
    $row = $stmt->fetch();
    return is_array($row) ? $row : null;
}

function update_admin(PDO $pdo, string $table, array $values, int $id): void
{
    $sets = [];
    $params = [];
    foreach ($values as $column => $value) {
        $sets[] = "`{$column}` = ?";
        $params[] = $value;
    }
    $params[] = $id;
    $stmt = $pdo->prepare("UPDATE `{$table}` SET " . implode(', ', $sets) . ' WHERE id = ?');
    $stmt->execute($params);
}

function insert_admin(PDO $pdo, string $table, array $values): void
{
    $columns = array_keys($values);
    $placeholders = array_fill(0, count($columns), '?');
    $stmt = $pdo->prepare(
        "INSERT INTO `{$table}` (`" . implode('`, `', $columns) . '`) VALUES (' . implode(', ', $placeholders) . ')'
    );
    $stmt->execute(array_values($values));
}

function fail(string $message): void
{
    fwrite(STDERR, "[webmaster-admin] {$message}\n");
    exit(1);
}
