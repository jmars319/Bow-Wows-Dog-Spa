<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use BowWowSpa\Http\Request;
use BowWowSpa\Http\Response;
use BowWowSpa\Services\AuditService;
use BowWowSpa\Services\AuthService;
use BowWowSpa\Services\CalendarIntegrationService;

final class AdminCalendarIntegrationsController
{
    public function __construct(
        private readonly AuthService $auth = new AuthService(),
        private readonly CalendarIntegrationService $integrations = new CalendarIntegrationService(),
        private readonly AuditService $audit = new AuditService(),
    ) {
    }

    public function index(): void
    {
        $this->auth->ensureSectionAccess('system');
        Response::success($this->integrations->dashboardPayload());
    }

    public function save(Request $request): void
    {
        $user = $this->auth->requireAuth();
        $this->auth->ensureSectionAccess('system');

        try {
            $saved = $this->integrations->save($request->body);
        } catch (\RuntimeException $e) {
            Response::error('calendar_integration_error', $e->getMessage(), 422);
        }

        $this->audit->log(
            $user['id'],
            !empty($request->body['id']) ? 'calendar_integration_update' : 'calendar_integration_create',
            'calendar_integrations',
            $saved['id'],
            [
                'provider' => $saved['provider'],
                'is_enabled' => $saved['is_enabled'],
                'sync_confirmed_bookings' => $saved['sync_confirmed_bookings'],
            ]
        );

        Response::success($saved);
    }

    public function delete(Request $request): void
    {
        $user = $this->auth->requireAuth();
        $this->auth->ensureSectionAccess('system');
        $id = (int) ($request->params['id'] ?? 0);
        if ($id <= 0) {
            Response::error('validation_error', 'Calendar integration id required', 422);
        }

        $deleted = $this->integrations->delete($id);
        if ($deleted === null) {
            Response::error('not_found', 'Calendar integration not found', 404);
        }

        $this->audit->log(
            $user['id'],
            'calendar_integration_delete',
            'calendar_integrations',
            $id,
            [
                'provider' => $deleted['provider'],
                'label' => $deleted['label'],
            ]
        );

        Response::success(['deleted' => true]);
    }
}
