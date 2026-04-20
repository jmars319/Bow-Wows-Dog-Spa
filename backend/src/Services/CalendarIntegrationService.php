<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;
use BowWowSpa\Support\Config;
use BowWowSpa\Support\Input;

final class CalendarIntegrationService
{
    public function __construct(private readonly CalendarProviderRegistry $providers = new CalendarProviderRegistry())
    {
    }

    public function dashboardPayload(): array
    {
        return [
            'config' => [
                'enabled' => (bool) Config::get('calendar_sync.enabled', true),
                'default_timezone' => (string) Config::get('calendar_sync.default_timezone', 'America/New_York'),
                'max_job_attempts' => (int) Config::get('calendar_sync.max_job_attempts', 5),
            ],
            'providers' => $this->providers->catalog(),
            'integrations' => $this->list(),
            'queue' => [
                'status_totals' => $this->queueStatusTotals(),
            ],
        ];
    }

    public function list(): array
    {
        $rows = Database::fetchAll('SELECT * FROM calendar_integrations ORDER BY created_at DESC, id DESC');
        if ($rows === []) {
            return [];
        }

        $stats = $this->integrationStats(array_map(
            static fn (array $row): int => (int) $row['id'],
            $rows
        ));

        return array_map(function (array $row) use ($stats): array {
            $id = (int) $row['id'];
            return $this->hydrateIntegration($row, $stats[$id] ?? []);
        }, $rows);
    }

    public function save(array $payload): array
    {
        $id = (int) ($payload['id'] ?? 0);
        $existing = $id > 0 ? Database::fetch('SELECT * FROM calendar_integrations WHERE id = :id LIMIT 1', ['id' => $id]) : null;
        if ($id > 0 && !$existing) {
            throw new \RuntimeException('Calendar integration not found.');
        }

        $providerKey = trim((string) ($payload['provider'] ?? $existing['provider'] ?? ''));
        $provider = $this->providers->find($providerKey);
        if ($provider === null) {
            throw new \RuntimeException('Choose Google, Microsoft, or Apple as the calendar provider.');
        }

        $label = Input::clean($payload['label'] ?? $existing['label'] ?? null, 191) ?? $provider->definition()['label'];
        $targetCalendarName = Input::clean($payload['target_calendar_name'] ?? $existing['target_calendar_name'] ?? null, 191);
        $targetCalendarReference = Input::clean($payload['target_calendar_reference'] ?? $existing['target_calendar_reference'] ?? null, 191);
        $notes = Input::clean($payload['notes'] ?? $existing['notes'] ?? null, 5000, true);
        $settings = $provider->normalizeSettings($this->decodeSettings($payload['settings'] ?? $existing['settings_json'] ?? []));
        $isEnabled = array_key_exists('is_enabled', $payload)
            ? (int) (!empty($payload['is_enabled']))
            : (int) ($existing['is_enabled'] ?? 0);
        $syncConfirmedBookings = array_key_exists('sync_confirmed_bookings', $payload)
            ? (int) (!empty($payload['sync_confirmed_bookings']))
            : (int) ($existing['sync_confirmed_bookings'] ?? 1);
        $connectionStatus = (string) ($existing['connection_status'] ?? 'not_connected');

        if ($existing) {
            Database::run(
                'UPDATE calendar_integrations
                 SET provider = :provider,
                     label = :label,
                     target_calendar_name = :target_calendar_name,
                     target_calendar_reference = :target_calendar_reference,
                     connection_status = :connection_status,
                     sync_confirmed_bookings = :sync_confirmed_bookings,
                     is_enabled = :is_enabled,
                     settings_json = :settings_json,
                     notes = :notes,
                     updated_at = NOW()
                 WHERE id = :id',
                [
                    'provider' => $providerKey,
                    'label' => $label,
                    'target_calendar_name' => $targetCalendarName,
                    'target_calendar_reference' => $targetCalendarReference,
                    'connection_status' => $connectionStatus,
                    'sync_confirmed_bookings' => $syncConfirmedBookings,
                    'is_enabled' => $isEnabled,
                    'settings_json' => json_encode($settings),
                    'notes' => $notes,
                    'id' => $id,
                ]
            );
        } else {
            $id = Database::insert(
                'INSERT INTO calendar_integrations (
                    provider,
                    label,
                    target_calendar_name,
                    target_calendar_reference,
                    connection_status,
                    sync_confirmed_bookings,
                    is_enabled,
                    settings_json,
                    notes,
                    created_at,
                    updated_at
                ) VALUES (
                    :provider,
                    :label,
                    :target_calendar_name,
                    :target_calendar_reference,
                    "not_connected",
                    :sync_confirmed_bookings,
                    :is_enabled,
                    :settings_json,
                    :notes,
                    NOW(),
                    NOW()
                )',
                [
                    'provider' => $providerKey,
                    'label' => $label,
                    'target_calendar_name' => $targetCalendarName,
                    'target_calendar_reference' => $targetCalendarReference,
                    'sync_confirmed_bookings' => $syncConfirmedBookings,
                    'is_enabled' => $isEnabled,
                    'settings_json' => json_encode($settings),
                    'notes' => $notes,
                ]
            );
        }

