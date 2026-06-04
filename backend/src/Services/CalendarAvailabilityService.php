<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;
use BowWowSpa\Support\Config;
use DateTimeImmutable;
use DateTimeZone;

final class CalendarAvailabilityService
{
    public function __construct(private readonly GoogleCalendarClient $google = new GoogleCalendarClient())
    {
    }

    public function hasBlockingCalendars(): bool
    {
        return Database::fetch(
            'SELECT id
             FROM calendar_integrations
             WHERE provider = "google"
               AND is_enabled = 1
               AND connection_status = "connected"
               AND blocks_availability = 1
               AND refresh_token_encrypted IS NOT NULL
             LIMIT 1'
        ) !== null;
    }

    /**
     * @param array<int, string> $publishedTimes
     * @return array<string, bool>
     */
    public function busyLookupForDate(string $date, array $publishedTimes): array
    {
        $integrations = $this->blockingIntegrations();
        if ($integrations === [] || $publishedTimes === []) {
            return [];
        }

        $timezone = new DateTimeZone((string) Config::get('calendar_sync.default_timezone', 'America/New_York'));
        $dayStart = new DateTimeImmutable($date . ' 00:00:00', $timezone);
        $dayEnd = $dayStart->modify('+1 day');
        $busyLookup = [];

        foreach ($integrations as $integration) {
            $calendarId = trim((string) ($integration['target_calendar_reference'] ?? ''));
            $calendarIds = [$calendarId !== '' ? $calendarId : 'primary'];
            try {
                $busyWindows = $this->google->freeBusy(
                    $integration,
                    $dayStart->format(DATE_RFC3339),
                    $dayEnd->format(DATE_RFC3339),
                    $calendarIds
                );
            } catch (\Throwable $e) {
                Database::run(
                    'UPDATE calendar_integrations
                     SET last_error = :message,
                         updated_at = NOW()
                     WHERE id = :id',
                    [
                        'message' => substr($e->getMessage(), 0, 2000),
                        'id' => (int) $integration['id'],
                    ]
                );
                throw $e;
            }

            Database::run(
                'UPDATE calendar_integrations
                 SET last_availability_checked_at = NOW(),
                     last_error = NULL,
                     updated_at = NOW()
                 WHERE id = :id',
                ['id' => (int) $integration['id']]
            );

            foreach ($publishedTimes as $slot) {
                if ($this->slotOverlapsBusyWindow($date, $slot, $busyWindows, $timezone)) {
                    $busyLookup[$slot] = true;
                }
            }
        }

        return $busyLookup;
    }

    /** @return array<int, array<string, mixed>> */
    private function blockingIntegrations(): array
    {
        return Database::fetchAll(
            'SELECT *
             FROM calendar_integrations
             WHERE provider = "google"
               AND is_enabled = 1
               AND connection_status = "connected"
               AND blocks_availability = 1
               AND refresh_token_encrypted IS NOT NULL
             ORDER BY is_primary_write_target DESC, id ASC'
        );
    }

    /** @param array<int, array{start:string,end:string,calendar_id:string}> $busyWindows */
    private function slotOverlapsBusyWindow(string $date, string $slot, array $busyWindows, DateTimeZone $timezone): bool
    {
        $slotStart = new DateTimeImmutable($date . ' ' . $slot, $timezone);
        $slotEnd = $slotStart->modify('+30 minutes');

        foreach ($busyWindows as $window) {
            try {
                $busyStart = new DateTimeImmutable($window['start']);
                $busyEnd = new DateTimeImmutable($window['end']);
            } catch (\Throwable) {
                continue;
            }

            if ($slotStart < $busyEnd && $slotEnd > $busyStart) {
                return true;
            }
        }

        return false;
    }
}
