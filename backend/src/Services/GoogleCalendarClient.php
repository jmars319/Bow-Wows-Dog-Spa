<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;
use BowWowSpa\Support\Config;
use BowWowSpa\Support\SecretBox;
use DateTimeImmutable;
use DateTimeZone;

final class GoogleCalendarClient
{
    private const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
    private const TOKEN_URL = 'https://oauth2.googleapis.com/token';
    private const API_BASE = 'https://www.googleapis.com/calendar/v3';

    public function __construct(private ?SecretBox $secrets = null)
    {
    }

    public function authorizationUrl(int $integrationId, string $state): string
    {
        $clientId = $this->clientId();
        $redirectUri = $this->redirectUri();
        if ($clientId === '' || $redirectUri === '') {
            throw new \RuntimeException('Google Calendar OAuth is not configured.');
        }

        return self::AUTH_URL . '?' . http_build_query([
            'client_id' => $clientId,
            'redirect_uri' => $redirectUri,
            'response_type' => 'code',
            'scope' => implode(' ', $this->scopes()),
            'access_type' => 'offline',
            'prompt' => 'consent',
            'include_granted_scopes' => 'true',
            'state' => $state . ':' . $integrationId,
        ], '', '&', PHP_QUERY_RFC3986);
    }

    /** @return array<string, mixed> */
    public function exchangeCode(string $code): array
    {
        return $this->tokenRequest([
            'code' => $code,
            'client_id' => $this->clientId(),
            'client_secret' => $this->clientSecret(),
            'redirect_uri' => $this->redirectUri(),
            'grant_type' => 'authorization_code',
        ]);
    }

    /** @return array<int, array<string, mixed>> */
    public function listCalendars(array $integration): array
    {
        $token = $this->accessTokenForIntegration($integration);
        $response = $this->request('GET', '/users/me/calendarList', $token);
        $items = $response['items'] ?? [];
        return is_array($items) ? array_values(array_filter($items, 'is_array')) : [];
    }

    /**
     * @param array<int, string> $calendarIds
     * @return array<int, array{start: string, end: string, calendar_id: string}>
     */
    public function freeBusy(array $integration, string $timeMin, string $timeMax, array $calendarIds): array
    {
        $calendarIds = array_values(array_unique(array_filter(array_map('trim', $calendarIds))));
        if ($calendarIds === []) {
            return [];
        }

        $token = $this->accessTokenForIntegration($integration);
        $response = $this->request('POST', '/freeBusy', $token, [
            'timeMin' => $timeMin,
            'timeMax' => $timeMax,
            'items' => array_map(static fn (string $id): array => ['id' => $id], $calendarIds),
        ]);

        $busy = [];
        foreach (($response['calendars'] ?? []) as $calendarId => $calendar) {
            if (!is_array($calendar)) {
                continue;
            }
            foreach (($calendar['busy'] ?? []) as $window) {
                if (!is_array($window) || empty($window['start']) || empty($window['end'])) {
                    continue;
                }
                $busy[] = [
                    'calendar_id' => (string) $calendarId,
                    'start' => (string) $window['start'],
                    'end' => (string) $window['end'],
                ];
            }
        }

        return $busy;
    }

    /** @return array<string, mixed> */
    public function upsertBookingEvent(array $integration, array $booking, ?array $existingLink = null): array
    {
        $calendarId = $this->calendarId($integration);
        $token = $this->accessTokenForIntegration($integration);
        $event = $this->eventPayload($booking, $integration);

        if (!empty($existingLink['external_event_id'])) {
            return $this->request(
                'PATCH',
                '/calendars/' . rawurlencode($calendarId) . '/events/' . rawurlencode((string) $existingLink['external_event_id']),
                $token,
                $event
            );
        }

        return $this->request('POST', '/calendars/' . rawurlencode($calendarId) . '/events', $token, $event);
    }

    public function deleteBookingEvent(array $integration, string $eventId): bool
    {
        if ($eventId === '') {
            return true;
        }

        $calendarId = $this->calendarId($integration);
        $token = $this->accessTokenForIntegration($integration);
        $response = $this->rawRequest(
            'DELETE',
            self::API_BASE . '/calendars/' . rawurlencode($calendarId) . '/events/' . rawurlencode($eventId),
            $token
        );

        return in_array($response['status'], [200, 204, 404, 410], true);
    }

