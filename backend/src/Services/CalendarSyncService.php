<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;
use BowWowSpa\Support\Config;

final class CalendarSyncService
{
    public function __construct(private readonly CalendarIntegrationService $integrations = new CalendarIntegrationService())
    {
    }

    public function queueBookingSync(array $booking, ?string $previousStatus = null): void
    {
        if (!(bool) Config::get('calendar_sync.enabled', true)) {
            return;
        }

        $action = $this->actionForStatusChange((string) ($booking['status'] ?? ''), $previousStatus);
        if ($action === null) {
            return;
        }

        foreach ($this->integrations->activeDirectWriteTargets() as $integration) {
            $this->queueJob((int) $integration['id'], (int) $booking['id'], $action, $this->payloadForBooking($booking));
        }
    }

    private function actionForStatusChange(string $status, ?string $previousStatus): ?string
    {
        if ($status === 'confirmed') {
            return 'upsert_booking';
        }

        if ($previousStatus === 'confirmed' && in_array($status, ['pending_confirmation', 'declined', 'cancelled', 'expired'], true)) {
            return 'delete_booking';
        }

        return null;
    }

    private function queueJob(int $integrationId, int $bookingId, string $action, array $payload): void
    {
        $oppositeAction = $action === 'upsert_booking' ? 'delete_booking' : 'upsert_booking';

        Database::transaction(function () use ($integrationId, $bookingId, $action, $oppositeAction, $payload): void {
            Database::run(
                'UPDATE calendar_sync_jobs
                 SET job_status = "skipped",
                     error_message = :message,
                     processed_at = NOW(),
                     updated_at = NOW()
                 WHERE calendar_integration_id = :integration_id
                   AND booking_request_id = :booking_id
                   AND action = :opposite_action
                   AND job_status IN ("pending", "processing")',
                [
                    'message' => 'Superseded by a newer booking sync request.',
                    'integration_id' => $integrationId,
                    'booking_id' => $bookingId,
                    'opposite_action' => $oppositeAction,
                ]
            );

            $existing = Database::fetch(
                'SELECT id
                 FROM calendar_sync_jobs
                 WHERE calendar_integration_id = :integration_id
                   AND booking_request_id = :booking_id
                   AND action = :action
                   AND job_status IN ("pending", "processing")
                 LIMIT 1',
                [
                    'integration_id' => $integrationId,
                    'booking_id' => $bookingId,
                    'action' => $action,
                ]
            );

            if ($existing) {
                Database::run(
                    'UPDATE calendar_sync_jobs
                     SET payload_json = :payload_json,
                         error_message = NULL,
                         available_at = NOW(),
                         updated_at = NOW()
                     WHERE id = :id',
                    [
                        'payload_json' => json_encode($payload),
                        'id' => $existing['id'],
                    ]
                );

                return;
            }

            Database::insert(
                'INSERT INTO calendar_sync_jobs (
                    calendar_integration_id,
                    booking_request_id,
                    action,
                    job_status,
                    payload_json,
                    attempt_count,
                    error_message,
                    available_at,
                    processed_at,
                    created_at,
                    updated_at
                ) VALUES (
                    :integration_id,
                    :booking_id,
                    :action,
                    "pending",
                    :payload_json,
                    0,
                    NULL,
                    NOW(),
                    NULL,
                    NOW(),
                    NOW()
                )',
                [
                    'integration_id' => $integrationId,
                    'booking_id' => $bookingId,
                    'action' => $action,
                    'payload_json' => json_encode($payload),
                ]
            );
        });
    }

    private function payloadForBooking(array $booking): array
    {
        return [
            'booking_id' => (int) $booking['id'],
            'status' => (string) ($booking['status'] ?? ''),
            'owner_name' => (string) ($booking['owner_name'] ?? $booking['customer_name'] ?? ''),
            'email' => (string) ($booking['email'] ?? ''),
            'phone' => (string) ($booking['phone'] ?? ''),
            'date' => (string) ($booking['date'] ?? ''),
            'time' => (string) ($booking['time'] ?? ''),
            'end_time' => (string) ($booking['end_time'] ?? ''),
            'service_names' => array_values(array_filter($booking['service_names'] ?? [], 'is_string')),
            'pets' => is_array($booking['pets'] ?? null) ? $booking['pets'] : [],
            'vet_name' => $booking['vet_name'] ?? null,
            'vet_phone' => $booking['vet_phone'] ?? null,
            'request_notes' => $booking['request_notes'] ?? null,
            'admin_notes' => $booking['admin_notes'] ?? null,
            'total_duration_minutes' => (int) ($booking['total_duration_minutes'] ?? 0),
        ];
    }
}
