<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;

final class ScheduleService
{
    private array $defaultSettings = [
        'booking_hold_minutes' => 1440,
        'booking_pending_expire_hours' => 24,
    ];

    private ?array $settingsCache = null;
    private int $slotMinutes = 30;

    public function getTemplates(): array
    {
        return Database::fetchAll('SELECT * FROM schedule_weekday_templates ORDER BY weekday ASC');
    }

    public function saveTemplate(array $payload): void
    {
        $times = $payload['times'] ?? [];
        if (!is_array($times)) {
            $times = [];
        }
        $times = array_values(array_unique(array_filter(array_map('trim', $times), fn ($value) => $value !== '')));
        sort($times);
        Database::run(
            'INSERT INTO schedule_weekday_templates (weekday, times_json, capacity_json, is_enabled) 
             VALUES (:weekday, :times, :capacity, :enabled)
             ON DUPLICATE KEY UPDATE times_json = VALUES(times_json), capacity_json = VALUES(capacity_json), is_enabled = VALUES(is_enabled)',
            [
                'weekday' => $payload['weekday'],
                'times' => json_encode($times),
                'capacity' => json_encode($payload['capacity'] ?? []),
                'enabled' => (int) ($payload['is_enabled'] ?? 1),
            ]
        );
    }

    public function getOverrides(): array
    {
        return Database::fetchAll('SELECT * FROM schedule_date_overrides ORDER BY date ASC LIMIT 90');
    }

    public function saveOverride(array $payload): void
    {
        $times = $payload['times'] ?? [];
        if (is_string($times)) {
            $times = array_map('trim', explode(',', $times));
        }
        if (!is_array($times)) {
            $times = [];
        }
        $times = array_values(array_unique(array_filter(array_map('trim', $times), fn ($value) => $value !== '')));
        sort($times);
        Database::run(
            'INSERT INTO schedule_date_overrides (date, is_closed, times_json, capacity_json) 
             VALUES (:date, :closed, :times, :capacity)
             ON DUPLICATE KEY UPDATE is_closed = VALUES(is_closed), times_json = VALUES(times_json), capacity_json = VALUES(capacity_json)',
            [
                'date' => $payload['date'],
                'closed' => (int) ($payload['is_closed'] ?? 0),
                'times' => json_encode($times),
                'capacity' => json_encode($payload['capacity'] ?? []),
            ]
        );
    }

    public function availabilityForDate(string $date): array
    {
        $override = Database::fetch('SELECT * FROM schedule_date_overrides WHERE date = :date', ['date' => $date]);
        if ($override) {
            if ((int) $override['is_closed'] === 1) {
                return [];
            }
            $times = json_decode($override['times_json'], true) ?? [];
        } else {
            $weekday = (int) date('w', strtotime($date));
            $template = Database::fetch('SELECT * FROM schedule_weekday_templates WHERE weekday = :weekday AND is_enabled = 1', [
                'weekday' => $weekday,
            ]);
            $times = $template ? json_decode($template['times_json'], true) ?? [] : [];
        }

        $times = array_values(array_filter(array_map('trim', $times), fn ($time) => $time !== ''));
        sort($times);

        $blocked = Database::fetchAll(
            'SELECT id, time, end_time, status, created_at FROM booking_requests WHERE date = :date AND status IN ("pending_confirmation", "confirmed")',
            ['date' => $date]
        );

        $blockedTimes = [];
        $pendingHours = $this->pendingExpireHours();
        $pendingThreshold = $pendingHours > 0 ? strtotime(sprintf('-%d hours', $pendingHours)) : null;
        foreach ($blocked as $row) {
            if ($row['status'] === 'pending_confirmation' && $pendingThreshold) {
                $created = strtotime($row['created_at']);
                if ($created !== false && $created < $pendingThreshold) {
                    Database::run('UPDATE booking_requests SET status = "expired", updated_at = NOW() WHERE id = :id', ['id' => $row['id']]);
                    continue;
                }
            }
            foreach ($this->expandSlots($row['time'], $row['end_time']) as $slot) {
                $blockedTimes[$slot] = true;
            }
        }

        $holds = Database::fetchAll(
            'SELECT time FROM booking_holds WHERE date = :date AND expires_at > NOW()',
            ['date' => $date]
        );

        foreach ($holds as $hold) {
            foreach ($this->expandSlots($hold['time'], null) as $slot) {
                $blockedTimes[$slot] = true;
            }
        }

        $available = [];
        foreach ($times as $time) {
            if (!isset($blockedTimes[$time])) {
                $available[] = [
                    'time' => $time,
                    'label' => date('g:i A', strtotime($time)),
                ];
            }
        }

        return $available;
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
                $sanitized = max(5, min(1440, $sanitized));
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

    private function expandSlots(?string $start, ?string $end): array
    {
        if (!$start) {
            return [];
        }

        $slots = [$start];
        if (!$end) {
            return $slots;
        }

        $startTs = strtotime($start);
        $endTs = strtotime($end);
        if ($startTs === false || $endTs === false || $endTs <= $startTs) {
            return $slots;
        }

        $cursor = $startTs;
        while (true) {
            $cursor += $this->slotMinutes * 60;
            if ($cursor >= $endTs) {
                break;
            }
            $slots[] = date('H:i:s', $cursor);
        }

        return $slots;
    }
}
