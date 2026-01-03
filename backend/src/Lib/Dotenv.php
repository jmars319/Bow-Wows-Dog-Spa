<?php

declare(strict_types=1);

namespace BowWowSpa\Lib;

final class Dotenv
{
    public static function load(string $path): void
    {
        if (!is_file($path)) {
            self::failMissing($path);
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            self::failMissing($path);
        }

        foreach ($lines as $line) {
            $line = trim($line);

            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }

            if (false === strpos($line, '=')) {
                continue;
            }

            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            $value = self::parseValue($value);

            if ($key === '') {
                continue;
            }

            putenv(sprintf('%s=%s', $key, $value));
            $_ENV[$key] = $value;
        }
    }

    private static function parseValue(string $value): string
    {
        $value = trim($value);

        if ($value === '') {
            return '';
        }

        if ($value[0] === '"' && str_ends_with($value, '"')) {
            $value = substr($value, 1, -1);
        } elseif ($value[0] === "'" && str_ends_with($value, "'")) {
            $value = substr($value, 1, -1);
        }

        // Remove trailing comments
        if (str_contains($value, ' #')) {
            [$value] = explode(' #', $value, 2);
            $value = rtrim($value);
        }

        return $value;
    }

    private static function failMissing(string $path): void
    {
        $message = <<<TXT
Configuration file missing.
Expected: backend/.env
To fix:
1) Copy backend/.env.example to backend/.env
2) Fill in database and email credentials
3) Ensure the file is readable by PHP
TXT;

        throw new \RuntimeException($message);
    }
}
