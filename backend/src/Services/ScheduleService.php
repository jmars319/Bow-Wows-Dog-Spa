<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;
use DateTimeImmutable;

final class ScheduleService
{
    private array $defaultSettings = [
        'booking_hold_minutes' => 30,
        'booking_pending_expire_hours' => 24,
    ];

    private ?array $settingsCache = null;
    private int $slotMinutes = 30;

    public function __construct(private readonly ServiceCatalogService $services = new ServiceCatalogService())
    {
    }

    public function getTemplates(): array
    {
        return Database::fetchAll('SELECT * FROM schedule_weekday_templates ORDER BY weekday ASC');
    }

    public function saveTemplate(array $payload): void
    {
        $weekday = (int) ($payload['weekday'] ?? -1);
        if ($weekday < 0 || $weekday > 6) {
            throw new \RuntimeException('Weekday must be between 0 and 6.');
        }

        $times = $this->normalizeTimes($payload['times'] ?? []);

        Database::run(
            'INSERT INTO schedule_weekday_templates (weekday, times_json, capacity_json, is_enabled)
             VALUES (:weekday, :times, :capacity, :enabled)
             ON DUPLICATE KEY UPDATE times_json = VALUES(times_json), capacity_json = VALUES(capacity_json), is_enabled = VALUES(is_enabled)',
            [
                'weekday' => $weekday,
                'times' => json_encode($times),
                'capacity' => json_encode($payload['capacity'] ?? []),
                'enabled' => (int) ($payload['is_enabled'] ?? 1),
            ]
        );
    }

    public function getOverrides(): array
    {
        return Database::fetchAll('SELECT * FROM schedule_date_overrides ORDER BY date ASC LIMIT 120');
    }

    public function saveOverride(array $payload): void
    {
        $date = trim((string) ($payload['date'] ?? ''));
        if (!$this->isValidDate($date)) {
            throw new \RuntimeException('Override date must use YYYY-MM-DD.');
        }

        $times = $payload['times'] ?? [];
        if (is_string($times)) {
            $times = explode(',', $times);
        }

        Database::run(
            'INSERT INTO schedule_date_overrides (date, is_closed, times_json, capacity_json)
             VALUES (:date, :closed, :times, :capacity)
             ON DUPLICATE KEY UPDATE is_closed = VALUES(is_closed), times_json = VALUES(times_json), capacity_json = VALUES(capacity_json)',
            [
                'date' => $date,
                'closed' => (int) ($payload['is_closed'] ?? 0),
                'times' => json_encode($this->normalizeTimes($times)),
                'capacity' => json_encode($payload['capacity'] ?? []),
            ]
        );
    }

    public function availabilityForDate(string $date, array $options = []): array
    {
        $times = $this->publishedTimesForDate($date);
        if ($times === []) {
            return [];
        }

        $duration = $this->calculateDuration(
            $options['service_ids'] ?? [],
            (int) ($options['pet_count'] ?? 1),
            isset($options['duration_minutes']) ? (int) $options['duration_minutes'] : null
        );
        $durationBlocks = max(1, (int) ceil($duration['total_duration_minutes'] / $this->slotMinutes));
        $publishedLookup = array_fill_keys($times, true);
        $blockedLookup = $this->blockedLookupForDate($date, $options['exclude_hold_token'] ?? null);

        $available = [];
        foreach ($times as $time) {
            if (!$this->slotWindowFits($time, $durationBlocks, $publishedLookup, $blockedLookup)) {
                continue;
            }

            $endTime = $this->addMinutes($time, $durationBlocks * $this->slotMinutes);
            $available[] = [
                'time' => $time,
                'label' => $this->formatTime($time),
                'end_time' => $endTime,
                'range_label' => sprintf('%s - %s', $this->formatTime($time), $this->formatTime($endTime)),
            ];
        }

        return $available;
    }

    public function nextAvailableOption(string $date, array $options = [], ?string $afterTime = null, int $daysToSearch = 45): ?array
    {
        $baseDate = strtotime($date);
        if ($baseDate === false) {
            return null;
        }

        $normalizedAfterTime = $afterTime ? $this->normalizeTime($afterTime) : null;

        for ($offset = 0; $offset < $daysToSearch; $offset++) {
            $candidateDate = date('Y-m-d', strtotime(sprintf('+%d day', $offset), $baseDate));
            $availability = $this->availabilityForDate($candidateDate, $options);

            if ($normalizedAfterTime !== null && $offset === 0) {
                $availability = array_values(array_filter(
                    $availability,
                    fn (array $slot): bool => strcmp((string) ($slot['time'] ?? ''), $normalizedAfterTime) > 0
                ));
            }

            if ($availability === []) {
                continue;
            }

            $slot = $availability[0];

            return [
                'date' => $candidateDate,
                'date_label' => $this->formatDateLabel($candidateDate),
                'time' => $slot['time'],
                'label' => $slot['label'],
                'range_label' => $slot['range_label'],
            ];
        }

        return null;
    }

