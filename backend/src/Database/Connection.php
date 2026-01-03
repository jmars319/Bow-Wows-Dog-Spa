<?php

declare(strict_types=1);

namespace BowWowSpa\Database;

use PDO;
use PDOException;

final class Connection
{
    private static ?PDO $pdo = null;

    public static function init(array $config): void
    {
        if (self::$pdo !== null) {
            return;
        }

        $dsn = $config['dsn'] ?? '';
        $username = $config['username'] ?? '';
        $password = $config['password'] ?? '';
        $options = $config['options'] ?? [];

        try {
            self::$pdo = new PDO($dsn, $username, $password, $options);
        } catch (PDOException $e) {
            throw new PDOException('Unable to connect to database: ' . $e->getMessage(), (int) $e->getCode());
        }
    }

    public static function pdo(): PDO
    {
        if (self::$pdo === null) {
            throw new PDOException('Connection not initialized.');
        }

        return self::$pdo;
    }
}
