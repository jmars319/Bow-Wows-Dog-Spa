<?php

declare(strict_types=1);

namespace BowWowSpa\Tests\Feature;

use BowWowSpa\Database\Database;
use BowWowSpa\Services\CalendarIntegrationService;
use BowWowSpa\Tests\TestCase;

final class CalendarIntegrationTest extends TestCase
{
    public function testDashboardPayloadIncludesProviderCatalogAndQueueStats(): void
    {
        $service = new CalendarIntegrationService();
        $saved = $service->save([
            'provider' => 'google',
            'label' => 'Main Desk Calendar',
            'target_calendar_name' => 'Front Desk',
            'target_calendar_reference' => 'front-desk',
            'is_enabled' => 1,
            'sync_confirmed_bookings' => 1,
            'settings' => [
                'event_prefix' => str_repeat('A', 120),
                'timezone_override' => 'America/New_York',
            ],
        ]);

        Database::run(
            'UPDATE calendar_integrations
             SET connection_status = "connected", last_synced_at = NOW()
             WHERE id = :id',
            ['id' => $saved['id']]
        );

        $bookingId = Database::insert(
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
                CURDATE(),
                "09:00:00",
                "09:30:00",
                "Calendar Test Client",
                "3365550188",
                "calendar@example.com",
                "Milo",
                30,
                "confirmed",
                NOW(),
                NOW()
             )'
        );

        Database::insert(
            'INSERT INTO calendar_sync_jobs (calendar_integration_id, booking_request_id, action, job_status, payload_json, attempt_count, available_at, created_at, updated_at)
             VALUES (:integration_id, :booking_id, "upsert_booking", "pending", "{}", 0, NOW(), NOW(), NOW())',
            ['integration_id' => $saved['id'], 'booking_id' => $bookingId]
        );
        Database::insert(
            'INSERT INTO calendar_sync_jobs (calendar_integration_id, booking_request_id, action, job_status, payload_json, attempt_count, available_at, created_at, updated_at)
             VALUES (:integration_id, :booking_id, "upsert_booking", "failed", "{}", 1, NOW(), NOW(), NOW())',
            ['integration_id' => $saved['id'], 'booking_id' => $bookingId]
        );
        Database::insert(
            'INSERT INTO calendar_sync_jobs (calendar_integration_id, booking_request_id, action, job_status, payload_json, attempt_count, available_at, processed_at, created_at, updated_at)
             VALUES (:integration_id, :booking_id, "delete_booking", "completed", "{}", 1, NOW(), NOW(), NOW(), NOW())',
            ['integration_id' => $saved['id'], 'booking_id' => $bookingId]
        );
        Database::insert(
            'INSERT INTO calendar_sync_links (calendar_integration_id, booking_request_id, external_calendar_id, external_event_id, external_event_version, synced_at, created_at, updated_at)
             VALUES (:integration_id, :booking_id, "front-desk", "event-123", "etag-1", NOW(), NOW(), NOW())',
            ['integration_id' => $saved['id'], 'booking_id' => $bookingId]
        );

        $dashboard = $service->dashboardPayload();
        $integration = $dashboard['integrations'][0];

        $this->assertCount(3, $dashboard['providers']);
        $this->assertSame('Google Calendar', $integration['provider_label']);
        $this->assertSame(80, strlen((string) $integration['settings']['event_prefix']));
        $this->assertTrue((bool) $integration['can_sync_now']);
        $this->assertSame(1, $integration['stats']['pending_jobs']);
        $this->assertSame(1, $integration['stats']['failed_jobs']);
        $this->assertSame(1, $integration['stats']['completed_jobs']);
        $this->assertSame(1, $integration['stats']['linked_events']);
    }
}
