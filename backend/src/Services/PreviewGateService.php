<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Support\Config;

final class PreviewGateService
{
    public function isEnabled(): bool
    {
        return (bool) Config::get('preview.enabled', true);
    }

    public function password(): ?string
    {
        $password = Config::get('preview.password');
        return $password !== '' ? $password : null;
    }

    public function cookieName(): string
    {
        return Config::get('preview.cookie_name', 'preview_ok');
    }

    public function cookieTtl(): int
    {
        return (int) Config::get('preview.cookie_ttl', 86400);
    }

    public function hasAccess(): bool
    {
        if (!$this->isEnabled()) {
            return true;
        }

        $token = $_COOKIE[$this->cookieName()] ?? null;
        if (!$token) {
            return false;
        }

        [$expires, $signature] = $this->splitToken($token);
        if ($expires === null || $expires < time()) {
            return false;
        }

        $expected = $this->signatureFor($expires);
        return hash_equals($expected, $signature);
    }

    public function grantAccess(): void
    {
        $expires = time() + $this->cookieTtl();
        $token = $this->buildToken($expires);

        $params = [
            'expires' => $expires,
            'path' => '/',
            'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
            'httponly' => true,
            'samesite' => 'Lax',
        ];

        setcookie($this->cookieName(), $token, $params);
    }

    public function passwordMatches(string $candidate): bool
    {
        $password = $this->password();
        if ($password === null) {
            return true;
        }

        return hash_equals($password, $candidate);
    }

    private function buildToken(int $expires): string
    {
        $signature = $this->signatureFor($expires);
        return $expires . '.' . $signature;
    }

    private function splitToken(string $token): array
    {
        if (!str_contains($token, '.')) {
            return [null, null];
        }

        [$expires, $signature] = explode('.', $token, 2);
        if (!ctype_digit($expires)) {
            return [null, null];
        }

        return [(int) $expires, $signature];
    }

    private function signatureFor(int $expires): string
    {
        $payload = $expires . '|' . ($this->password() ?? 'open');
        return hash_hmac('sha256', $payload, $this->secret());
    }

    private function secret(): string
    {
        return (string) Config::get('preview.secret', Config::get('app.url', 'preview-secret'));
    }
}
