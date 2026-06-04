<?php

declare(strict_types=1);

namespace BowWowSpa\Support;

final class SecretBox
{
    private string $key;

    public function __construct(?string $encodedKey = null)
    {
        $encodedKey ??= (string) Config::get('calendar_sync.google_token_key', '');
        $this->key = $this->normalizeKey($encodedKey);
    }

    public function encrypt(string $plainText): string
    {
        if ($plainText === '') {
            return '';
        }

        $iv = random_bytes(12);
        $tag = '';
        $cipherText = openssl_encrypt($plainText, 'aes-256-gcm', $this->key, OPENSSL_RAW_DATA, $iv, $tag);
        if (!is_string($cipherText)) {
            throw new \RuntimeException('Unable to encrypt calendar token.');
        }

        return 'v1:' . base64_encode(json_encode([
            'iv' => base64_encode($iv),
            'tag' => base64_encode($tag),
            'data' => base64_encode($cipherText),
        ], JSON_THROW_ON_ERROR));
    }

    public function decrypt(?string $sealed): ?string
    {
        $sealed = trim((string) $sealed);
        if ($sealed === '') {
            return null;
        }

        if (!str_starts_with($sealed, 'v1:')) {
            return null;
        }

        $decoded = base64_decode(substr($sealed, 3), true);
        if (!is_string($decoded)) {
            return null;
        }

        $payload = json_decode($decoded, true);
        if (!is_array($payload)) {
            return null;
        }

        $iv = base64_decode((string) ($payload['iv'] ?? ''), true);
        $tag = base64_decode((string) ($payload['tag'] ?? ''), true);
        $cipherText = base64_decode((string) ($payload['data'] ?? ''), true);
        if (!is_string($iv) || !is_string($tag) || !is_string($cipherText)) {
            return null;
        }

        $plainText = openssl_decrypt($cipherText, 'aes-256-gcm', $this->key, OPENSSL_RAW_DATA, $iv, $tag);
        return is_string($plainText) ? $plainText : null;
    }

    private function normalizeKey(string $encodedKey): string
    {
        $encodedKey = trim($encodedKey);
        if ($encodedKey === '') {
            throw new \RuntimeException('GOOGLE_CALENDAR_TOKEN_KEY is required before connecting Google Calendar.');
        }

        $decoded = base64_decode($encodedKey, true);
        $key = is_string($decoded) && strlen($decoded) >= 32 ? $decoded : $encodedKey;
        if (strlen($key) < 32) {
            throw new \RuntimeException('GOOGLE_CALENDAR_TOKEN_KEY must contain at least 32 bytes.');
        }

        return substr($key, 0, 32);
    }
}