    /** @return array<int, string> */
    public function scopes(): array
    {
        $scopes = Config::get('calendar_sync.google_scopes', []);
        if (!is_array($scopes) || $scopes === []) {
            return [
                'https://www.googleapis.com/auth/calendar.events',
                'https://www.googleapis.com/auth/calendar.freebusy',
                'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
            ];
        }

        return array_values(array_filter(array_map('strval', $scopes)));
    }

    public function encryptedToken(string $token): string
    {
        return $this->secrets()->encrypt($token);
    }

    private function secrets(): SecretBox
    {
        if ($this->secrets === null) {
            $this->secrets = new SecretBox();
        }

        return $this->secrets;
    }

    private function accessTokenForIntegration(array $integration): string
    {
        $accessToken = $this->secrets()->decrypt($integration['access_token_encrypted'] ?? null);
        $expiresAt = strtotime((string) ($integration['token_expires_at'] ?? ''));
        if ($accessToken !== null && $expiresAt !== false && $expiresAt > time() + 120) {
            return $accessToken;
        }

        $refreshToken = $this->secrets()->decrypt($integration['refresh_token_encrypted'] ?? null);
        if ($refreshToken === null) {
            throw new \RuntimeException('Google Calendar is not connected.');
        }

        $tokens = $this->tokenRequest([
            'client_id' => $this->clientId(),
            'client_secret' => $this->clientSecret(),
            'refresh_token' => $refreshToken,
            'grant_type' => 'refresh_token',
        ]);

        $newAccessToken = (string) ($tokens['access_token'] ?? '');
        if ($newAccessToken === '') {
            throw new \RuntimeException('Google did not return an access token.');
        }

        $expiresIn = max(60, (int) ($tokens['expires_in'] ?? 3600));
        $expiresAt = gmdate('Y-m-d H:i:s', time() + $expiresIn);
        Database::run(
            'UPDATE calendar_integrations
             SET access_token_encrypted = :access_token,
                 token_expires_at = :expires_at,
                 updated_at = NOW()
             WHERE id = :id',
            [
                'access_token' => $this->secrets()->encrypt($newAccessToken),
                'expires_at' => $expiresAt,
                'id' => (int) ($integration['id'] ?? 0),
            ]
        );

        return $newAccessToken;
    }

    /** @return array<string, mixed> */
    private function eventPayload(array $booking, array $integration): array
    {
        $timezone = $this->timezone($integration);
        $start = new DateTimeImmutable((string) $booking['date'] . ' ' . (string) $booking['time'], new DateTimeZone($timezone));
        $endTime = (string) ($booking['end_time'] ?? '');
        $end = $endTime !== ''
            ? new DateTimeImmutable((string) $booking['date'] . ' ' . $endTime, new DateTimeZone($timezone))
            : $start->modify('+' . max(30, (int) ($booking['total_duration_minutes'] ?? 30)) . ' minutes');

        $owner = trim((string) ($booking['owner_name'] ?? $booking['customer_name'] ?? 'Client'));
        $ownerFirst = explode(' ', $owner)[0] ?: 'Client';
        $pets = array_values(array_filter(array_map(
            static fn (mixed $pet): string => is_array($pet) ? trim((string) ($pet['pet_name'] ?? '')) : '',
            is_array($booking['pets'] ?? null) ? $booking['pets'] : []
        )));
        $petLabel = $pets !== [] ? implode(', ', $pets) : trim((string) ($booking['dog_name'] ?? 'Appointment'));
        $prefix = trim((string) (($this->settings($integration)['event_prefix'] ?? '') ?: 'Bow Wow'));

        return [
            'summary' => trim($prefix . ': ' . $petLabel . ' - ' . $ownerFirst),
            'description' => $this->eventDescription($booking),
            'start' => [
                'dateTime' => $start->format(DATE_RFC3339),
                'timeZone' => $timezone,
            ],
            'end' => [
                'dateTime' => $end->format(DATE_RFC3339),
                'timeZone' => $timezone,
            ],
            'visibility' => 'private',
            'transparency' => 'opaque',
        ];
    }

