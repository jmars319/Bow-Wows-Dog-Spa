<?php

declare(strict_types=1);

namespace BowWowSpa\Support;

final class Config
{
    private static array $config = [];

    public static function load(array $config): void
    {
        self::$config = $config;
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        $segments = explode('.', $key);
        $value = self::$config;

        foreach ($segments as $segment) {
            if (!is_array($value) || !array_key_exists($segment, $value)) {
                return $default;
            }

            $value = $value[$segment];
        }

        return $value;
    }
}
