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
        $email = $request->body['email'] ?? null;
        $password = $request->body['password'] ?? null;
        if (!$email || !$password) {
            Response::error('validation_error', 'Email and password required', 422);
        }

        $user = $this->auth->attempt($email, $password);
        if (!$user) {
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
