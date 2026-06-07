<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Connection;
use BowWowSpa\Database\Database;
use BowWowSpa\Support\Config;
use BowWowSpa\Support\Input;
use DateTimeImmutable;
use PDO;

final class BookingService
{
    private bool $staleChecked = false;
    public function __construct(
        private readonly ScheduleService $schedule = new ScheduleService(),
        private readonly BookingCustomerEmailService $customerEmails = new BookingCustomerEmailService(),
        private readonly BookingAttachmentService $attachments = new BookingAttachmentService(),
        private readonly CalendarSyncService $calendarSync = new CalendarSyncService(),
        private readonly CalendarAvailabilityService $externalAvailability = new CalendarAvailabilityService(),
    ) {}

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
            $this->assertSlotsAvailableWithinTransaction($pdo, $normalizedDate, $slots, null, null);

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
        $isInternalTest = !empty($payload['is_internal_test']);
        $source = Input::clean($payload['source'] ?? ($isInternalTest ? 'admin_test' : 'public'), 64) ?? ($isInternalTest ? 'admin_test' : 'public');

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
            $files,
            $isInternalTest,
            $source
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
            $this->assertSlotsAvailableWithinTransaction($pdo, $date, $slots, $holdToken ?: null, null);

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
                    is_internal_test,
                    source,
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
                    :is_internal_test,
                    :source,
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
                'is_internal_test' => $isInternalTest ? 1 : 0,
                'source' => $source,
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

