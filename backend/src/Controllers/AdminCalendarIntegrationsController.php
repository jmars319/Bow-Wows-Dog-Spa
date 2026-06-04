<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use BowWowSpa\Http\Request;
use BowWowSpa\Http\Response;
use BowWowSpa\Services\AuditService;
use BowWowSpa\Services\AuthService;
use BowWowSpa\Services\CalendarIntegrationService;
use BowWowSpa\Services\CalendarSyncService;
use BowWowSpa\Support\Config;

final class AdminCalendarIntegrationsController
{
    public function __construct(
        private readonly AuthService $auth = new AuthService(),
        private readonly CalendarIntegrationService $integrations = new CalendarIntegrationService(),
        private readonly CalendarSyncService $sync = new CalendarSyncService(),
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

    public function connectGoogle(Request $request): void
    {
        $this->auth->requireAuth();
        $this->auth->ensureSectionAccess('system');
        $id = (int) ($request->params['id'] ?? 0);
        if ($id <= 0) {
            Response::error('validation_error', 'Calendar integration id required', 422);
        }

        try {
            $state = bin2hex(random_bytes(16));
            $_SESSION['bowwow_google_calendar_oauth_state'] = $state;
            $url = $this->integrations->googleAuthorizationUrl($id, $state);
        } catch (\Throwable $e) {
            Response::error('calendar_oauth_error', $e->getMessage(), 422);
        }

        Response::success(['authorization_url' => $url]);
    }

    public function googleCallback(Request $request): void
    {
        $user = $this->auth->requireAuth();
        $this->auth->ensureSectionAccess('system');

        $code = trim((string) ($request->query['code'] ?? ''));
        $stateParam = trim((string) ($request->query['state'] ?? ''));
        [$state, $integrationId] = array_pad(explode(':', $stateParam, 2), 2, null);
        $expectedState = $_SESSION['bowwow_google_calendar_oauth_state'] ?? null;
        unset($_SESSION['bowwow_google_calendar_oauth_state']);

        $redirect = rtrim((string) Config::get('app.url', ''), '/') . '/admin/calendar-sync';
        if ($code === '' || !is_string($expectedState) || $state !== $expectedState || (int) $integrationId <= 0) {
            header('Location: ' . $redirect . '?calendar=oauth-error');
            exit;
        }

        try {
            $saved = $this->integrations->connectGoogle((int) $integrationId, $code);
            $this->audit->log($user['id'], 'calendar_google_connect', 'calendar_integrations', $saved['id'], [
                'target_calendar_reference' => $saved['target_calendar_reference'],
            ]);
            header('Location: ' . $redirect . '?calendar=connected');
            exit;
        } catch (\Throwable $e) {
            error_log('[BowWow][calendar_google_callback_failed] ' . $e->getMessage());
            header('Location: ' . $redirect . '?calendar=connect-error');
            exit;
        }
    }

    public function disconnectGoogle(Request $request): void
    {
        $user = $this->auth->requireAuth();
        $this->auth->ensureSectionAccess('system');
        $id = (int) ($request->params['id'] ?? 0);
        if ($id <= 0) {
            Response::error('validation_error', 'Calendar integration id required', 422);
        }

        try {
            $saved = $this->integrations->disconnectGoogle($id);
        } catch (\Throwable $e) {
            Response::error('calendar_oauth_error', $e->getMessage(), 422);
        }

        $this->audit->log($user['id'], 'calendar_google_disconnect', 'calendar_integrations', $id, []);
        Response::success($saved);
    }

    public function test(Request $request): void
    {
        $this->auth->requireAuth();
        $this->auth->ensureSectionAccess('system');
        $id = (int) ($request->params['id'] ?? 0);
        if ($id <= 0) {
            Response::error('validation_error', 'Calendar integration id required', 422);
        }

        try {
            $result = $this->integrations->testConnection($id);
        } catch (\Throwable $e) {
            Response::error('calendar_test_error', $e->getMessage(), 422);
        }

        Response::success($result);
    }

    public function runSync(Request $request): void
    {
        $user = $this->auth->requireAuth();
        $this->auth->ensureSectionAccess('system');

        try {
            $result = $this->sync->processPendingJobs(25);
        } catch (\Throwable $e) {
            Response::error('calendar_sync_error', $e->getMessage(), 422);
        }

        $this->audit->log($user['id'], 'calendar_sync_run', 'calendar_sync_jobs', null, $result);
        Response::success($result);
    }
}
