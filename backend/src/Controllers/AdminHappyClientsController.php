<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use BowWowSpa\Http\Request;
use BowWowSpa\Http\Response;
use BowWowSpa\Services\AuthService;
use BowWowSpa\Services\HappyClientsService;

final class AdminHappyClientsController
{
    public function __construct(
        private readonly AuthService $auth = new AuthService(),
        private readonly HappyClientsService $clients = new HappyClientsService(),
    ) {
    }

    public function index(): void
    {
        $this->auth->ensureSectionAccess('happy_clients');
        Response::success(['items' => $this->clients->list()]);
    }

    public function save(Request $request): void
    {
        $this->auth->ensureSectionAccess('happy_clients');
        $entry = $this->clients->save($request->body);
        Response::success($entry);
    }
}
