<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;
use DateTimeImmutable;
use DateTimeZone;

final class BookingStatsService
{
    public function __construct(
        private readonly BookingService $bookings = new BookingService(),
    ) {
    }

    public function stats(): array
    {
        $this->bookings->expireStalePending();

        $today = date('Y-m-d');
        $week = (new DateTimeImmutable('today', new DateTimeZone('UTC')))->modify('monday this week')->format('Y-m-d');

        $new = Database::fetch('SELECT COUNT(*) as total FROM booking_requests WHERE status = "pending_confirmation" AND is_internal_test = 0')['total'] ?? 0;
        $confirmedToday = Database::fetch(
            'SELECT COUNT(*) as total FROM booking_requests WHERE status = "confirmed" AND is_internal_test = 0 AND date = :date',
            ['date' => $today]
        )['total'] ?? 0;
        $confirmedWeek = Database::fetch(
            'SELECT COUNT(*) as total FROM booking_requests WHERE status = "confirmed" AND is_internal_test = 0 AND date >= :week_start',
            ['week_start' => $week]
        )['total'] ?? 0;

        return [
            'new_requests' => (int) $new,
            'pending_confirmation' => (int) $new,
            'confirmed_today' => (int) $confirmedToday,
            'confirmed_week' => (int) $confirmedWeek,
        ];
    }
}