    private function eventDescription(array $booking): string
    {
        $lines = [
            'Bow Wow booking #' . (int) ($booking['id'] ?? 0),
            'Owner: ' . (string) ($booking['customer_name'] ?? $booking['owner_name'] ?? ''),
            'Phone: ' . (string) ($booking['phone'] ?? ''),
            'Email: ' . (string) ($booking['email'] ?? ''),
            'Services: ' . implode(', ', array_filter($booking['service_names'] ?? [])),
            'Duration: ' . (int) ($booking['total_duration_minutes'] ?? 0) . ' minutes',
        ];

        $pets = is_array($booking['pets'] ?? null) ? $booking['pets'] : [];
        if ($pets !== []) {
            $lines[] = 'Pets: ' . implode('; ', array_map(static function (array $pet): string {
                $name = trim((string) ($pet['pet_name'] ?? 'Pet'));
                $weight = trim((string) ($pet['approximate_weight'] ?? ''));
                return $weight !== '' ? $name . ' (' . $weight . ')' : $name;
            }, $pets));
        }

        $appUrl = rtrim((string) Config::get('app.url', ''), '/');
        if ($appUrl !== '') {
            $lines[] = 'Admin: ' . $appUrl . '/admin/booking-requests?id=' . (int) ($booking['id'] ?? 0);
        }

        return implode("\n", array_filter($lines, static fn (string $line): bool => trim($line) !== ''));
    }

    private function calendarId(array $integration): string
    {
        $calendarId = trim((string) ($integration['target_calendar_reference'] ?? ''));
        return $calendarId !== '' ? $calendarId : 'primary';
    }

    private function timezone(array $integration): string
    {
        $settings = $this->settings($integration);
        $timezone = trim((string) ($settings['timezone_override'] ?? ''));
        return $timezone !== '' ? $timezone : (string) Config::get('calendar_sync.default_timezone', 'America/New_York');
    }

    /** @return array<string, mixed> */
    private function settings(array $integration): array
    {
        $settings = $integration['settings_json'] ?? $integration['settings'] ?? [];
        if (is_string($settings)) {
            $decoded = json_decode($settings, true);
            return is_array($decoded) ? $decoded : [];
        }

        return is_array($settings) ? $settings : [];
    }

    /** @param array<string, string> $payload @return array<string, mixed> */
    private function tokenRequest(array $payload): array
    {
        $response = $this->rawRequest('POST', self::TOKEN_URL, null, $payload, false);
        if ($response['status'] < 200 || $response['status'] >= 300) {
            throw new \RuntimeException('Google Calendar token exchange failed.');
        }

        $decoded = json_decode($response['body'], true);
        return is_array($decoded) ? $decoded : [];
    }

    /** @param array<string, mixed>|null $jsonPayload @return array<string, mixed> */
    private function request(string $method, string $path, string $accessToken, ?array $jsonPayload = null): array
    {
        $response = $this->rawRequest($method, self::API_BASE . $path, $accessToken, $jsonPayload);
        if ($response['status'] < 200 || $response['status'] >= 300) {
            throw new \RuntimeException('Google Calendar API request failed.');
        }

        $decoded = json_decode($response['body'], true);
        return is_array($decoded) ? $decoded : [];
    }

    /** @param array<string, mixed>|null $payload @return array{status:int,body:string} */
    private function rawRequest(string $method, string $url, ?string $accessToken = null, ?array $payload = null, bool $json = true): array
    {
        $headers = [];
        $body = '';
        if ($accessToken !== null) {
            $headers[] = 'Authorization: Bearer ' . $accessToken;
        }
        if ($payload !== null) {
            if ($json) {
                $headers[] = 'Content-Type: application/json';
                $body = json_encode($payload, JSON_THROW_ON_ERROR);
            } else {
                $headers[] = 'Content-Type: application/x-www-form-urlencoded';
                $body = http_build_query($payload, '', '&', PHP_QUERY_RFC3986);
            }
        }

        $context = stream_context_create([
            'http' => [
                'method' => $method,
                'header' => implode("\r\n", $headers),
                'content' => $body,
                'ignore_errors' => true,
                'timeout' => 20,
            ],
        ]);

        $responseBody = @file_get_contents($url, false, $context);
        $status = $this->statusFromHeaders($http_response_header ?? []);
        return [
            'status' => $status,
            'body' => is_string($responseBody) ? $responseBody : '',
        ];
    }

    /** @param array<int, string> $headers */
    private function statusFromHeaders(array $headers): int
    {
        $first = $headers[0] ?? '';
        return preg_match('/\s(\d{3})\s/', $first, $matches) === 1 ? (int) $matches[1] : 0;
    }

    private function clientId(): string
    {
        return trim((string) Config::get('calendar_sync.google_client_id', ''));
    }

    private function clientSecret(): string
    {
        return trim((string) Config::get('calendar_sync.google_client_secret', ''));
    }

    private function redirectUri(): string
    {
        return trim((string) Config::get('calendar_sync.google_redirect_uri', ''));
    }
}
