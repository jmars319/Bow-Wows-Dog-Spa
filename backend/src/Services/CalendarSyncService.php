<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;
use BowWowSpa\Support\Config;

final class CalendarSyncService
{
    public function __construct(
        private readonly CalendarIntegrationService $integrations = new CalendarIntegrationService(),
        private readonly GoogleCalendarClient $google = new GoogleCalendarClient(),
    ) {
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

        if ((bool) Config::get('calendar_sync.auto_process', true)) {
            $this->processPendingJobs(5);
        }
    }

    /** @return array{processed:int,completed:int,failed:int,skipped:int} */
    public function processPendingJobs(int $limit = 25): array
    {
        $limit = max(1, min(100, $limit));
        $maxAttempts = (int) Config::get('calendar_sync.max_job_attempts', 5);
        $rows = Database::fetchAll(
            'SELECT *
             FROM calendar_sync_jobs
             WHERE job_status IN ("pending", "failed")
               AND attempt_count < ' . max(1, $maxAttempts) . '
               AND available_at <= NOW()
             ORDER BY available_at ASC, id ASC
             LIMIT ' . $limit
        );

        $result = [
            'processed' => 0,
            'completed' => 0,
            'failed' => 0,
            'skipped' => 0,
        ];

        foreach ($rows as $job) {
            $result['processed']++;
            try {
                Database::run(
                    'UPDATE calendar_sync_jobs
                     SET job_status = "processing",
                         attempt_count = attempt_count + 1,
                         updated_at = NOW()
                     WHERE id = :id
                       AND job_status IN ("pending", "failed")',
                    ['id' => (int) $job['id']]
                );
                $outcome = $this->processJob($job);
                $status = $outcome === 'skipped' ? 'skipped' : 'completed';
                Database::run(
                    'UPDATE calendar_sync_jobs
                     SET job_status = :status,
                         error_message = NULL,
                         processed_at = NOW(),
                         updated_at = NOW()
                     WHERE id = :id',
                    ['status' => $status, 'id' => (int) $job['id']]
                );
                $result[$status]++;
            } catch (\Throwable $e) {
                $result['failed']++;
                $this->markJobFailed($job, $e->getMessage());
            }
        }

        return $result;
    }

    private function processJob(array $job): string
    {
        $integration = Database::fetch(
            'SELECT *
             FROM calendar_integrations
             WHERE id = :id
               AND connection_status = "connected"
               AND is_enabled = 1
             LIMIT 1',
            ['id' => (int) $job['calendar_integration_id']]
        );
        if (!$integration) {
            return 'skipped';
        }

        $booking = (new BookingService())->find((int) $job['booking_request_id']);
        if ($booking === null) {
            return 'skipped';
        }

        $link = Database::fetch(
            'SELECT *
             FROM calendar_sync_links
             WHERE calendar_integration_id = :integration_id
               AND booking_request_id = :booking_id
             LIMIT 1',
            [
                'integration_id' => (int) $integration['id'],
                'booking_id' => (int) $booking['id'],
            ]
        );

        if ((string) $job['action'] === 'delete_booking') {
            if (!$link) {
                return 'skipped';
            }

            $this->google->deleteBookingEvent($integration, (string) $link['external_event_id']);
            Database::run(
                'DELETE FROM calendar_sync_links
                 WHERE calendar_integration_id = :integration_id
                   AND booking_request_id = :booking_id',
                [
                    'integration_id' => (int) $integration['id'],
                    'booking_id' => (int) $booking['id'],
                ]
            );
            Database::run(
                'UPDATE calendar_integrations
                 SET last_synced_at = NOW(),
                     last_error = NULL,
                     updated_at = NOW()
                 WHERE id = :id',
                ['id' => (int) $integration['id']]
            );
            return 'completed';
        }

        if ((string) $job['action'] !== 'upsert_booking' || (string) $booking['status'] !== 'confirmed') {
            return 'skipped';
        }

        $event = $this->google->upsertBookingEvent($integration, $booking, $link);
        $eventId = (string) ($event['id'] ?? '');
        if ($eventId === '') {
            throw new \RuntimeException('Google did not return an event id.');
        }

        Database::run(
            'INSERT INTO calendar_sync_links (
                calendar_integration_id,
                booking_request_id,
                external_calendar_id,
                external_event_id,
                external_event_version,
                synced_at,
                created_at,
                updated_at
            ) VALUES (
                :integration_id,
                :booking_id,
                :calendar_id,
                :event_id,
                :event_version,
                NOW(),
                NOW(),
                NOW()
            )
             ON DUPLICATE KEY UPDATE
                external_calendar_id = VALUES(external_calendar_id),
                external_event_id = VALUES(external_event_id),
                external_event_version = VALUES(external_event_version),
                synced_at = VALUES(synced_at),
                updated_at = VALUES(updated_at)',
            [
                'integration_id' => (int) $integration['id'],
                'booking_id' => (int) $booking['id'],
                'calendar_id' => (string) ($event['organizer']['email'] ?? $integration['target_calendar_reference'] ?? 'primary'),
                'event_id' => $eventId,
                'event_version' => (string) ($event['etag'] ?? ''),
            ]
        );

        Database::run(
            'UPDATE calendar_integrations
             SET last_synced_at = NOW(),
                 last_error = NULL,
                 updated_at = NOW()
             WHERE id = :id',
            ['id' => (int) $integration['id']]
        );

        return 'completed';
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

    private function markJobFailed(array $job, string $message): void
    {
        $maxAttempts = (int) Config::get('calendar_sync.max_job_attempts', 5);
        $nextDelayMinutes = min(120, max(5, ((int) ($job['attempt_count'] ?? 0) + 1) * 10));

        Database::run(
            'UPDATE calendar_sync_jobs
             SET job_status = "failed",
                 error_message = :message,
                 available_at = DATE_ADD(NOW(), INTERVAL ' . $nextDelayMinutes . ' MINUTE),
                 updated_at = NOW()
             WHERE id = :id',
            [
                'message' => substr($message, 0, 2000),
                'id' => (int) $job['id'],
            ]
        );

        Database::run(
            'UPDATE calendar_integrations
             SET last_error = :message,
                 updated_at = NOW()
             WHERE id = :id',
            [
                'message' => substr($message, 0, 2000),
                'id' => (int) $job['calendar_integration_id'],
            ]
        );

        if ((int) ($job['attempt_count'] ?? 0) + 1 >= $maxAttempts) {
            error_log('[BowWow][calendar_sync_failed_permanently] job=' . (int) $job['id'] . ' error=' . $message);
        }
    }
}
