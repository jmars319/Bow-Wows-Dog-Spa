<?php

declare(strict_types=1);

namespace BowWowSpa\Services\CalendarProviders;

use BowWowSpa\Support\Input;

final class MicrosoftCalendarProvider implements CalendarProviderInterface
{
    public function key(): string
    {
        return 'microsoft';
    }

    public function definition(): array
    {
        return [
            'key' => $this->key(),
            'label' => 'Microsoft 365 / Outlook',
            'implementation_status' => 'foundation_only',
            'planned_auth_strategy' => 'Microsoft Graph OAuth 2.0',
            'planned_target_label' => 'Outlook calendar ID',
            'supports_multiple_integrations' => true,
            'summary' => 'Future direct event write integration for Outlook or Microsoft 365 calendars.',
            'future_notes' => 'A later implementation can connect one or more Microsoft calendars and sync confirmed appointments automatically.',
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
