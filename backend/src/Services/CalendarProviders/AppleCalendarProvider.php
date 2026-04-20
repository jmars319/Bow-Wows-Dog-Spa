<?php

declare(strict_types=1);

namespace BowWowSpa\Services\CalendarProviders;

use BowWowSpa\Support\Input;

final class AppleCalendarProvider implements CalendarProviderInterface
{
    public function key(): string
    {
        return 'apple';
    }

    public function definition(): array
    {
        return [
            'key' => $this->key(),
            'label' => 'Apple Calendar',
            'implementation_status' => 'foundation_only',
            'planned_auth_strategy' => 'Apple Calendar / iCloud connection strategy to be chosen during implementation',
            'planned_target_label' => 'Apple calendar target',
            'supports_multiple_integrations' => true,
            'summary' => 'Reserved provider slot for a future Apple Calendar or iCloud-backed implementation.',
            'future_notes' => 'Apple support often depends on the final account model. This foundation keeps Apple as a first-class provider without forcing the implementation choice yet.',
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