    public function calculateDuration(array $serviceIds = [], int $petCount = 1, ?int $fallbackMinutes = null): array
    {
        $normalizedIds = array_values(array_unique(array_filter(array_map('intval', $serviceIds), static fn (int $id): bool => $id > 0)));
        $selection = $this->services->calculateSelection($normalizedIds, $petCount);
        if ($normalizedIds !== [] && count($selection['services']) !== count($normalizedIds)) {
            throw new \RuntimeException('One or more selected services are no longer available. Please reselect your services.');
        }
        $minutes = (int) $selection['total_duration_minutes'];
        if ($normalizedIds === [] && $fallbackMinutes !== null) {
            $minutes = max($this->slotMinutes, $fallbackMinutes);
        }

        $selection['total_duration_minutes'] = max($this->slotMinutes, $minutes);
        $selection['duration_blocks'] = max(1, (int) ceil($selection['total_duration_minutes'] / $this->slotMinutes));

        return $selection;
    }

    public function getSettings(): array
    {
        if ($this->settingsCache !== null) {
            return $this->settingsCache;
        }

        $settings = $this->defaultSettings;
        foreach (array_keys($this->defaultSettings) as $key) {
            $row = Database::fetch('SELECT `value` FROM site_settings WHERE `key` = :key LIMIT 1', ['key' => $key]);
            if ($row && isset($row['value'])) {
                $settings[$key] = (int) $row['value'];
            }
        }

        $this->settingsCache = $settings;
        return $settings;
    }

    public function saveSettings(array $settings): void
    {
        $allowed = array_keys($this->defaultSettings);
        foreach ($settings as $key => $value) {
            if (!in_array($key, $allowed, true)) {
                continue;
            }

            $sanitized = (int) $value;
            if ($key === 'booking_hold_minutes') {
                $sanitized = max(5, min(240, $sanitized));
            }
            if ($key === 'booking_pending_expire_hours') {
                $sanitized = max(0, min(72, $sanitized));
            }

            Database::run(
                'INSERT INTO site_settings (`key`, `value`) VALUES (:key, :value)
                 ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
                ['key' => $key, 'value' => (string) $sanitized]
            );
        }

        $this->settingsCache = null;
    }

    public function holdMinutes(): int
    {
        $settings = $this->getSettings();
        return max(5, (int) ($settings['booking_hold_minutes'] ?? $this->defaultSettings['booking_hold_minutes']));
    }

    public function slotMinutes(): int
    {
        return $this->slotMinutes;
    }

    public function pendingExpireHours(): int
    {
        $settings = $this->getSettings();
        return max(0, (int) ($settings['booking_pending_expire_hours'] ?? $this->defaultSettings['booking_pending_expire_hours']));
    }

    public function deleteOverride(int $id): void
    {
        Database::run('DELETE FROM schedule_date_overrides WHERE id = :id', ['id' => $id]);
    }

    public function publishedTimesForDate(string $date): array
    {
        if (!$this->isValidDate($date)) {
            return [];
        }

        $override = Database::fetch('SELECT * FROM schedule_date_overrides WHERE date = :date', ['date' => $date]);
        if ($override) {
            if ((int) $override['is_closed'] === 1) {
                return [];
            }

            return $this->normalizeTimes(json_decode($override['times_json'], true) ?? []);
        }

        $weekday = (int) date('w', strtotime($date));
        $template = Database::fetch(
            'SELECT * FROM schedule_weekday_templates WHERE weekday = :weekday AND is_enabled = 1 LIMIT 1',
            ['weekday' => $weekday]
        );

        return $template ? $this->normalizeTimes(json_decode($template['times_json'], true) ?? []) : [];
    }

    public function normalizeTimeInput(string $time): ?string
    {
        return $this->normalizeTime($time);
    }

    private function blockedLookupForDate(string $date, ?string $excludeHoldToken = null): array
    {
        $blockedLookup = [];

        $pendingHours = $this->pendingExpireHours();
        $pendingThreshold = $pendingHours > 0 ? strtotime(sprintf('-%d hours', $pendingHours)) : null;
        $bookings = Database::fetchAll(
            'SELECT id, time, end_time, status, created_at FROM booking_requests WHERE date = :date AND status IN ("pending_confirmation", "confirmed")',
            ['date' => $date]
        );

        foreach ($bookings as $booking) {
            if ($booking['status'] === 'pending_confirmation' && $pendingThreshold) {
                $created = strtotime((string) $booking['created_at']);
                if ($created !== false && $created < $pendingThreshold) {
                    Database::run('UPDATE booking_requests SET status = "expired", updated_at = NOW() WHERE id = :id', ['id' => $booking['id']]);
                    continue;
                }
            }

            foreach ($this->expandSlots($booking['time'], $booking['end_time']) as $slot) {
                $blockedLookup[$slot] = true;
            }
        }

        $params = ['date' => $date];
        $sql = 'SELECT time, end_time FROM booking_holds WHERE date = :date AND expires_at > NOW()';
        if ($excludeHoldToken) {
            $sql .= ' AND token != :token';
            $params['token'] = $excludeHoldToken;
        }

        foreach (Database::fetchAll($sql, $params) as $hold) {
            foreach ($this->expandSlots($hold['time'], $hold['end_time']) as $slot) {
                $blockedLookup[$slot] = true;
            }
        }

        return $blockedLookup;
    }

