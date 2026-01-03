<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use BowWowSpa\Http\Request;
use BowWowSpa\Http\Response;
use BowWowSpa\Services\AuthService;
use BowWowSpa\Services\ScheduleService;

final class AdminScheduleController
{
    public function __construct(
        private readonly AuthService $auth = new AuthService(),
        private readonly ScheduleService $schedule = new ScheduleService(),
    ) {
    }

    public function templates(): void
    {
        $this->auth->ensureSectionAccess('schedule');
        Response::success([
            'templates' => $this->schedule->getTemplates(),
            'settings' => $this->schedule->getSettings(),
            'slot_minutes' => $this->schedule->slotMinutes(),
        ]);
    }

    public function saveTemplates(Request $request): void
    {
        $this->auth->ensureSectionAccess('schedule');
        foreach ($request->body['templates'] ?? [] as $template) {
            $this->schedule->saveTemplate($template);
        }
        if (!empty($request->body['settings']) && is_array($request->body['settings'])) {
            $this->schedule->saveSettings($request->body['settings']);
        }

        Response::success(['saved' => true]);
    }

    public function overrides(): void
    {
        $this->auth->ensureSectionAccess('schedule');
        Response::success(['overrides' => $this->schedule->getOverrides()]);
    }

    public function saveOverride(Request $request): void
    {
        $this->auth->ensureSectionAccess('schedule');
        $this->schedule->saveOverride($request->body);
        Response::success(['saved' => true]);
    }

    public function deleteOverride(Request $request): void
    {
        $this->auth->ensureSectionAccess('schedule');
        $id = (int) ($request->params['id'] ?? 0);
        if ($id <= 0) {
            Response::error('validation_error', 'Override id required', 422);
        }

        $this->schedule->deleteOverride($id);
        Response::success(['deleted' => true]);
    }
}
