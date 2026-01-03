<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use BowWowSpa\Http\Response;
use BowWowSpa\Services\AuthService;
use BowWowSpa\Services\AuditService;

final class AdminAuditController
{
    public function __construct(
        private readonly AuthService $auth = new AuthService(),
        private readonly AuditService $audit = new AuditService(),
    ) {
    }

    public function index(): void
    {
        $this->auth->ensureSectionAccess('audit');
        Response::success(['items' => $this->audit->recent()]);
    }
}
