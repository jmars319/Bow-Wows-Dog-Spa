<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Connection;
use BowWowSpa\Database\Database;
use BowWowSpa\Support\Config;
use BowWowSpa\Support\EmailContentFormatter;
use BowWowSpa\Support\Input;
use DateTimeImmutable;
use DateTimeZone;
use PDO;

final class BookingService
{
    private bool $staleChecked = false;

    public function __construct(
        private readonly ScheduleService $schedule = new ScheduleService(),
        private readonly EmailService $emails = new EmailService(),
        private readonly BookingAttachmentService $attachments = new BookingAttachmentService(),
        private readonly CalendarSyncService $calendarSync = new CalendarSyncService(),
    ) {
    }

    public function createHold(string $date, string $time, array $payload = []): array
    {
        $this->expireStalePending();

        $normalizedDate = $this->normalizeDate($date);
        $normalizedTime = $this->normalizeTime($time);
        if ($normalizedDate === null || $normalizedTime === null) {
            throw new \RuntimeException('Please choose a valid appointment date and time.');
        }

        $duration = $this->resolveDuration($payload);
        $endTime = $this->addMinutes($normalizedTime, $duration['duration_blocks'] * $this->schedule->slotMinutes());
        $slots = $this->buildSlots($normalizedTime, $endTime);
        $previousToken = isset($payload['previous_hold_token']) ? trim((string) $payload['previous_hold_token']) : null;

        return Database::transaction(function (PDO $pdo) use ($normalizedDate, $normalizedTime, $endTime, $duration, $slots, $previousToken) {
            $pdo->prepare('DELETE FROM booking_holds WHERE expires_at <= NOW()')->execute();

            if ($previousToken) {
                $stmt = $pdo->prepare('DELETE FROM booking_holds WHERE token = :token');
                $stmt->execute(['token' => $previousToken]);
            }

            $this->assertSlotsPublished($normalizedDate, $slots);
            $this->assertSlotsAvailableWithinTransaction($pdo, $normalizedDate, $slots, null);

            $token = bin2hex(random_bytes(16));
            $minutes = max(5, $this->schedule->holdMinutes());

            $sql = sprintf(
                'INSERT INTO booking_holds (date, time, end_time, expires_at, token, created_at)
                 VALUES (:date, :time, :end_time, DATE_ADD(NOW(), INTERVAL %d MINUTE), :token, NOW())',
                $minutes
            );
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                'date' => $normalizedDate,
                'time' => $normalizedTime,
                'end_time' => $endTime,
                'token' => $token,
            ]);

            return [
                'hold_token' => $token,
                'end_time' => $endTime,
                'duration_minutes' => $duration['total_duration_minutes'],
                'duration_blocks' => $duration['duration_blocks'],
                'expires_in_minutes' => $minutes,
            ];
        });
    }

    public function createBooking(array $payload, array $files = []): array
    {
        $this->expireStalePending();

        $ownerName = Input::clean($payload['owner_name'] ?? $payload['customer_name'] ?? null, 191);
        $phone = Input::phone($payload['phone'] ?? null);
        $email = Input::email($payload['email'] ?? null);
        $date = $this->normalizeDate((string) ($payload['date'] ?? ''));
        $time = $this->normalizeTime((string) ($payload['time'] ?? ''));

        if ($ownerName === null || $phone === null || $email === null || $date === null || $time === null) {
            throw new \RuntimeException('Missing required booking fields.');
        }

        $pets = $this->normalizePets($payload);
        if ($pets === []) {
            throw new \RuntimeException('Add at least one dog before submitting the request.');
        }
        $duration = $this->resolveDuration($payload, $pets);
        $endTime = $this->addMinutes($time, $duration['duration_blocks'] * $this->schedule->slotMinutes());
        $slots = $this->buildSlots($time, $endTime);
        $holdToken = isset($payload['hold_token']) ? trim((string) $payload['hold_token']) : null;
        $servicesJson = json_encode($duration['services']);
        $petsJson = json_encode($pets);
        $firstPet = $pets[0] ?? [];
        $legacyDogNotes = $this->firstPetNotes($firstPet);

        return Database::transaction(function (PDO $pdo) use (
            $date,
            $time,
            $endTime,
            $slots,
            $payload,
            $ownerName,
            $phone,
            $email,
            $holdToken,
            $servicesJson,
            $petsJson,
            $pets,
            $duration,
            $firstPet,
            $legacyDogNotes,
            $files
        ) {
            $pdo->prepare('DELETE FROM booking_holds WHERE expires_at <= NOW()')->execute();

            $hold = null;
            if ($holdToken) {
                $stmt = $pdo->prepare('SELECT * FROM booking_holds WHERE token = :token AND expires_at > NOW() LIMIT 1 FOR UPDATE');
                $stmt->execute(['token' => $holdToken]);
                $hold = $stmt->fetch();
                if (!$hold) {
                    throw new \RuntimeException('That selected time is no longer reserved. Please choose another time.');
                }

                $holdTime = $this->normalizeTime((string) ($hold['time'] ?? ''));
                $holdEndTime = $this->normalizeTime((string) ($hold['end_time'] ?? ''));
                if ((string) ($hold['date'] ?? '') !== $date || $holdTime !== $time || $holdEndTime !== $endTime) {
                    throw new \RuntimeException('That selected time is no longer reserved. Please choose another time.');
                }
            }

            $this->assertSlotsPublished($date, $slots);
            $this->assertSlotsAvailableWithinTransaction($pdo, $date, $slots, $holdToken ?: null);

            $stmt = $pdo->prepare(
                'INSERT INTO booking_requests (
                    date,
                    time,
                    end_time,
                    customer_name,
                    phone,
                    email,
                    dog_name,
                    dog_notes,
                    pets_json,
                    services_json,
                    total_duration_minutes,
                    vet_name,
                    vet_phone,
                    request_notes,
                    paperwork_notes,
                    admin_notes,
                    status,
                    created_at,
                    updated_at
                ) VALUES (
                    :date,
                    :time,
                    :end_time,
                    :customer_name,
                    :phone,
                    :email,
                    :dog_name,
                    :dog_notes,
                    :pets_json,
                    :services_json,
                    :total_duration_minutes,
                    :vet_name,
                    :vet_phone,
                    :request_notes,
                    :paperwork_notes,
                    :admin_notes,
                    "pending_confirmation",
                    NOW(),
                    NOW()
                )'
            );
            $stmt->execute([
                'date' => $date,
                'time' => $time,
                'end_time' => $endTime,
                'customer_name' => $ownerName,
                'phone' => $phone,
                'email' => $email,
                'dog_name' => $firstPet['pet_name'] ?? null,
                'dog_notes' => $legacyDogNotes,
                'pets_json' => $petsJson,
                'services_json' => $servicesJson,
                'total_duration_minutes' => $duration['total_duration_minutes'],
                'vet_name' => Input::clean($payload['vet_name'] ?? null, 191),
                'vet_phone' => Input::phone($payload['vet_phone'] ?? null),
                'request_notes' => Input::clean($payload['notes'] ?? $payload['request_notes'] ?? null, 5000, true),
                'paperwork_notes' => Input::clean($payload['paperwork_notes'] ?? null, 5000, true),
                'admin_notes' => Input::clean($payload['admin_notes'] ?? null, 5000, true),
            ]);

            $bookingId = (int) $pdo->lastInsertId();

            if ($hold) {
                $pdo->prepare('DELETE FROM booking_holds WHERE id = :id')->execute(['id' => $hold['id']]);
            }

            if (!empty($files['paperwork_upload']) && ($files['paperwork_upload']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
                $this->attachments->storeForBooking($bookingId, $files['paperwork_upload']);
            }

            $saved = $this->find($bookingId);
            if ($saved === null) {
                throw new \RuntimeException('Unable to load saved booking.');
            }

            error_log(sprintf(
                '[BowWow][booking_created] id=%d date=%s time=%s status=%s',
                $bookingId,
                $saved['date'],
                $saved['time'],
                $saved['status']
            ));

            return $saved;
        });
    }

    public function find(int $id): ?array
    {
        $row = Database::fetch('SELECT * FROM booking_requests WHERE id = :id LIMIT 1', ['id' => $id]);
        return $row ? $this->hydrateBooking($row) : null;
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

        $sql .= ' ORDER BY created_at DESC LIMIT 250';

        return array_map([$this, 'hydrateBooking'], Database::fetchAll($sql, $params));
    }

    public function transition(int $id, string $action, ?string $notes, int $adminId, AuditService $audit): array
    {
        $this->expireStalePending();
        $notes = Input::clean($notes, 5000, true);

        $booking = Database::fetch('SELECT * FROM booking_requests WHERE id = :id LIMIT 1', ['id' => $id]);
        if (!$booking) {
            throw new \RuntimeException('Booking not found.');
        }

        $statusMap = [
            'confirm' => 'confirmed',
            'decline' => 'declined',
            'cancel' => 'cancelled',
            'complete' => 'completed',
        ];

        if (!isset($statusMap[$action])) {
            throw new \RuntimeException('Unknown action.');
        }

        $newStatus = $statusMap[$action];
        $currentStatus = (string) $booking['status'];
        $allowedTransitions = [
            'confirm' => ['pending_confirmation'],
            'decline' => ['pending_confirmation'],
            'cancel' => ['pending_confirmation', 'confirmed'],
            'complete' => ['confirmed'],
        ];

        if (!in_array($currentStatus, $allowedTransitions[$action], true)) {
            throw new \RuntimeException($this->transitionErrorMessage($action, $currentStatus));
        }

        if ($currentStatus === $newStatus) {
            throw new \RuntimeException('That booking is already marked ' . $newStatus . '.');
        }

        Database::run(
            'UPDATE booking_requests SET status = :status, admin_notes = :notes, updated_at = NOW() WHERE id = :id',
            [
                'status' => $newStatus,
                'notes' => $notes,
                'id' => $id,
            ]
        );

        $audit->log($adminId, 'booking_' . $action, 'booking_requests', $id, ['previous' => $booking['status']]);

        $updated = $this->find($id);
        if ($updated === null) {
            throw new \RuntimeException('Unable to load updated booking.');
        }

        if (Config::get('sendgrid.send_customer_confirmations', true)) {
            if ($newStatus === 'confirmed') {
                $this->sendConfirmedEmail($updated);
            }
            if ($newStatus === 'declined') {
                $this->sendDeclinedEmail($updated, $notes);
            }
        }

        error_log(sprintf(
            '[BowWow][booking_status_changed] id=%d from=%s to=%s admin=%d',
            $id,
            $currentStatus,
            $newStatus,
            $adminId
        ));

        $this->queueCalendarSync($updated, $currentStatus);

        return $updated;
    }

    public function updateNotes(int $id, ?string $notes, int $adminId, AuditService $audit): array
    {
        $this->expireStalePending();

        $booking = Database::fetch('SELECT * FROM booking_requests WHERE id = :id LIMIT 1', ['id' => $id]);
        if (!$booking) {
            throw new \RuntimeException('Booking not found.');
        }

        $normalizedNotes = Input::clean($notes, 5000, true);
        $previousNotes = $this->nullableString($booking['admin_notes'] ?? null);
        if ($normalizedNotes === $previousNotes) {
            $unchanged = $this->find($id);
            if ($unchanged === null) {
                throw new \RuntimeException('Unable to load booking.');
            }

            return $unchanged;
        }

        Database::run(
            'UPDATE booking_requests SET admin_notes = :notes, updated_at = NOW() WHERE id = :id',
            [
                'notes' => $normalizedNotes,
                'id' => $id,
            ]
        );

        $audit->log($adminId, 'booking_notes_update', 'booking_requests', $id, [
            'status' => $booking['status'],
        ]);

        $updated = $this->find($id);
        if ($updated === null) {
            throw new \RuntimeException('Unable to load updated booking.');
        }

        return $updated;
    }

    public function stats(): array
    {
        $this->expireStalePending();

        $today = date('Y-m-d');
        $week = (new DateTimeImmutable('today', new DateTimeZone('UTC')))->modify('monday this week')->format('Y-m-d');

        $new = Database::fetch('SELECT COUNT(*) as total FROM booking_requests WHERE status = "pending_confirmation"')['total'] ?? 0;
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
            'pending_confirmation' => (int) $new,
            'confirmed_today' => (int) $confirmedToday,
            'confirmed_week' => (int) $confirmedWeek,
        ];
    }

    public function extendHold(int $bookingId): array
    {
        $booking = Database::fetch('SELECT * FROM booking_requests WHERE id = :id LIMIT 1', ['id' => $bookingId]);
        if (!$booking || $booking['status'] !== 'pending_confirmation') {
            throw new \RuntimeException('Only pending bookings can be extended.');
        }

        Database::run('UPDATE booking_requests SET created_at = NOW(), updated_at = NOW() WHERE id = :id', ['id' => $bookingId]);

        $updated = $this->find($bookingId);
        if ($updated === null) {
            throw new \RuntimeException('Unable to load updated booking.');
        }

        return $updated;
    }

    public function releaseHold(int $bookingId, ?string $notes, int $adminId, AuditService $audit): array
    {
        $notes = Input::clean($notes, 5000, true);
        $booking = Database::fetch('SELECT * FROM booking_requests WHERE id = :id LIMIT 1', ['id' => $bookingId]);
        if (!$booking || $booking['status'] !== 'pending_confirmation') {
            throw new \RuntimeException('Only pending bookings can be released.');
        }

        Database::run(
            'UPDATE booking_requests SET status = "cancelled", admin_notes = :notes, updated_at = NOW() WHERE id = :id',
            ['id' => $bookingId, 'notes' => $notes]
        );
        $audit->log($adminId, 'booking_release', 'booking_requests', $bookingId, ['previous' => $booking['status']]);

        $updated = $this->find($bookingId);
        if ($updated === null) {
            throw new \RuntimeException('Unable to load updated booking.');
        }

        return $updated;
    }

    public function findAttachment(int $bookingId, int $attachmentId): ?array
    {
        return $this->attachments->find($bookingId, $attachmentId);
    }

    public function attachmentAbsolutePath(array $attachment): string
    {
        return $this->attachments->absolutePath($attachment);
    }

    private function hydrateBooking(array $row): array
    {
        $services = json_decode($row['services_json'] ?? '[]', true);
        $pets = json_decode($row['pets_json'] ?? '[]', true);

        if (!is_array($services)) {
            $services = [];
        }
        if (!is_array($pets)) {
            $pets = [];
        }

        return [
            'id' => (int) $row['id'],
            'date' => $row['date'],
            'time' => $this->normalizeTime((string) $row['time']),
            'end_time' => $row['end_time'] ? $this->normalizeTime((string) $row['end_time']) : null,
            'customer_name' => $row['customer_name'],
            'owner_name' => $row['customer_name'],
            'phone' => $row['phone'],
            'email' => $row['email'],
            'dog_name' => $row['dog_name'],
            'dog_notes' => $row['dog_notes'],
            'pets' => $pets,
            'pets_json' => $row['pets_json'],
            'services' => $services,
            'services_json' => $row['services_json'],
            'service_names' => $this->serviceNames($services),
            'total_duration_minutes' => (int) ($row['total_duration_minutes'] ?? 30),
            'vet_name' => $row['vet_name'] ?? null,
            'vet_phone' => $row['vet_phone'] ?? null,
            'request_notes' => $row['request_notes'] ?? null,
            'paperwork_notes' => $row['paperwork_notes'] ?? null,
            'paperwork_attachments' => $this->attachments->listForBooking((int) $row['id']),
            'status' => $row['status'],
            'admin_notes' => $row['admin_notes'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];
    }

    private function resolveDuration(array $payload, ?array $pets = null): array
    {
        $petCount = max(1, count($pets ?? $this->normalizePets($payload)));
        $serviceIds = $this->normalizeServiceIds(
            $payload['selected_services'] ?? $payload['service_ids'] ?? $payload['services'] ?? []
        );

        $fallbackMinutes = null;
        if (!empty($payload['duration_minutes'])) {
            $fallbackMinutes = (int) $payload['duration_minutes'];
        } elseif (!empty($payload['duration_blocks'])) {
            $fallbackMinutes = (int) $payload['duration_blocks'] * $this->schedule->slotMinutes();
        }

        $duration = $this->schedule->calculateDuration($serviceIds, $petCount, $fallbackMinutes);
        if ($duration['services'] !== []) {
            return $duration;
        }

        $manualServices = $this->normalizeManualServices($payload['services'] ?? []);
        if ($manualServices !== []) {
            $duration['services'] = $manualServices;
        }

        return $duration;
    }

    private function normalizePets(array $payload): array
    {
        $rawPets = $payload['dogs'] ?? $payload['pets'] ?? null;
        if (is_string($rawPets)) {
            $decoded = json_decode($rawPets, true);
            $rawPets = is_array($decoded) ? $decoded : null;
        }

        $expectedPetCount = isset($payload['pet_count']) ? max(1, (int) $payload['pet_count']) : null;
        if (!is_array($rawPets) || $rawPets === []) {
            $legacyName = Input::clean($payload['dog_name'] ?? $payload['pet_name'] ?? null, 191);
            if ($legacyName === null) {
                return [];
            }

            return [[
                'pet_name' => $legacyName,
                'breed' => Input::clean($payload['breed'] ?? null, 120),
                'approximate_weight' => Input::clean($payload['approximate_weight'] ?? null, 40),
                'temperament_notes' => Input::clean($payload['temperament_notes'] ?? $payload['dog_notes'] ?? null, 2000, true),
                'medical_or_grooming_notes' => Input::clean($payload['medical_or_grooming_notes'] ?? null, 2000, true),
            ]];
        }

        if (count($rawPets) > 10) {
            throw new \RuntimeException('Please submit no more than 10 dogs per request.');
        }

        $pets = [];
        foreach ($rawPets as $index => $pet) {
            if (!is_array($pet)) {
                throw new \RuntimeException('Review the dog details and try again.');
            }

            $name = Input::clean($pet['pet_name'] ?? $pet['name'] ?? null, 191);
            $weight = Input::clean($pet['approximate_weight'] ?? $pet['weight'] ?? null, 40);
            if ($name === null || $weight === null) {
                throw new \RuntimeException(sprintf('Dog %d needs a name and approximate weight before you continue.', $index + 1));
            }

            $pets[] = [
                'pet_name' => $name,
                'breed' => Input::clean($pet['breed'] ?? null, 120),
                'approximate_weight' => $weight,
                'temperament_notes' => Input::clean($pet['temperament_notes'] ?? null, 2000, true),
                'medical_or_grooming_notes' => Input::clean($pet['medical_or_grooming_notes'] ?? $pet['notes'] ?? null, 2000, true),
            ];
        }

        if ($expectedPetCount !== null && $expectedPetCount !== count($pets)) {
            throw new \RuntimeException('Dog count changed. Please review the request and choose a time again.');
        }

        return $pets;
    }

    private function normalizeServiceIds(mixed $value): array
    {
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            $value = is_array($decoded) ? $decoded : explode(',', $value);
        }

        if (!is_array($value)) {
            return [];
        }

        $ids = [];
        foreach ($value as $entry) {
            if (is_array($entry) && isset($entry['id'])) {
                $entry = $entry['id'];
            }

            $id = (int) $entry;
            if ($id > 0) {
                $ids[] = $id;
            }
        }

        return array_values(array_unique($ids));
    }

    private function normalizeManualServices(mixed $value): array
    {
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            $value = is_array($decoded) ? $decoded : preg_split('/\r?\n|,/', $value);
        }

        if (!is_array($value)) {
            return [];
        }

        $services = [];
        foreach ($value as $entry) {
            if (is_string($entry)) {
                $name = Input::clean($entry, 191);
                if ($name !== null) {
                    $services[] = ['name' => $name];
                }
            }
        }

        return $services;
    }

    private function buildSlots(string $start, ?string $end): array
    {
        $normalizedStart = $this->normalizeTime($start);
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
            $cursor += $this->schedule->slotMinutes() * 60;
            if ($cursor >= $endTs) {
                break;
            }
            $slots[] = date('H:i:s', $cursor);
        }

        return $slots;
    }

    private function assertSlotsAvailableWithinTransaction(PDO $pdo, string $date, array $slots, ?string $excludeHoldToken): void
    {
        if ($slots === []) {
            throw new \RuntimeException('No valid time slot selected.');
        }

        $bookingStmt = $pdo->prepare(
            'SELECT time, end_time FROM booking_requests
             WHERE date = :date AND status IN ("pending_confirmation", "confirmed")
             FOR UPDATE'
        );
        $bookingStmt->execute(['date' => $date]);
        $rows = $bookingStmt->fetchAll();

        foreach ($rows as $row) {
            $taken = $this->buildSlots((string) $row['time'], $row['end_time'] ? (string) $row['end_time'] : null);
            if (array_intersect($slots, $taken)) {
                throw new \RuntimeException('Selected time is no longer available.');
            }
        }

        $params = ['date' => $date];
        $holdSql = 'SELECT time, end_time FROM booking_holds WHERE date = :date AND expires_at > NOW()';
        if ($excludeHoldToken) {
            $holdSql .= ' AND token != :token';
            $params['token'] = $excludeHoldToken;
        }
        $holdSql .= ' FOR UPDATE';

        $holdStmt = $pdo->prepare($holdSql);
        $holdStmt->execute($params);
        foreach ($holdStmt->fetchAll() as $row) {
            $taken = $this->buildSlots((string) $row['time'], $row['end_time'] ? (string) $row['end_time'] : null);
            if (array_intersect($slots, $taken)) {
                throw new \RuntimeException('Selected time is currently being requested by another client.');
            }
        }
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

        Database::run(
            'UPDATE booking_requests
             SET status = "expired", updated_at = NOW()
             WHERE status = "pending_confirmation"
               AND created_at < DATE_SUB(NOW(), INTERVAL ' . (int) $hours . ' HOUR)'
        );

        $this->staleChecked = true;
    }

    private function sendConfirmedEmail(array $booking): void
    {
        $detailsTable = EmailContentFormatter::detailsTable([
            'Appointment Date' => $booking['date'],
            'Appointment Time' => $booking['time'],
            'Estimated Duration' => $booking['total_duration_minutes'] . ' minutes',
            'Dogs' => $this->formatPetsForEmail($booking['pets']),
            'Services' => implode(', ', $booking['service_names']),
            'Vet' => $booking['vet_name'],
            'Notes' => $booking['request_notes'],
        ]);

        $this->emails->send(
            $booking['email'],
            $booking['customer_name'],
            'Appointment request confirmed',
            '<p>Hi ' . htmlspecialchars((string) $booking['customer_name'], ENT_QUOTES, 'UTF-8') . ',</p>'
            . '<p>Your appointment request has been confirmed. We look forward to seeing you and your dog.</p>'
            . $detailsTable
            . '<p style="margin-top:16px;">Need to make a change? Give us a call and we’ll help.</p>',
            [
                'variant' => 'customer',
                'headline' => 'Your appointment is confirmed',
            ]
        );
    }

    private function sendDeclinedEmail(array $booking, ?string $notes): void
    {
        $detailsTable = EmailContentFormatter::detailsTable([
            'Requested Date' => $booking['date'],
            'Requested Time' => $booking['time'],
            'Dogs' => $this->formatPetsForEmail($booking['pets']),
            'Services' => implode(', ', $booking['service_names']),
            'Team Notes' => $notes,
        ]);

        $this->emails->send(
            $booking['email'],
            $booking['customer_name'],
            'Appointment request update',
            '<p>Hi ' . htmlspecialchars((string) $booking['customer_name'], ENT_QUOTES, 'UTF-8') . ',</p>'
            . '<p>We could not confirm the requested appointment as submitted.</p>'
            . $detailsTable
            . '<p style="margin-top:16px;">Please reply to this email or call us so we can help you choose another option.</p>',
            [
                'variant' => 'customer',
                'headline' => 'Update on your appointment request',
            ]
        );
    }

    private function serviceNames(array $services): array
    {
        $names = [];
        foreach ($services as $service) {
            if (is_string($service)) {
                $name = trim($service);
            } elseif (is_array($service)) {
                $name = trim((string) ($service['name'] ?? ''));
            } else {
                $name = '';
            }

            if ($name !== '') {
                $names[] = $name;
            }
        }

        return $names;
    }

    private function formatPetsForEmail(array $pets): ?string
    {
        if ($pets === []) {
            return null;
        }

        $labels = [];
        foreach ($pets as $pet) {
            if (!is_array($pet)) {
                continue;
            }

            $label = trim((string) ($pet['pet_name'] ?? ''));
            $weight = trim((string) ($pet['approximate_weight'] ?? ''));
            if ($weight !== '') {
                $label .= $label !== '' ? ' (' . $weight . ')' : $weight;
            }
            if ($label !== '') {
                $labels[] = $label;
            }
        }

        return $labels ? implode('; ', $labels) : null;
    }

    private function firstPetNotes(array $pet): ?string
    {
        $notes = array_filter([
            $this->nullableString($pet['temperament_notes'] ?? null),
            $this->nullableString($pet['medical_or_grooming_notes'] ?? null),
        ]);

        return $notes ? implode(' | ', $notes) : null;
    }

    private function addMinutes(string $time, int $minutes): string
    {
        $normalized = $this->normalizeTime($time);
        if ($normalized === null) {
            throw new \RuntimeException('Invalid appointment time.');
        }

        $base = strtotime($normalized);
        if ($base === false) {
            throw new \RuntimeException('Invalid appointment time.');
        }

        return date('H:i:s', strtotime(sprintf('+%d minutes', $minutes), $base));
    }

    private function normalizeTime(string $time): ?string
    {
        return $this->schedule->normalizeTimeInput($time);
    }

    private function normalizeDate(string $date): ?string
    {
        $date = trim($date);
        if ($date === '') {
            return null;
        }

        $parsed = DateTimeImmutable::createFromFormat('Y-m-d', $date);
        if ($parsed === false || $parsed->format('Y-m-d') !== $date) {
            return null;
        }

        return $date;
    }

    private function nullableString(mixed $value): ?string
    {
        $string = trim((string) $value);
        return $string !== '' ? $string : null;
    }

    private function assertSlotsPublished(string $date, array $slots): void
    {
        $publishedTimes = $this->schedule->publishedTimesForDate($date);
        if ($publishedTimes === []) {
            throw new \RuntimeException('Selected time is no longer available.');
        }

        $publishedLookup = array_fill_keys($publishedTimes, true);
        foreach ($slots as $slot) {
            if (!isset($publishedLookup[$slot])) {
                throw new \RuntimeException('Selected time is no longer available.');
            }
        }
    }

    private function transitionErrorMessage(string $action, string $currentStatus): string
    {
        return match ($action) {
            'confirm' => 'Only pending requests can be confirmed.',
            'decline' => 'Only pending requests can be declined.',
            'complete' => 'Only confirmed bookings can be marked completed.',
            'cancel' => in_array($currentStatus, ['declined', 'cancelled', 'completed', 'expired'], true)
                ? 'That booking can no longer be cancelled.'
                : 'Only pending or confirmed bookings can be cancelled.',
            default => 'That action is not available for this booking.',
        };
    }

    private function queueCalendarSync(array $booking, string $previousStatus): void
    {
        try {
            $this->calendarSync->queueBookingSync($booking, $previousStatus);
        } catch (\Throwable $e) {
            error_log(sprintf(
                '[BowWow][calendar_sync_queue_failed] booking=%d status=%s previous=%s error=%s',
                (int) ($booking['id'] ?? 0),
                (string) ($booking['status'] ?? ''),
                $previousStatus,
                $e->getMessage()
            ));
        }
    }
}
