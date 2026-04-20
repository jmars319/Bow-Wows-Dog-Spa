<?php

declare(strict_types=1);

namespace BowWowSpa\Services\CalendarProviders;

use BowWowSpa\Support\Input;

final class GoogleCalendarProvider implements CalendarProviderInterface
{
    public function key(): string
    {
        return 'google';
    }

    public function definition(): array
    {
        return [
            'key' => $this->key(),
            'label' => 'Google Calendar',
            'implementation_status' => 'foundation_only',
            'planned_auth_strategy' => 'OAuth 2.0 calendar write access',
            'planned_target_label' => 'Google calendar ID',
            'supports_multiple_integrations' => true,
            'summary' => 'Future direct event write integration for confirmed bookings.',
            'future_notes' => 'A later implementation can connect one or more Google calendars and sync confirmed appointments automatically.',
        ];
    }

    public function normalizeSettings(array $settings): array
    {
        return [
            'event_prefix' => Input::clean($settings['event_prefix'] ?? null, 80),
            'timezone_override' => Input::clean($settings['timezone_override'] ?? null, 80),
        ];
    }
}
