<?php

declare(strict_types=1);

namespace BowWowSpa\Database;

use PDO;
use PDOStatement;

final class Database
{
    public static function fetchAll(string $sql, array $params = []): array
    {
        $stmt = self::run($sql, $params);
        return $stmt->fetchAll();
    }

    public static function fetch(string $sql, array $params = []): ?array
    {
        $stmt = self::run($sql, $params);
        $row = $stmt->fetch();

        return $row === false ? null : $row;
    }

    public static function insert(string $sql, array $params = []): int
    {
        $stmt = self::run($sql, $params);
        return (int) Connection::pdo()->lastInsertId();
    }

    public static function run(string $sql, array $params = []): PDOStatement
    {
        $stmt = Connection::pdo()->prepare($sql);
        $stmt->execute($params);

        return $stmt;
    }

    public static function transaction(callable $callback): mixed
    {
        $pdo = Connection::pdo();
        try {
            $pdo->beginTransaction();
            $result = $callback($pdo);
            $pdo->commit();
            return $result;
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
}
