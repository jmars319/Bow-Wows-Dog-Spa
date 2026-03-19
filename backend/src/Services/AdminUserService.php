<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;
use BowWowSpa\Support\Input;

final class AdminUserService
{
    private ?bool $usernameColumnExists = null;

    public function list(): array
    {
        $sql = 'SELECT id, email, role, is_enabled, created_at, updated_at FROM admin_users ORDER BY created_at DESC';
        if ($this->usernameColumnExists()) {
            $sql = 'SELECT id, username, email, role, is_enabled, created_at, updated_at FROM admin_users ORDER BY created_at DESC';
        }

        return Database::fetchAll($sql);
    }

    public function save(array $payload): void
    {
        $username = $this->normalizeUsername($payload['username'] ?? null);
        $email = Input::email($payload['email'] ?? null);
        $role = trim((string) ($payload['role'] ?? ''));
        $password = isset($payload['password']) ? (string) $payload['password'] : '';

        if ($email === null) {
            throw new \RuntimeException('A valid admin email is required.');
        }

        if (!in_array($role, ['super_admin', 'manager', 'scheduler', 'content_editor'], true)) {
            throw new \RuntimeException('Admin role is invalid.');
        }

        if ($password !== '' && strlen($password) < 8) {
            throw new \RuntimeException('Admin passwords must be at least 8 characters.');
        }

        if (!empty($payload['id'])) {
            $fields = [
                'email' => $email,
                'role' => $role,
                'enabled' => (int) $payload['is_enabled'],
                'id' => $payload['id'],
            ];

            $sql = 'UPDATE admin_users SET email = :email, role = :role, is_enabled = :enabled';
            if ($this->usernameColumnExists()) {
                $sql = 'UPDATE admin_users SET username = :username, email = :email, role = :role, is_enabled = :enabled';
                $fields['username'] = $username;
            }
            if ($password !== '') {
                $sql .= ', password_hash = :password';
                $fields['password'] = password_hash($password, PASSWORD_DEFAULT);
            }
            $sql .= ', updated_at = NOW() WHERE id = :id';

            Database::run($sql, $fields);
            return;
        }

        if ($password === '') {
            throw new \RuntimeException('Password required for new admin users.');
        }

        $fields = [
            'email' => $email,
            'password' => password_hash($password, PASSWORD_DEFAULT),
            'role' => $role,
            'enabled' => (int) $payload['is_enabled'],
        ];

        $sql = 'INSERT INTO admin_users (email, password_hash, role, is_enabled, created_at, updated_at) 
                VALUES (:email, :password, :role, :enabled, NOW(), NOW())';
        if ($this->usernameColumnExists()) {
            $sql = 'INSERT INTO admin_users (username, email, password_hash, role, is_enabled, created_at, updated_at) 
                    VALUES (:username, :email, :password, :role, :enabled, NOW(), NOW())';
            $fields['username'] = $username;
        }

        Database::insert($sql, $fields);
    }

    private function normalizeUsername(mixed $username): ?string
    {
        $value = Input::clean($username, 50);
        return $value ?: null;
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
}
