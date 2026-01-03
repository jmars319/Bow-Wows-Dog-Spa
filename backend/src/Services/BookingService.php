<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Connection;
use BowWowSpa\Database\Database;
use BowWowSpa\Support\Config;
use BowWowSpa\Support\EmailContentFormatter;
use DateTimeImmutable;
use DateTimeZone;

final class BookingService
{
    public function __construct(
        private readonly ScheduleService $schedule = new ScheduleService(),
        private readonly EmailService $emails = new EmailService(),
    ) {
    }

    private bool $staleChecked = false;
    private int $slotMinutes = 30;

    public function createHold(string $date, string $time, ?int $minutes = null): string
    {
        $this->expireStalePending();
        $minutes = max(1, (int) ($minutes ?? $this->schedule->holdMinutes()));
        $slots = $this->buildSlots($time, null);
        $this->assertSlotsAvailable($date, $slots);

        return Database::transaction(function () use ($date, $time, $minutes) {
            $pdo = Connection::pdo();
            $pdo->prepare('DELETE FROM booking_holds WHERE expires_at <= NOW()')->execute();

            $stmt = $pdo->prepare('SELECT id FROM booking_holds WHERE date = :date AND time = :time AND expires_at > NOW() LIMIT 1 FOR UPDATE');
            $stmt->execute(['date' => $date, 'time' => $time]);
            if ($stmt->fetch()) {
                throw new \RuntimeException('Slot already on hold.');
            }

            $token = bin2hex(random_bytes(16));
            $sql = sprintf(
                'INSERT INTO booking_holds (date, time, expires_at, token, created_at) 
                 VALUES (:date, :time, DATE_ADD(NOW(), INTERVAL %d MINUTE), :token, NOW())',
                $minutes
            );
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                'date' => $date,
                'time' => $time,
                'token' => $token,
            ]);

            return $token;
        });
    }

    public function createBooking(array $payload): array
    {
        $this->expireStalePending();
        $date = $payload['date'];
        $time = $payload['time'];
        $services = $payload['services'] ?? [];
        $holdToken = $payload['hold_token'] ?? null;
        $durationBlocks = max(1, (int) ($payload['duration_blocks'] ?? 1));
        $endTime = $payload['end_time'] ?? null;
        if (!$endTime) {
            $startTs = strtotime($time);
            if ($startTs !== false) {
                $endTs = strtotime('+' . ($durationBlocks * $this->slotMinutes) . ' minutes', $startTs);
                $endTime = $endTs ? date('H:i:s', $endTs) : null;
            }
        }
        $slots = $this->buildSlots($time, $endTime);
        $this->assertSlotsAvailable($date, $slots);

        return Database::transaction(function () use ($date, $time, $payload, $services, $holdToken, $slots, $endTime) {
            $pdo = Connection::pdo();

            $pdo->prepare('DELETE FROM booking_holds WHERE date = :date AND time = :time AND expires_at <= NOW()')->execute([
                'date' => $date,
                'time' => $time,
            ]);

            $hold = null;
            if ($holdToken) {
                $stmt = $pdo->prepare('SELECT * FROM booking_holds WHERE token = :token AND expires_at > NOW() FOR UPDATE');
                $stmt->execute(['token' => $holdToken]);
                $hold = $stmt->fetch();
                if (!$hold) {
                    throw new \RuntimeException('Hold expired.');
                }
            } else {
                $stmt = $pdo->prepare('SELECT id FROM booking_holds WHERE date = :date AND time = :time AND expires_at > NOW() LIMIT 1 FOR UPDATE');
                $stmt->execute(['date' => $date, 'time' => $time]);
                $hold = $stmt->fetch();
                if ($hold) {
                    throw new \RuntimeException('Slot currently held.');
                }
            }

            $stmt = $pdo->prepare(
                'INSERT INTO booking_requests (date, time, end_time, customer_name, phone, email, dog_name, dog_notes, services_json, admin_notes, status, created_at, updated_at) 
                 VALUES (:date, :time, :end_time, :customer_name, :phone, :email, :dog_name, :dog_notes, :services, :admin_notes, "pending_confirmation", NOW(), NOW())'
            );
            $stmt->execute([
                'date' => $date,
                'time' => $time,
                'end_time' => $endTime,
                'customer_name' => $payload['customer_name'],
                'phone' => $payload['phone'],
                'email' => $payload['email'],
                'dog_name' => $payload['dog_name'] ?? null,
                'dog_notes' => $payload['dog_notes'] ?? null,
                'services' => json_encode($services),
                'admin_notes' => $payload['admin_notes'] ?? null,
            ]);

            $bookingId = (int) $pdo->lastInsertId();
            if ($hold) {
                $pdo->prepare('DELETE FROM booking_holds WHERE id = :id')->execute(['id' => $hold['id']]);
            }

            $row = Database::fetch('SELECT * FROM booking_requests WHERE id = :id', ['id' => $bookingId]);

            return $row ?: [
                'id' => $bookingId,
                'status' => 'pending_confirmation',
            ];
        });
    }

    public function list(array $filters = []): array
    {
        $this->expireStalePending();
        $sql = 'SELECT * FROM booking_requests WHERE 1=1';
        $params = [];

        if (!empty($filters['status'])) {
            $sql .= ' AND status = :status';
            $params['status'] = $filters['status'];
        }

        $sql .= ' ORDER BY created_at DESC LIMIT 200';
        return Database::fetchAll($sql, $params);
    }

    public function transition(int $id, string $action, ?string $notes, int $adminId, AuditService $audit): array
    {
        $this->expireStalePending();
        $booking = Database::fetch('SELECT * FROM booking_requests WHERE id = :id', ['id' => $id]);
        if (!$booking) {
            throw new \RuntimeException('Booking not found.');
        }

        $statusMap = [
            'confirm' => 'confirmed',
            'decline' => 'declined',
            'cancel' => 'cancelled',
        ];

        if (!isset($statusMap[$action])) {
            throw new \RuntimeException('Unknown action.');
        }

        $newStatus = $statusMap[$action];
        Database::run(
            'UPDATE booking_requests SET status = :status, admin_notes = :notes, updated_at = NOW() WHERE id = :id',
            [
                'status' => $newStatus,
                'notes' => $notes,
                'id' => $id,
            ]
        );

        $audit->log($adminId, 'booking_' . $action, 'booking_requests', $id, ['previous' => $booking['status']]);

        if ($newStatus === 'confirmed' && Config::get('sendgrid.send_customer_confirmations', true)) {
            $services = json_decode($booking['services_json'] ?? '[]', true);
            $detailsTable = EmailContentFormatter::detailsTable([
                'Appointment Date' => $booking['date'],
                'Appointment Time' => $booking['time'],
                'Dog' => $booking['dog_name'] ?? null,
                'Services' => EmailContentFormatter::formatServices(is_array($services) ? $services : []),
                'Notes' => $booking['dog_notes'] ?? null,
            ]);

            $this->emails->send(
                $booking['email'],
                $booking['customer_name'],
                'Booking confirmed',
                '<p>Hi ' . htmlspecialchars($booking['customer_name'], ENT_QUOTES, 'UTF-8') . ',</p>'
                . '<p>Your appointment is confirmed. We look forward to seeing you and ' . htmlspecialchars($booking['dog_name'] ?? 'your pup', ENT_QUOTES, 'UTF-8') . '.</p>'
                . $detailsTable
                . '<p style="margin-top:16px;">Need to make a change? Call (336) 555-9663.</p>',
                [
                    'variant' => 'customer',
                    'headline' => 'Your appointment is confirmed',
                ]
            );
        }

        return ['id' => $id, 'status' => $newStatus];
    }

    public function stats(): array
    {
        $this->expireStalePending();
        $today = date('Y-m-d');
        $week = (new DateTimeImmutable('today', new DateTimeZone('UTC')))->modify('monday this week')->format('Y-m-d');

        $new = Database::fetch('SELECT COUNT(*) as total FROM booking_requests WHERE status = "pending_confirmation"', [])['total'] ?? 0;
        $pending = $new;
        $confirmedToday = Database::fetch(
            'SELECT COUNT(*) as total FROM booking_requests WHERE status = "confirmed" AND date = :date',
            ['date' => $today]
        )['total'] ?? 0;
        $confirmedWeek = Database::fetch(
            'SELECT COUNT(*) as total FROM booking_requests WHERE status = "confirmed" AND date >= :week_start',
            ['week_start' => $week]
        )['total'] ?? 0;

        return [
            'new_requests' => (int) $new,
            'pending_confirmation' => (int) $pending,
            'confirmed_today' => (int) $confirmedToday,
            'confirmed_week' => (int) $confirmedWeek,
        ];
    }

    private function expireStalePending(): void
    {
        if ($this->staleChecked) {
            return;
        }

        $hours = $this->schedule->pendingExpireHours();
        if ($hours <= 0) {
            $this->staleChecked = true;
            return;
        }

        $threshold = (int) $hours;
        Database::run(
            'UPDATE booking_requests 
             SET status = "expired", updated_at = NOW() 
             WHERE status = "pending_confirmation" 
             AND created_at < DATE_SUB(NOW(), INTERVAL ' . $threshold . ' HOUR)'
        );

        $this->staleChecked = true;
    }

    public function extendHold(int $bookingId): array
    {
        $booking = Database::fetch('SELECT * FROM booking_requests WHERE id = :id', ['id' => $bookingId]);
        if (!$booking || $booking['status'] !== 'pending_confirmation') {
            throw new \RuntimeException('Only pending bookings can be extended.');
        }

        Database::run('UPDATE booking_requests SET created_at = NOW(), updated_at = NOW() WHERE id = :id', ['id' => $bookingId]);

        return ['id' => $bookingId, 'status' => 'pending_confirmation'];
    }

    public function releaseHold(int $bookingId, ?string $notes, int $adminId, AuditService $audit): array
    {
        $booking = Database::fetch('SELECT * FROM booking_requests WHERE id = :id', ['id' => $bookingId]);
        if (!$booking || $booking['status'] !== 'pending_confirmation') {
            throw new \RuntimeException('Only pending bookings can be released.');
        }

        Database::run(
            'UPDATE booking_requests SET status = "cancelled", admin_notes = :notes, updated_at = NOW() WHERE id = :id',
            ['id' => $bookingId, 'notes' => $notes]
        );
        $audit->log($adminId, 'booking_release', 'booking_requests', $bookingId, ['previous' => $booking['status']]);

        return ['id' => $bookingId, 'status' => 'cancelled'];
    }

    private function buildSlots(string $start, ?string $end): array
    {
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

        return array_values(array_unique($slots));
    }

    private function assertSlotsAvailable(string $date, array $slots): void
    {
        if (empty($slots)) {
            return;
        }

        $bookings = Database::fetchAll(
            'SELECT time, end_time FROM booking_requests WHERE date = :date AND status IN ("pending_confirmation","confirmed")',
            ['date' => $date]
        );

        foreach ($bookings as $booking) {
            $taken = $this->buildSlots($booking['time'], $booking['end_time']);
            if (array_intersect($slots, $taken)) {
                throw new \RuntimeException('Slot already booked.');
            }
        }

        $holds = Database::fetchAll('SELECT time FROM booking_holds WHERE date = :date AND expires_at > NOW()', ['date' => $date]);
        $holding = array_column($holds, 'time');
        foreach ($slots as $slot) {
            if (in_array($slot, $holding, true)) {
                throw new \RuntimeException('Slot currently held.');
            }
        }
    }
}
