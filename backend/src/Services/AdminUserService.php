<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;

final class AdminUserService
{
    public function list(): array
    {
        return Database::fetchAll('SELECT id, email, role, is_enabled, created_at, updated_at FROM admin_users ORDER BY created_at DESC');
    }

    public function save(array $payload): void
    {
        if (!empty($payload['id'])) {
            $fields = [
                'email' => $payload['email'],
                'role' => $payload['role'],
                'enabled' => (int) $payload['is_enabled'],
                'id' => $payload['id'],
            ];

            $sql = 'UPDATE admin_users SET email = :email, role = :role, is_enabled = :enabled';
            if (!empty($payload['password'])) {
                $sql .= ', password_hash = :password';
                $fields['password'] = password_hash($payload['password'], PASSWORD_DEFAULT);
            }
            $sql .= ', updated_at = NOW() WHERE id = :id';

            Database::run($sql, $fields);
            return;
        }

        Database::insert(
            'INSERT INTO admin_users (email, password_hash, role, is_enabled, created_at, updated_at) 
             VALUES (:email, :password, :role, :enabled, NOW(), NOW())',
            [
                'email' => $payload['email'],
                'password' => password_hash($payload['password'], PASSWORD_DEFAULT),
                'role' => $payload['role'],
                'enabled' => (int) $payload['is_enabled'],
            ]
        );
    }
}
