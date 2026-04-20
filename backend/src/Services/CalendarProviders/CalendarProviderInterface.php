<?php

declare(strict_types=1);

namespace BowWowSpa\Services\CalendarProviders;

interface CalendarProviderInterface
{
    public function key(): string;

    public function definition(): array;

    public function normalizeSettings(array $settings): array;
}
