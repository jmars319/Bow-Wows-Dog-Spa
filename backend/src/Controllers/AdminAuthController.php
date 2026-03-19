<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use BowWowSpa\Http\Request;
use BowWowSpa\Http\Response;
use BowWowSpa\Services\AuthService;

final class AdminAuthController
{
    public function __construct(private readonly AuthService $auth = new AuthService())
    {
    }

    public function login(Request $request): void
    {
        $identifier = trim((string) ($request->body['identifier'] ?? $request->body['email'] ?? ''));
        $password = $request->body['password'] ?? null;
        if ($identifier === '' || !$password) {
            Response::error('validation_error', 'Email or username and password required', 422);
        }

        $ip = trim((string) ($request->server['REMOTE_ADDR'] ?? ''));
        $retryAfter = $this->auth->retryAfterSeconds($identifier, $ip);
        if ($retryAfter > 0) {
            Response::error('rate_limited', 'Too many login attempts. Please wait and try again.', 429, [
                'retry_after_seconds' => $retryAfter,
            ]);
        }

        $user = $this->auth->attempt($identifier, $password, $ip);
        if (!$user) {
            $this->auth->recordFailedAttempt($identifier, $ip);
            Response::error('invalid_credentials', 'Invalid login', 401);
        }

        Response::success([
            'user' => $user,
            'allowed_sections' => $this->auth->allowedSections($user),
        ]);
    }

    public function logout(): void
    {
        $this->auth->logout();
        Response::success(['logged_out' => true]);
    }

    public function me(): void
    {
        $user = $this->auth->user();
        if (!$user) {
            Response::error('unauthorized', 'Not logged in', 401);
        }

        Response::success([
            'user' => $user,
            'allowed_sections' => $this->auth->allowedSections($user),
        ]);
    }
}