        $saved = Database::fetch('SELECT * FROM calendar_integrations WHERE id = :id LIMIT 1', ['id' => $id]);
        if (!$saved) {
            throw new \RuntimeException('Unable to load saved calendar integration.');
        }

        $stats = $this->integrationStats([$id]);
        return $this->hydrateIntegration($saved, $stats[$id] ?? []);
    }

    public function delete(int $id): ?array
    {
        $existing = Database::fetch('SELECT * FROM calendar_integrations WHERE id = :id LIMIT 1', ['id' => $id]);
        if (!$existing) {
            return null;
        }

        Database::run('DELETE FROM calendar_integrations WHERE id = :id', ['id' => $id]);
        return $this->hydrateIntegration($existing, []);
    }

    public function activeDirectWriteTargets(): array
    {
        return Database::fetchAll(
            'SELECT * FROM calendar_integrations
             WHERE is_enabled = 1
               AND sync_confirmed_bookings = 1
               AND connection_status = "connected"
             ORDER BY id ASC'
        );
    }

    private function decodeSettings(mixed $settings): array
    {
        if (is_array($settings)) {
            return $settings;
        }

        if (is_string($settings)) {
            $decoded = json_decode($settings, true);
            return is_array($decoded) ? $decoded : [];
        }

        return [];
    }

    private function hydrateIntegration(array $row, array $stats): array
    {
        $provider = $this->providers->find((string) $row['provider']);
        $settings = json_decode((string) ($row['settings_json'] ?? '[]'), true);
        if (!is_array($settings)) {
            $settings = [];
        }

        return [
            'id' => (int) $row['id'],
            'provider' => $row['provider'],
            'provider_label' => $provider ? $provider->definition()['label'] : ucfirst((string) $row['provider']),
            'provider_meta' => $provider?->definition(),
            'label' => $row['label'],
            'target_calendar_name' => $row['target_calendar_name'],
            'target_calendar_reference' => $row['target_calendar_reference'],
            'connection_status' => $row['connection_status'],
            'sync_confirmed_bookings' => (bool) $row['sync_confirmed_bookings'],
            'is_enabled' => (bool) $row['is_enabled'],
            'settings' => $settings,
            'notes' => $row['notes'],
            'last_synced_at' => $row['last_synced_at'],
            'last_error' => $row['last_error'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
            'stats' => [
                'pending_jobs' => (int) ($stats['pending_jobs'] ?? 0),
                'failed_jobs' => (int) ($stats['failed_jobs'] ?? 0),
                'completed_jobs' => (int) ($stats['completed_jobs'] ?? 0),
                'linked_events' => (int) ($stats['linked_events'] ?? 0),
            ],
            'can_sync_now' => (bool) $row['is_enabled'] && $row['connection_status'] === 'connected',
        ];
    }

    /**
     * @param int[] $integrationIds
     * @return array<int, array<string, int>>
     */
    private function integrationStats(array $integrationIds): array
    {
        $integrationIds = array_values(array_unique(array_filter(array_map('intval', $integrationIds), static fn (int $id): bool => $id > 0)));
        if ($integrationIds === []) {
            return [];
        }

        $inClause = implode(',', $integrationIds);
        $stats = [];

        foreach (Database::fetchAll(
            'SELECT calendar_integration_id, job_status, COUNT(*) AS total
             FROM calendar_sync_jobs
             WHERE calendar_integration_id IN (' . $inClause . ')
             GROUP BY calendar_integration_id, job_status'
        ) as $row) {
            $integrationId = (int) $row['calendar_integration_id'];
            $status = (string) $row['job_status'];
            $total = (int) $row['total'];
            $stats[$integrationId] ??= [
                'pending_jobs' => 0,
                'failed_jobs' => 0,
                'completed_jobs' => 0,
                'linked_events' => 0,
            ];
            if ($status === 'pending') {
                $stats[$integrationId]['pending_jobs'] = $total;
            }
            if ($status === 'failed') {
                $stats[$integrationId]['failed_jobs'] = $total;
            }
            if ($status === 'completed') {
                $stats[$integrationId]['completed_jobs'] = $total;
            }
        }

        foreach (Database::fetchAll(
            'SELECT calendar_integration_id, COUNT(*) AS total
             FROM calendar_sync_links
             WHERE calendar_integration_id IN (' . $inClause . ')
             GROUP BY calendar_integration_id'
        ) as $row) {
            $integrationId = (int) $row['calendar_integration_id'];
            $stats[$integrationId] ??= [
                'pending_jobs' => 0,
                'failed_jobs' => 0,
                'completed_jobs' => 0,
                'linked_events' => 0,
            ];
            $stats[$integrationId]['linked_events'] = (int) $row['total'];
        }

        return $stats;
    }

    private function queueStatusTotals(): array
    {
        $totals = [
            'pending' => 0,
            'processing' => 0,
            'completed' => 0,
            'failed' => 0,
            'skipped' => 0,
        ];

        foreach (Database::fetchAll('SELECT job_status, COUNT(*) AS total FROM calendar_sync_jobs GROUP BY job_status') as $row) {
            $status = (string) $row['job_status'];
            if (array_key_exists($status, $totals)) {
                $totals[$status] = (int) $row['total'];
            }
        }

        return $totals;
    }
}
