<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;
use BowWowSpa\Http\Response;
use BowWowSpa\Support\Input;

final class AuthService
{
    private const SESSION_KEY = 'admin_user_id';
    private const LOGIN_WINDOW_SECONDS = 900;
    private const LOGIN_MAX_ATTEMPTS = 5;

    private const ROLE_SECTIONS = [
        'super_admin' => ['*'],
        'manager' => [
            'dashboard',
            'booking',
            'schedule',
            'content',
            'services',
            'reviews',
            'gallery',
            'contact_messages',
            'media',
            'retail',
            'audit',
            'system',
        ],
        'scheduler' => ['schedule', 'booking'],
        'content_editor' => ['content', 'services', 'reviews', 'gallery', 'contact_messages', 'media', 'retail'],
    ];

    private ?bool $usernameColumnExists = null;

    public function attempt(string $identifier, string $password, ?string $ip = null): ?array
    {
        $identifier = Input::clean($identifier, 191);
        if ($identifier === null || $password === '') {
            $this->logLogin('failed', $identifier ?? 'unknown', $ip);
            return null;
        }

        $sql = 'SELECT * FROM admin_users WHERE email = :identifier AND is_enabled = 1 LIMIT 1';
        if ($this->usernameColumnExists()) {
            $sql = 'SELECT * FROM admin_users WHERE (email = :identifier OR username = :identifier) AND is_enabled = 1 LIMIT 1';
        }

        $user = Database::fetch($sql, ['identifier' => $identifier]);

        if (!$user || !password_verify($password, $user['password_hash'])) {
            $this->logLogin('failed', $identifier, $ip);
            return null;
        }

        if (password_needs_rehash((string) $user['password_hash'], PASSWORD_DEFAULT)) {
            Database::run(
                'UPDATE admin_users SET password_hash = :password_hash, updated_at = NOW() WHERE id = :id',
                [
                    'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                    'id' => $user['id'],
                ]
            );
        }

        session_regenerate_id(true);
        $_SESSION[self::SESSION_KEY] = (int) $user['id'];
        Database::run('UPDATE admin_users SET last_login_at = NOW() WHERE id = :id', ['id' => $user['id']]);
        $this->clearFailedAttempts($identifier, $ip);
        $this->logLogin('success', $identifier, $ip);
        return $this->sanitize($user);
    }

    public function logout(): void
    {
        $_SESSION = [];
        unset($_SESSION[self::SESSION_KEY]);
        session_regenerate_id(true);

        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                time() - 42000,
                $params['path'] ?? '/',
                $params['domain'] ?? '',
                (bool) ($params['secure'] ?? false),
                (bool) ($params['httponly'] ?? true)
            );
        }
    }

    public function user(): ?array
    {
        $id = $_SESSION[self::SESSION_KEY] ?? null;
        if (!$id) {
            return null;
        }

        $user = Database::fetch('SELECT * FROM admin_users WHERE id = :id AND is_enabled = 1', ['id' => $id]);
        return $user ? $this->sanitize($user) : null;
    }

    public function requireAuth(): array
    {
        $user = $this->user();
        if (!$user) {
            Response::error('unauthorized', 'Authentication required.', 401);
        }

        return $user;
    }

    public function ensureSectionAccess(string $section): void
    {
        $user = $this->requireAuth();
        if ($user['role'] === 'super_admin') {
            return;
        }

        $available = self::ROLE_SECTIONS[$user['role']] ?? [];
        if (!in_array('*', $available, true) && !in_array($section, $available, true)) {
            Response::error('forbidden', 'Insufficient permissions.', 403);
        }
    }

    public function allowedSections(array $user): array
    {
        if ($user['role'] === 'super_admin') {
            return ['*'];
        }

        return self::ROLE_SECTIONS[$user['role']] ?? [];
    }

    private function sanitize(array $user): array
    {
        unset($user['password_hash']);
        return $user;
    }

    public function retryAfterSeconds(string $identifier, ?string $ip = null): int
    {
        $bucket = $this->loadFailedAttempts($identifier, $ip);
        if (count($bucket) < self::LOGIN_MAX_ATTEMPTS) {
            return 0;
        }

        $oldest = min($bucket);
        $retryAfter = self::LOGIN_WINDOW_SECONDS - (time() - $oldest);
        return max(0, $retryAfter);
    }

    public function recordFailedAttempt(string $identifier, ?string $ip = null): void
    {
        $bucket = $this->loadFailedAttempts($identifier, $ip);
        $bucket[] = time();
        $this->storeFailedAttempts($identifier, $ip, $bucket);
    }

    public function clearFailedAttempts(string $identifier, ?string $ip = null): void
    {
        $path = $this->throttlePath($identifier, $ip);
        if (is_file($path)) {
            @unlink($path);
        }
    }

    private function usernameColumnExists(): bool
    {
        if ($this->usernameColumnExists !== null) {
            return $this->usernameColumnExists;
        }

        $row = Database::fetch(
            'SELECT COUNT(*) AS total
             FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = "admin_users" AND column_name = "username"'
        );

        $this->usernameColumnExists = ((int) ($row['total'] ?? 0)) > 0;
        return $this->usernameColumnExists;
    }

    private function logLogin(string $status, string $identifier, ?string $ip): void
    {
        error_log(sprintf(
            '[BowWow][admin_login_%s] identifier=%s ip=%s',
            $status,
            $identifier !== '' ? $identifier : 'unknown',
            $ip ?: 'unknown'
        ));
    }

    private function throttlePath(string $identifier, ?string $ip): string
    {
        $directory = rtrim(sys_get_temp_dir(), '/') . '/bowwow-rate-limit';
        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
            throw new \RuntimeException('Unable to initialize login throttle storage.');
        }

        $key = hash('sha256', strtolower(trim($identifier)) . '|' . trim((string) $ip));
        return $directory . '/' . $key . '.json';
    }

    private function loadFailedAttempts(string $identifier, ?string $ip): array
    {
        $path = $this->throttlePath($identifier, $ip);
        if (!is_file($path)) {
            return [];
        }

        $contents = file_get_contents($path);
        $decoded = $contents ? json_decode($contents, true) : [];
        $attempts = is_array($decoded['attempts'] ?? null) ? $decoded['attempts'] : [];
        $cutoff = time() - self::LOGIN_WINDOW_SECONDS;

        return array_values(array_filter(
            array_map('intval', $attempts),
            static fn (int $attemptAt): bool => $attemptAt >= $cutoff
        ));
    }

    private function storeFailedAttempts(string $identifier, ?string $ip, array $attempts): void
    {
        $path = $this->throttlePath($identifier, $ip);
        file_put_contents($path, json_encode(['attempts' => $attempts], JSON_UNESCAPED_SLASHES), LOCK_EX);
    }
}
