<?php

declare(strict_types=1);

namespace BowWowSpa\Tests\Feature;

use BowWowSpa\Database\Database;
use BowWowSpa\Services\AuditService;
use BowWowSpa\Services\BookingService;
use BowWowSpa\Services\ScheduleService;
use BowWowSpa\Services\ServiceCatalogService;
use BowWowSpa\Tests\TestCase;
use DateTimeImmutable;

final class ScheduleAndBookingTest extends TestCase
{
    public function testAvailabilityExpiresStalePendingBookings(): void
    {
        $schedule = new ScheduleService();
        $date = $this->nextDateForWeekday(2);

        $schedule->saveTemplate([
            'weekday' => (int) date('w', strtotime($date)),
            'times' => ['09:00', '09:30', '10:00'],
            'is_enabled' => 1,
        ]);
        $schedule->saveSettings(['booking_pending_expire_hours' => 1]);

        Database::insert(
            'INSERT INTO booking_requests (
                date,
                time,
                end_time,
                customer_name,
                phone,
                email,
                dog_name,
                total_duration_minutes,
                status,
                created_at,
                updated_at
             ) VALUES (
                :date,
                "09:00:00",
                "09:30:00",
                "Stale Client",
                "3365550100",
                "stale@example.com",
                "Milo",
                30,
                "pending_confirmation",
                DATE_SUB(NOW(), INTERVAL 2 HOUR),
                DATE_SUB(NOW(), INTERVAL 2 HOUR)
             )',
            ['date' => $date]
        );

        $availability = $schedule->availabilityForDate($date, ['duration_minutes' => 30]);
        $status = Database::fetch('SELECT status FROM booking_requests LIMIT 1');

        $this->assertSame('expired', $status['status'] ?? null);
        $this->assertSame('09:00:00', $availability[0]['time'] ?? null);
    }

    public function testBookingLifecycleQueuesCalendarSyncJobs(): void
    {
        $adminId = $this->env->seedAdminUser();
        $this->env->insertCalendarIntegration();

        $catalog = new ServiceCatalogService();
        $service = $catalog->save([
            'name' => 'Full Groom',
            'duration_minutes' => 60,
            'price_label' => '$65+',
            'is_active' => 1,
        ]);

        $schedule = new ScheduleService();
        $date = $this->nextDateForWeekday(3);
        $schedule->saveTemplate([
            'weekday' => (int) date('w', strtotime($date)),
            'times' => ['09:00', '09:30', '10:00', '10:30', '11:00'],
            'is_enabled' => 1,
        ]);

        $availability = $schedule->availabilityForDate($date, ['service_ids' => [$service['id']], 'pet_count' => 1]);
        $this->assertSame('09:00:00', $availability[0]['time'] ?? null);

        $bookings = new BookingService();
        $hold = $bookings->createHold($date, '09:00', ['service_ids' => [$service['id']], 'pet_count' => 1]);
        $this->assertArrayHasKey('hold_token', $hold);

        $availabilityAfterHold = $schedule->availabilityForDate($date, ['service_ids' => [$service['id']], 'pet_count' => 1]);
        $this->assertSame('10:00:00', $availabilityAfterHold[0]['time'] ?? null);

        $booking = $bookings->createBooking([
            'hold_token' => $hold['hold_token'],
            'date' => $date,
            'time' => '09:00',
            'owner_name' => 'Jamie Parker',
            'phone' => '(336) 555-0144',
            'email' => 'jamie@example.com',
            'selected_services' => [$service['id']],
            'dogs' => [[
                'pet_name' => 'Milo',
                'breed' => 'Poodle Mix',
                'approximate_weight' => '22 lbs',
                'temperament_notes' => 'Shy on first visits',
            ]],
        ]);

        $this->assertSame('pending_confirmation', $booking['status']);
        $this->assertSame(['Full Groom'], $booking['service_names']);

        $extended = $bookings->extendHold((int) $booking['id']);
        $this->assertSame($booking['id'], $extended['id']);

        $audit = new AuditService();
        $confirmed = $bookings->transition((int) $booking['id'], 'confirm', 'Confirmed by front desk', $adminId, $audit);
        $this->assertSame('confirmed', $confirmed['status']);

        $jobsAfterConfirm = Database::fetchAll(
            'SELECT action, job_status FROM calendar_sync_jobs WHERE booking_request_id = :booking_id ORDER BY id ASC',
            ['booking_id' => $booking['id']]
        );
        $this->assertCount(1, $jobsAfterConfirm);
        $this->assertSame('upsert_booking', $jobsAfterConfirm[0]['action']);
        $this->assertSame('pending', $jobsAfterConfirm[0]['job_status']);

        $cancelled = $bookings->transition((int) $booking['id'], 'cancel', 'Family requested a different day', $adminId, $audit);
        $this->assertSame('cancelled', $cancelled['status']);

        $jobsAfterCancel = Database::fetchAll(
            'SELECT action, job_status FROM calendar_sync_jobs WHERE booking_request_id = :booking_id ORDER BY id ASC',
            ['booking_id' => $booking['id']]
        );

        $statuses = [];
        foreach ($jobsAfterCancel as $job) {
            $statuses[$job['action']][] = $job['job_status'];
        }

        $this->assertSame(['skipped'], $statuses['upsert_booking'] ?? []);
        $this->assertSame(['pending'], $statuses['delete_booking'] ?? []);
        $this->assertGreaterThan(0, count((new AuditService())->recent(10)));
    }

    private function nextDateForWeekday(int $weekday): string
    {
        $today = new DateTimeImmutable('today');
        $todayWeekday = (int) $today->format('w');
        $delta = ($weekday - $todayWeekday + 7) % 7;
        if ($delta === 0) {
            $delta = 7;
        }

        return $today->modify('+' . $delta . ' days')->format('Y-m-d');
    }
}