    private function slotWindowFits(string $startTime, int $blocks, array $publishedLookup, array $blockedLookup): bool
    {
        for ($index = 0; $index < $blocks; $index++) {
            $slot = $this->addMinutes($startTime, $index * $this->slotMinutes);
            if (!isset($publishedLookup[$slot]) || isset($blockedLookup[$slot])) {
                return false;
            }
        }

        return true;
    }

    private function normalizeTimes(array $times): array
    {
        $normalized = [];
        foreach ($times as $time) {
            $clean = $this->normalizeTime((string) $time);
            if ($clean !== null) {
                $normalized[] = $clean;
            }
        }

        $normalized = array_values(array_unique($normalized));
        sort($normalized);

        return $normalized;
    }

    private function normalizeTime(string $time): ?string
    {
        $time = strtoupper(trim($time));
        if ($time === '') {
            return null;
        }

        $time = preg_replace('/\s+/', '', $time) ?? $time;

        if (preg_match('/^(\d{1,2})(\d{2})$/', $time, $matches)) {
            return $this->normalizeTimeParts((int) $matches[1], (int) $matches[2], null);
        }

        if (preg_match('/^(\d{1,2})(?::?(\d{2}))?(AM|PM)$/', $time, $matches)) {
            $minutes = isset($matches[2]) && $matches[2] !== '' ? (int) $matches[2] : 0;
            return $this->normalizeTimeParts((int) $matches[1], $minutes, $matches[3]);
        }

        if (preg_match('/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/', $time, $matches)) {
            return $this->normalizeTimeParts((int) $matches[1], (int) $matches[2], null);
        }

        if (preg_match('/^(\d{1,2})$/', $time, $matches)) {
            return $this->normalizeTimeParts((int) $matches[1], 0, null);
        }

        $parsed = strtotime(strtolower($time));
        if ($parsed === false) {
            return null;
        }

        return date('H:i:s', $parsed);
    }

    private function normalizeTimeParts(int $hour, int $minutes, ?string $suffix): ?string
    {
        if ($minutes < 0 || $minutes > 59) {
            return null;
        }

        if ($suffix !== null) {
            if ($hour < 1 || $hour > 12) {
                return null;
            }

            if ($suffix === 'AM') {
                $hour = $hour === 12 ? 0 : $hour;
            } else {
                $hour = $hour === 12 ? 12 : $hour + 12;
            }
        } elseif ($hour < 0 || $hour > 23) {
            return null;
        }

        return sprintf('%02d:%02d:00', $hour, $minutes);
    }

    private function expandSlots(?string $start, ?string $end): array
    {
        $normalizedStart = $start ? $this->normalizeTime($start) : null;
        if ($normalizedStart === null) {
            return [];
        }

        $slots = [$normalizedStart];
        $normalizedEnd = $end ? $this->normalizeTime($end) : null;
        if ($normalizedEnd === null) {
            return $slots;
        }

        $cursor = strtotime($normalizedStart);
        $endTs = strtotime($normalizedEnd);
        if ($cursor === false || $endTs === false || $endTs <= $cursor) {
            return $slots;
        }

        while (true) {
            $cursor += $this->slotMinutes * 60;
            if ($cursor >= $endTs) {
                break;
            }
            $slots[] = date('H:i:s', $cursor);
        }

        return $slots;
    }

    private function addMinutes(string $time, int $minutes): string
    {
        $base = strtotime($time);
        if ($base === false) {
            return $time;
        }

        return date('H:i:s', strtotime(sprintf('+%d minutes', $minutes), $base));
    }

    private function formatTime(string $time): string
    {
        $parsed = strtotime($time);
        return $parsed === false ? $time : date('g:i A', $parsed);
    }

    private function formatDateLabel(string $date): string
    {
        $parsed = strtotime($date);
        return $parsed === false ? $date : date('l, F j', $parsed);
    }

    private function isValidDate(string $date): bool
    {
        $parsed = DateTimeImmutable::createFromFormat('Y-m-d', $date);
        return $parsed !== false && $parsed->format('Y-m-d') === $date;
    }
}
