<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;
use BowWowSpa\Support\Config;
use BowWowSpa\Support\Input;

final class CalendarIntegrationService
{
    public function __construct(
        private readonly CalendarProviderRegistry $providers = new CalendarProviderRegistry(),
        private readonly GoogleCalendarClient $google = new GoogleCalendarClient(),
    ) {
    }

    public function dashboardPayload(): array
    {
        return [
            'config' => [
                'enabled' => (bool) Config::get('calendar_sync.enabled', true),
                'default_timezone' => (string) Config::get('calendar_sync.default_timezone', 'America/New_York'),
                'max_job_attempts' => (int) Config::get('calendar_sync.max_job_attempts', 5),
                'google_oauth_configured' => $this->googleOAuthConfigured(),
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
        $isPrimaryWriteTarget = array_key_exists('is_primary_write_target', $payload)
            ? (int) (!empty($payload['is_primary_write_target']))
            : (int) ($existing['is_primary_write_target'] ?? 0);
        $blocksAvailability = array_key_exists('blocks_availability', $payload)
            ? (int) (!empty($payload['blocks_availability']))
            : (int) ($existing['blocks_availability'] ?? 1);
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
                     is_primary_write_target = :is_primary_write_target,
                     blocks_availability = :blocks_availability,
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
                    'is_primary_write_target' => $isPrimaryWriteTarget,
                    'blocks_availability' => $blocksAvailability,
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
                    is_primary_write_target,
                    blocks_availability,
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
                    :is_primary_write_target,
                    :blocks_availability,
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
                    'is_primary_write_target' => $isPrimaryWriteTarget,
                    'blocks_availability' => $blocksAvailability,
                    'settings_json' => json_encode($settings),
                    'notes' => $notes,
                ]
            );
        }

        if ($isPrimaryWriteTarget === 1) {
            $this->clearOtherPrimaryTargets($id);
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
        $primary = Database::fetchAll(
            'SELECT * FROM calendar_integrations
             WHERE is_enabled = 1
               AND sync_confirmed_bookings = 1
               AND connection_status = "connected"
               AND is_primary_write_target = 1
             ORDER BY id ASC
             LIMIT 1'
        );
        if ($primary !== []) {
            return $primary;
        }

        return Database::fetchAll(
            'SELECT * FROM calendar_integrations
             WHERE is_enabled = 1
               AND sync_confirmed_bookings = 1
               AND connection_status = "connected"
             ORDER BY id ASC
             LIMIT 1'
        );
    }

    public function googleAuthorizationUrl(int $integrationId, string $state): string
    {
        $integration = Database::fetch('SELECT * FROM calendar_integrations WHERE id = :id LIMIT 1', ['id' => $integrationId]);
        if (!$integration || (string) $integration['provider'] !== 'google') {
            throw new \RuntimeException('Choose or create a Google Calendar integration first.');
        }

        return $this->google->authorizationUrl($integrationId, $state);
    }

    public function connectGoogle(int $integrationId, string $code): array
    {
        $integration = Database::fetch('SELECT * FROM calendar_integrations WHERE id = :id LIMIT 1', ['id' => $integrationId]);
        if (!$integration || (string) $integration['provider'] !== 'google') {
            throw new \RuntimeException('Google Calendar integration not found.');
        }

        $tokens = $this->google->exchangeCode($code);
        $accessToken = trim((string) ($tokens['access_token'] ?? ''));
        $refreshToken = trim((string) ($tokens['refresh_token'] ?? ''));
        if ($accessToken === '') {
            throw new \RuntimeException('Google did not return an access token.');
        }
        if ($refreshToken === '' && empty($integration['refresh_token_encrypted'])) {
            throw new \RuntimeException('Google did not return a refresh token. Disconnect and reconnect with consent.');
        }

        $encryptedRefresh = $refreshToken !== ''
            ? $this->google->encryptedToken($refreshToken)
            : (string) ($integration['refresh_token_encrypted'] ?? '');
        $expiresAt = gmdate('Y-m-d H:i:s', time() + max(60, (int) ($tokens['expires_in'] ?? 3600)));
        $tokenRow = $integration;
        $tokenRow['access_token_encrypted'] = $this->google->encryptedToken($accessToken);
        $tokenRow['refresh_token_encrypted'] = $encryptedRefresh;
        $tokenRow['token_expires_at'] = $expiresAt;

        $calendarName = (string) ($integration['target_calendar_name'] ?? '');
        $calendarRef = (string) ($integration['target_calendar_reference'] ?? '');
        $accountEmail = (string) ($integration['google_account_email'] ?? '');
        try {
            $calendars = $this->google->listCalendars($tokenRow);
            $chosen = $this->chooseCalendar($calendars, $calendarRef);
            if ($chosen !== null) {
                $calendarName = (string) ($chosen['summary'] ?? $calendarName);
                $calendarRef = (string) ($chosen['id'] ?? $calendarRef);
                $accountEmail = str_contains($calendarRef, '@') ? $calendarRef : $accountEmail;
            }
        } catch (\Throwable $e) {
            error_log('[BowWow][google_calendar_list_failed] ' . $e->getMessage());
        }

        $makePrimary = Database::fetch(
            'SELECT id FROM calendar_integrations WHERE is_primary_write_target = 1 AND id != :id LIMIT 1',
            ['id' => $integrationId]
        ) === null;

        Database::run(
            'UPDATE calendar_integrations
             SET connection_status = "connected",
                 is_enabled = 1,
                 sync_confirmed_bookings = 1,
                 is_primary_write_target = :is_primary_write_target,
                 blocks_availability = 1,
                 target_calendar_name = :calendar_name,
                 target_calendar_reference = :calendar_ref,
                 google_account_email = :account_email,
                 access_token_encrypted = :access_token,
                 refresh_token_encrypted = :refresh_token,
                 token_expires_at = :expires_at,
                 scopes_json = :scopes,
                 last_error = NULL,
                 updated_at = NOW()
             WHERE id = :id',
            [
                'is_primary_write_target' => $makePrimary ? 1 : (int) ($integration['is_primary_write_target'] ?? 0),
                'calendar_name' => $calendarName !== '' ? $calendarName : null,
                'calendar_ref' => $calendarRef !== '' ? $calendarRef : 'primary',
                'account_email' => $accountEmail !== '' ? $accountEmail : null,
                'access_token' => $tokenRow['access_token_encrypted'],
                'refresh_token' => $encryptedRefresh,
                'expires_at' => $expiresAt,
                'scopes' => json_encode($this->google->scopes()),
                'id' => $integrationId,
            ]
        );

        if ($makePrimary) {
            $this->clearOtherPrimaryTargets($integrationId);
        }

        $saved = Database::fetch('SELECT * FROM calendar_integrations WHERE id = :id LIMIT 1', ['id' => $integrationId]);
        return $this->hydrateIntegration($saved ?: [], $this->integrationStats([$integrationId])[$integrationId] ?? []);
    }

