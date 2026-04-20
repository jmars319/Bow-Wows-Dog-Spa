<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Services\CalendarProviders\AppleCalendarProvider;
use BowWowSpa\Services\CalendarProviders\CalendarProviderInterface;
use BowWowSpa\Services\CalendarProviders\GoogleCalendarProvider;
use BowWowSpa\Services\CalendarProviders\MicrosoftCalendarProvider;

final class CalendarProviderRegistry
{
    /** @var array<string, CalendarProviderInterface> */
    private array $providers;

    public function __construct()
    {
        $this->providers = [
            'google' => new GoogleCalendarProvider(),
            'microsoft' => new MicrosoftCalendarProvider(),
            'apple' => new AppleCalendarProvider(),
        ];
    }

    /**
     * @return array<string, CalendarProviderInterface>
     */
    public function all(): array
    {
        return $this->providers;
    }

    public function find(string $key): ?CalendarProviderInterface
    {
        return $this->providers[$key] ?? null;
    }

    public function catalog(): array
    {
        return array_values(array_map(
            static fn (CalendarProviderInterface $provider): array => $provider->definition(),
            $this->providers
        ));
    }
}
