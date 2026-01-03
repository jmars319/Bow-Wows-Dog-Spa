<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use BowWowSpa\Http\Request;
use BowWowSpa\Http\Response;
use BowWowSpa\Services\AuthService;
use BowWowSpa\Services\AdminUserService;

final class AdminUsersController
{
    public function __construct(
        private readonly AuthService $auth = new AuthService(),
        private readonly AdminUserService $users = new AdminUserService(),
    ) {
    }

    private function ensureSuper(): array
    {
        $user = $this->auth->requireAuth();
        if ($user['role'] !== 'super_admin') {
            Response::error('forbidden', 'Super admin required', 403);
        }

        return $user;
    }

    public function index(): void
    {
        $this->ensureSuper();
        Response::success(['items' => $this->users->list()]);
    }

    public function save(Request $request): void
    {
        $user = $this->ensureSuper();
        if (empty($request->body['email']) || empty($request->body['role'])) {
            Response::error('validation_error', 'Email and role required', 422);
        }

        $this->users->save($request->body);
        Response::success(['saved' => true]);
    }
}
