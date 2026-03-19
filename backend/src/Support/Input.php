<?php

declare(strict_types=1);

namespace BowWowSpa\Support;

final class Input
{
    public static function clean(mixed $value, int $maxLength = 255, bool $allowNewlines = false): ?string
    {
        $string = is_string($value) || is_numeric($value) ? (string) $value : '';
        $string = str_replace("\0", '', $string);

        if ($allowNewlines) {
            $string = str_replace(["\r\n", "\r"], "\n", $string);
            $string = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $string) ?? '';
        } else {
            $string = preg_replace('/[\x00-\x1F\x7F]/u', '', $string) ?? '';
            $string = preg_replace('/\s+/u', ' ', $string) ?? $string;
        }

        $string = trim($string);
        if ($string === '') {
            return null;
        }

        if (function_exists('mb_substr')) {
            $string = mb_substr($string, 0, $maxLength);
        } else {
            $string = substr($string, 0, $maxLength);
        }

        return $string !== '' ? $string : null;
    }

    public static function email(mixed $value, int $maxLength = 191): ?string
    {
        $email = self::clean($value, $maxLength);
        if ($email === null) {
            return null;
        }

        $email = strtolower($email);
        return filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null;
    }

    public static function phone(mixed $value, int $maxLength = 50): ?string
    {
        $phone = self::clean($value, $maxLength);
        if ($phone === null) {
            return null;
        }

        $phone = preg_replace('/[^0-9A-Za-z+\-\(\)\.\sx]/', '', $phone) ?? '';
        $phone = trim(preg_replace('/\s+/u', ' ', $phone) ?? $phone);

        return $phone !== '' ? $phone : null;
    }

    public static function url(mixed $value, int $maxLength = 255): ?string
    {
        $url = self::clean($value, $maxLength);
        if ($url === null) {
            return null;
        }

        return filter_var($url, FILTER_VALIDATE_URL) ? $url : null;
    }
}
