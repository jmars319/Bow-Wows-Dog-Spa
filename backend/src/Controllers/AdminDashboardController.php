<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use BowWowSpa\Http\Response;
use BowWowSpa\Services\AuthService;
use BowWowSpa\Services\BookingService;
use BowWowSpa\Services\AuditService;

final class AdminDashboardController
{
    public function __construct(
        private readonly AuthService $auth = new AuthService(),
        private readonly BookingService $bookings = new BookingService(),
        private readonly AuditService $audit = new AuditService(),
    ) {
    }

    public function overview(): void
    {
        $this->auth->requireAuth();
        Response::success([
            'stats' => $this->bookings->stats(),
            'recent_activity' => $this->audit->recent(10),
        ]);
    }
}
