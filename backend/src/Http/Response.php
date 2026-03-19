<?php

declare(strict_types=1);

namespace BowWowSpa\Http;

final class Response
{
    public static function json(array $payload, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function success(mixed $data = null, int $status = 200): void
    {
        self::json(['ok' => true, 'data' => $data], $status);
    }

    public static function error(string $code, string $message, int $status = 400, array $meta = []): void
    {
        $error = [
            'code' => $code,
            'message' => $message,
        ];

        foreach ($meta as $key => $value) {
            $error[$key] = $value;
        }

        self::json([
            'ok' => false,
            'error' => $error,
        ], $status);
    }
}