    public function disconnectGoogle(int $integrationId): array
    {
        $integration = Database::fetch('SELECT * FROM calendar_integrations WHERE id = :id LIMIT 1', ['id' => $integrationId]);
        if (!$integration || (string) $integration['provider'] !== 'google') {
            throw new \RuntimeException('Google Calendar integration not found.');
        }

        Database::run(
            'UPDATE calendar_integrations
             SET connection_status = "not_connected",
                 is_enabled = 0,
                 access_token_encrypted = NULL,
                 refresh_token_encrypted = NULL,
                 token_expires_at = NULL,
                 last_error = NULL,
                 updated_at = NOW()
             WHERE id = :id',
            ['id' => $integrationId]
        );

        $saved = Database::fetch('SELECT * FROM calendar_integrations WHERE id = :id LIMIT 1', ['id' => $integrationId]);
        return $this->hydrateIntegration($saved ?: [], $this->integrationStats([$integrationId])[$integrationId] ?? []);
    }

    public function testConnection(int $integrationId): array
    {
        $integration = Database::fetch('SELECT * FROM calendar_integrations WHERE id = :id LIMIT 1', ['id' => $integrationId]);
        if (!$integration || (string) $integration['provider'] !== 'google') {
            throw new \RuntimeException('Google Calendar integration not found.');
        }

        $calendars = $this->google->listCalendars($integration);
        return [
            'calendars' => array_map(static fn (array $calendar): array => [
                'id' => $calendar['id'] ?? null,
                'summary' => $calendar['summary'] ?? null,
                'primary' => !empty($calendar['primary']),
            ], $calendars),
        ];
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
            'is_primary_write_target' => (bool) ($row['is_primary_write_target'] ?? false),
            'blocks_availability' => (bool) ($row['blocks_availability'] ?? true),
            'google_account_email' => $row['google_account_email'] ?? null,
            'has_google_tokens' => !empty($row['refresh_token_encrypted']),
            'settings' => $settings,
            'notes' => $row['notes'],
            'last_synced_at' => $row['last_synced_at'],
            'last_availability_checked_at' => $row['last_availability_checked_at'] ?? null,
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

    private function googleOAuthConfigured(): bool
    {
        return trim((string) Config::get('calendar_sync.google_client_id', '')) !== ''
            && trim((string) Config::get('calendar_sync.google_client_secret', '')) !== ''
            && trim((string) Config::get('calendar_sync.google_redirect_uri', '')) !== ''
            && trim((string) Config::get('calendar_sync.google_token_key', '')) !== '';
    }

    /** @param array<int, array<string, mixed>> $calendars */
    private function chooseCalendar(array $calendars, string $preferredId): ?array
    {
        foreach ($calendars as $calendar) {
            if ($preferredId !== '' && (string) ($calendar['id'] ?? '') === $preferredId) {
                return $calendar;
            }
        }

        foreach ($calendars as $calendar) {
            if (!empty($calendar['primary'])) {
                return $calendar;
            }
        }

        return $calendars[0] ?? null;
    }

    private function clearOtherPrimaryTargets(int $integrationId): void
    {
        Database::run(
            'UPDATE calendar_integrations
             SET is_primary_write_target = 0,
                 updated_at = NOW()
             WHERE id != :id',
            ['id' => $integrationId]
        );
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
