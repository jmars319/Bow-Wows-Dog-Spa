<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use BowWowSpa\Http\Request;
use BowWowSpa\Http\Response;
use BowWowSpa\Services\AuthService;
use BowWowSpa\Services\RetailService;

final class AdminRetailController
{
    public function __construct(
        private readonly AuthService $auth = new AuthService(),
        private readonly RetailService $retail = new RetailService(),
    ) {
    }

    public function index(): void
    {
        $this->auth->ensureSectionAccess('retail');
        Response::success(['items' => $this->retail->list()]);
    }

    public function save(Request $request): void
    {
        $this->auth->ensureSectionAccess('retail');
        $item = $this->retail->save($request->body);
        Response::success($item);
    }
}