        $testMode = (string) ($filters['test'] ?? 'hide');
        if ($testMode === 'only') {
            $sql .= ' AND is_internal_test = 1';
        } elseif ($testMode !== 'all') {
            $sql .= ' AND is_internal_test = 0';
        }

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $sql .= ' AND (customer_name LIKE :search OR email LIKE :search OR phone LIKE :search OR dog_name LIKE :search OR request_notes LIKE :search OR admin_notes LIKE :search)';
            $params['search'] = '%' . $search . '%';
        }

        $dateFrom = $this->normalizeDate((string) ($filters['date_from'] ?? ''));
        if ($dateFrom !== null) {
            $sql .= ' AND date >= :date_from';
            $params['date_from'] = $dateFrom;
        }

        $dateTo = $this->normalizeDate((string) ($filters['date_to'] ?? ''));
        if ($dateTo !== null) {
            $sql .= ' AND date <= :date_to';
            $params['date_to'] = $dateTo;
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

        $isInternalTest = (int) ($updated['is_internal_test'] ?? 0) === 1;
        if (!$isInternalTest && Config::get('sendgrid.send_customer_confirmations', true) && $newStatus === 'confirmed') {
            $this->customerEmails->sendConfirmed($updated);
        }
        if (!$isInternalTest && Config::get('sendgrid.send_customer_confirmations', true) && $newStatus === 'declined') {
            $this->customerEmails->sendDeclined($updated, $notes);
        }

        error_log(sprintf('[BowWow][booking_status_changed] id=%d from=%s to=%s admin=%d', $id, $currentStatus, $newStatus, $adminId));

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

    public function updateBookingDetails(int $id, array $payload, int $adminId, AuditService $audit): array
    {
        $this->expireStalePending();

        $existing = Database::fetch('SELECT * FROM booking_requests WHERE id = :id LIMIT 1', ['id' => $id]);
        if (!$existing) {
            throw new \RuntimeException('Booking not found.');
        }

        $status = (string) $existing['status'];
        if (!in_array($status, ['pending_confirmation', 'confirmed'], true)) {
            throw new \RuntimeException('Only pending or confirmed bookings can be edited.');
        }

        $ownerName = Input::clean($payload['owner_name'] ?? $payload['customer_name'] ?? $existing['customer_name'] ?? null, 191);
        $phone = Input::phone($payload['phone'] ?? $existing['phone'] ?? null);
        $email = Input::email($payload['email'] ?? $existing['email'] ?? null);
        $date = $this->normalizeDate((string) ($payload['date'] ?? $existing['date'] ?? ''));
        $time = $this->normalizeTime((string) ($payload['time'] ?? $existing['time'] ?? ''));
        if ($ownerName === null || $phone === null || $email === null || $date === null || $time === null) {
            throw new \RuntimeException('Review the booking date, time, and customer contact fields.');
        }

        $payloadForDuration = $payload;
        if (!isset($payloadForDuration['dogs']) && !isset($payloadForDuration['pets'])) {
            $payloadForDuration['pets'] = json_decode((string) ($existing['pets_json'] ?? '[]'), true) ?: [];
        }
        if (!isset($payloadForDuration['selected_services']) && !isset($payloadForDuration['service_ids'])) {
            $existingServices = json_decode((string) ($existing['services_json'] ?? '[]'), true) ?: [];
            $payloadForDuration['selected_services'] = array_values(array_filter(array_map(
                static fn (mixed $service): int => is_array($service) ? (int) ($service['id'] ?? 0) : 0,
                $existingServices
            )));
            if ($payloadForDuration['selected_services'] === []) {
                $payloadForDuration['services'] = $existingServices;
            }
        }

        $pets = $this->normalizePets($payloadForDuration);
        if ($pets === []) {
            throw new \RuntimeException('Add at least one dog before saving the booking.');
        }
        $duration = $this->resolveDuration($payloadForDuration, $pets);
        if (!empty($payload['duration_minutes'])) {
            $duration['total_duration_minutes'] = max($this->schedule->slotMinutes(), (int) $payload['duration_minutes']);
            $duration['duration_blocks'] = max(1, (int) ceil($duration['total_duration_minutes'] / $this->schedule->slotMinutes()));
        }
        $endTime = $this->addMinutes($time, $duration['duration_blocks'] * $this->schedule->slotMinutes());
        $slots = $this->buildSlots($time, $endTime);
        $servicesJson = json_encode($duration['services']);
        $petsJson = json_encode($pets);
        $firstPet = $pets[0] ?? [];
        $legacyDogNotes = $this->firstPetNotes($firstPet);
        $vetName = Input::clean($payload['vet_name'] ?? $existing['vet_name'] ?? null, 191);
        $vetPhone = Input::phone($payload['vet_phone'] ?? $existing['vet_phone'] ?? null);
        $requestNotes = Input::clean($payload['request_notes'] ?? $payload['notes'] ?? $existing['request_notes'] ?? null, 5000, true);
        $paperworkNotes = Input::clean($payload['paperwork_notes'] ?? $existing['paperwork_notes'] ?? null, 5000, true);
        $adminNotes = Input::clean($payload['admin_notes'] ?? $existing['admin_notes'] ?? null, 5000, true);

        Database::transaction(function (PDO $pdo) use (
            $id,
            $date,
            $time,
            $endTime,
            $slots,
            $ownerName,
            $phone,
            $email,
            $payload,
            $servicesJson,
            $petsJson,
            $pets,
            $duration,
            $firstPet,
            $legacyDogNotes,
            $vetName,
            $vetPhone,
            $requestNotes,
            $paperworkNotes,
            $adminNotes
        ): void {
            $this->assertSlotsPublished($date, $slots);
            $this->assertSlotsAvailableWithinTransaction($pdo, $date, $slots, null, $id);

            $stmt = $pdo->prepare(
                'UPDATE booking_requests
                 SET date = :date,
                     time = :time,
                     end_time = :end_time,
                     customer_name = :customer_name,
                     phone = :phone,
                     email = :email,
                     dog_name = :dog_name,
                     dog_notes = :dog_notes,
                     pets_json = :pets_json,
                     services_json = :services_json,
                     total_duration_minutes = :total_duration_minutes,
                     vet_name = :vet_name,
                     vet_phone = :vet_phone,
                     request_notes = :request_notes,
                     paperwork_notes = :paperwork_notes,
                     admin_notes = :admin_notes,
                     updated_at = NOW()
                 WHERE id = :id'
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
                'vet_name' => $vetName,
                'vet_phone' => $vetPhone,
                'request_notes' => $requestNotes,
                'paperwork_notes' => $paperworkNotes,
                'admin_notes' => $adminNotes,
                'id' => $id,
            ]);
        });

        $audit->log($adminId, 'booking_detail_update', 'booking_requests', $id, [
            'previous_status' => $status,
        ]);

        $updated = $this->find($id);
        if ($updated === null) {
            throw new \RuntimeException('Unable to load updated booking.');
        }

        if ($updated['status'] === 'confirmed') {
            $this->queueCalendarSync($updated, 'confirmed');
        }

        return $updated;
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
            'is_internal_test' => (int) ($row['is_internal_test'] ?? 0) === 1,
            'source' => $row['source'] ?? 'public',
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

    private function assertSlotsAvailableWithinTransaction(PDO $pdo, string $date, array $slots, ?string $excludeHoldToken, ?int $excludeBookingId): void
    {
        if ($slots === []) {
            throw new \RuntimeException('No valid time slot selected.');
        }

        $bookingSql = 'SELECT id, time, end_time FROM booking_requests
             WHERE date = :date AND status IN ("pending_confirmation", "confirmed")';
        $params = ['date' => $date];
        if ($excludeBookingId !== null && $excludeBookingId > 0) {
            $bookingSql .= ' AND id != :exclude_booking_id';
            $params['exclude_booking_id'] = $excludeBookingId;
        }
        $bookingSql .= ' FOR UPDATE';
        $bookingStmt = $pdo->prepare($bookingSql);
        $bookingStmt->execute($params);
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

        $externalBusy = $this->externalAvailability->busyLookupForDate($date, $slots);
        if (array_intersect($slots, array_keys($externalBusy)) !== []) {
            throw new \RuntimeException('Selected time is no longer available.');
        }
    }

    public function expireStalePending(): void
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
        if (!empty($booking['is_internal_test'])) {
            return;
        }

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
