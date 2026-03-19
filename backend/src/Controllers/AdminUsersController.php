<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use PDOException;
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
        $this->ensureSuper();
        if (empty($request->body['email']) || empty($request->body['role'])) {
            Response::error('validation_error', 'Email and role required', 422);
        }

        $username = trim((string) ($request->body['username'] ?? ''));
        if ($username !== '' && !preg_match('/^[A-Za-z0-9._-]{3,50}$/', $username)) {
            Response::error('validation_error', 'Username must be 3-50 characters and use only letters, numbers, periods, hyphens, or underscores.', 422);
        }

        if (empty($request->body['id']) && empty($request->body['password'])) {
            Response::error('validation_error', 'Password required for new admin users', 422);
        }

        try {
            $this->users->save($request->body);
        } catch (\RuntimeException $e) {
            Response::error('validation_error', $e->getMessage(), 422);
        } catch (PDOException $e) {
            if (str_contains($e->getMessage(), 'Duplicate entry')) {
                Response::error('validation_error', 'Email or username already exists', 422);
            }

            throw $e;
        }
        Response::success(['saved' => true]);
    }
}
