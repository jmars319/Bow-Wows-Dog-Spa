<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;
use BowWowSpa\Support\Config;
use BowWowSpa\Http\Response;

final class AuthService
{
    private const SESSION_KEY = 'admin_user_id';

    private const ROLE_SECTIONS = [
        'super_admin' => ['*'],
        'manager' => [
            'dashboard',
            'booking',
            'schedule',
            'content',
            'media',
            'happy_clients',
            'retail',
            'audit',
            'system',
        ],
        'scheduler' => ['schedule', 'booking'],
        'content_editor' => ['content', 'media', 'happy_clients', 'retail'],
    ];

    public function attempt(string $email, string $password): ?array
    {
        $user = Database::fetch('SELECT * FROM admin_users WHERE email = :email AND is_enabled = 1', [
            'email' => $email,
        ]);

        if (!$user || !password_verify($password, $user['password_hash'])) {
            return null;
        }

        $_SESSION[self::SESSION_KEY] = (int) $user['id'];
        Database::run('UPDATE admin_users SET last_login_at = NOW() WHERE id = :id', ['id' => $user['id']]);
        return $this->sanitize($user);
    }

    public function logout(): void
    {
        unset($_SESSION[self::SESSION_KEY]);
        session_regenerate_id(true);
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
}
