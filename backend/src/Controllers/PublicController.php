<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use DateTimeImmutable;
use BowWowSpa\Http\Request;
use BowWowSpa\Http\Response;
use BowWowSpa\Services\BookingService;
use BowWowSpa\Services\ContactService;
use BowWowSpa\Services\EmailService;
use BowWowSpa\Services\ScheduleService;
use BowWowSpa\Services\SiteContentService;
use BowWowSpa\Support\Config;
use BowWowSpa\Support\EmailContentFormatter;

final class PublicController
{
    public function __construct(
        private readonly SiteContentService $content = new SiteContentService(),
        private readonly ScheduleService $schedule = new ScheduleService(),
        private readonly BookingService $bookings = new BookingService(),
        private readonly ContactService $contacts = new ContactService(),
        private readonly EmailService $emails = new EmailService(),
    ) {
    }

    public function site(Request $request): void
    {
        Response::success($this->content->getSiteSnapshot());
    }

    public function schedule(Request $request): void
    {
        $date = trim((string) ($request->query['date'] ?? ''));
        if ($date === '' || !$this->isValidDate($date)) {
            Response::error('validation_error', 'Date is required', 422);
        }

        $serviceIds = $this->decodeArrayField($request->query['service_ids'] ?? []);
        $rawPetCount = (int) ($request->query['pet_count'] ?? 1);
        if ($rawPetCount < 1 || $rawPetCount > 10) {
            Response::error('validation_error', 'Pet count is invalid.', 422);
        }
        $petCount = max(1, $rawPetCount);
        $excludeHoldToken = isset($request->query['hold_token']) ? trim((string) $request->query['hold_token']) : null;
        try {
            $duration = $this->schedule->calculateDuration($serviceIds, $petCount);
            $availability = $this->schedule->availabilityForDate($date, [
                'service_ids' => $serviceIds,
                'pet_count' => $petCount,
                'exclude_hold_token' => $excludeHoldToken,
            ]);
            $nextAvailable = $availability === []
                ? $this->schedule->nextAvailableOption($date, [
                    'service_ids' => $serviceIds,
                    'pet_count' => $petCount,
                    'exclude_hold_token' => $excludeHoldToken,
                ])
                : null;
        } catch (\RuntimeException $e) {
            Response::error('validation_error', $e->getMessage(), 422);
        }

        Response::success([
            'date' => $date,
            'duration_minutes' => $duration['total_duration_minutes'],
            'duration_blocks' => $duration['duration_blocks'],
            'availability' => $availability,
            'next_available' => $nextAvailable,
        ]);
    }

    public function bookingHold(Request $request): void
    {
        $date = trim((string) ($request->body['date'] ?? ''));
        $time = trim((string) ($request->body['time'] ?? ''));
        if ($date === '' || $time === '') {
            Response::error('validation_error', 'Date and time are required', 422);
        }
        if (!$this->isValidDate($date) || $this->schedule->normalizeTimeInput($time) === null) {
            Response::error('validation_error', 'Please choose a valid date and time.', 422);
        }

        $serviceIds = $this->decodeArrayField($request->body['selected_services'] ?? $request->body['service_ids'] ?? []);
        $rawPetCount = (int) ($request->body['pet_count'] ?? 1);
        $petCount = max(1, $rawPetCount);
        if ($serviceIds === []) {
            Response::error('validation_error', 'Select at least one service before choosing a time.', 422);
        }
        if ($rawPetCount < 1 || $rawPetCount > 10) {
            Response::error('validation_error', 'Add at least one dog before choosing a time.', 422);
        }

        try {
            $hold = $this->bookings->createHold($date, $time, [
                'service_ids' => $serviceIds,
                'pet_count' => $petCount,
                'previous_hold_token' => $request->body['previous_hold_token'] ?? null,
            ]);
        } catch (\Throwable $e) {
            $status = $this->bookingErrorStatus($e->getMessage());
            Response::error(
                $status === 409 ? 'hold_error' : 'validation_error',
                $e->getMessage(),
                $status,
                [
                    'next_available' => $status === 409
                        ? $this->nextAvailableForSelection($date, $time, $serviceIds, $petCount)
                        : null,
                ]
            );
        }

        Response::success($hold);
    }

    public function bookingRequest(Request $request): void
    {
        $payload = $request->body;
        $payload['selected_services'] = $this->decodeArrayField($payload['selected_services'] ?? $payload['service_ids'] ?? []);
        $payload['dogs'] = $this->decodeArrayField($payload['dogs'] ?? $payload['pets'] ?? []);

        $required = ['owner_name', 'phone', 'email', 'date', 'time'];
        foreach ($required as $field) {
            if (empty($payload[$field])) {
                Response::error('validation_error', 'Missing field: ' . $field, 422);
            }
        }

        if (!is_array($payload['selected_services']) || $payload['selected_services'] === []) {
            Response::error('validation_error', 'Select at least one service before requesting a time.', 422);
        }

        if (!is_array($payload['dogs']) || $payload['dogs'] === []) {
            Response::error('validation_error', 'Add at least one dog before submitting your request.', 422);
        }

        if (empty($payload['hold_token'])) {
            Response::error('validation_error', 'Please choose an available time before submitting your request.', 422);
        }

        try {
            $booking = $this->bookings->createBooking($payload, $request->files);
        } catch (\Throwable $e) {
            $status = $this->bookingErrorStatus($e->getMessage());
            Response::error(
                $status === 409 ? 'booking_unavailable' : 'validation_error',
                $e->getMessage(),
                $status,
                [
                    'next_available' => $status === 409
                        ? $this->nextAvailableForSelection(
                            (string) ($payload['date'] ?? ''),
                            (string) ($payload['time'] ?? ''),
                            is_array($payload['selected_services']) ? $payload['selected_services'] : [],
                            max(1, count(is_array($payload['dogs']) ? $payload['dogs'] : []))
                        )
                        : null,
                ]
            );
        }

        $adminUrl = rtrim((string) Config::get('app.url', ''), '/') . '/admin/booking';
        $attachmentNames = $this->formatAttachments($booking['paperwork_attachments'] ?? []);
        $detailsTable = EmailContentFormatter::detailsTable([
            'Owner' => $booking['owner_name'],
            'Phone' => $booking['phone'],
            'Email' => $booking['email'],
            'Dogs' => $this->formatPets($booking['pets']),
            'Services' => implode(', ', $booking['service_names']),
            'Requested Date' => $booking['date'],
            'Requested Time' => $booking['time'],
            'Estimated Duration' => $booking['total_duration_minutes'] . ' minutes',
            'Vet' => $booking['vet_name'],
            'Vet Phone' => $booking['vet_phone'],
            'Notes' => $booking['request_notes'],
            'Paperwork Notes' => $booking['paperwork_notes'],
            'Paperwork Uploads' => $attachmentNames,
        ]);

        $summary = '<p><strong>New appointment request pending review.</strong></p>'
            . '<p><strong>'
            . htmlspecialchars((string) $booking['owner_name'], ENT_QUOTES, 'UTF-8')
            . '</strong> requested '
            . htmlspecialchars((string) $booking['time'], ENT_QUOTES, 'UTF-8')
            . ' on '
            . htmlspecialchars((string) $booking['date'], ENT_QUOTES, 'UTF-8')
            . ' for '
            . htmlspecialchars(implode(', ', $booking['service_names']), ENT_QUOTES, 'UTF-8')
            . '.</p>'
            . $detailsTable
            . '<p style="margin-top:16px;"><a href="' . htmlspecialchars($adminUrl, ENT_QUOTES, 'UTF-8') . '">Open the booking queue</a></p>';

        $this->emails->notifyStaff(
            sprintf('New booking request: %s · %s', $booking['owner_name'], $booking['date']),
            $summary,
            [
                'reply_to' => [
                    'email' => (string) $booking['email'],
                    'name' => (string) $booking['owner_name'],
                ],
            ]
        );

        if (Config::get('sendgrid.send_customer_receipts', true)) {
            $customerBody = '<p>Hi ' . htmlspecialchars((string) $booking['owner_name'], ENT_QUOTES, 'UTF-8') . ',</p>'
                . '<p>Thanks for reaching out to Bow Wow’s Dog Spa. We received your appointment request, and our team will review it before confirming the visit.</p>'
                . $detailsTable
                . '<p style="margin-top:16px;">Need to update something before we confirm it? Reply to this email or call us directly.</p>';

            $this->emails->send(
                $booking['email'],
                $booking['owner_name'],
                'We received your appointment request',
                $customerBody,
                [
                    'variant' => 'customer',
                    'headline' => 'We received your appointment request',
                ]
            );
        }

        Response::success([
            'booking' => $booking,
            'status' => 'pending_confirmation',
        ]);
    }

    public function contact(Request $request): void
    {
        $required = ['name', 'email', 'message'];
        foreach ($required as $field) {
            if (empty($request->body[$field])) {
                Response::error('validation_error', 'Missing field: ' . $field, 422);
            }
        }

        try {
            $this->contacts->handle($request->body);
        } catch (\RuntimeException $e) {
            Response::error('validation_error', $e->getMessage(), 422);
        }
        Response::success(['received' => true]);
    }

    private function decodeArrayField(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }

        if (!is_string($value)) {
            return [];
        }

        $decoded = json_decode($value, true);
        if (is_array($decoded)) {
            return $decoded;
        }

        $parts = array_map('trim', explode(',', $value));
        return array_values(array_filter($parts, static fn (string $part): bool => $part !== ''));
    }

    private function formatPets(array $pets): ?string
    {
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

    private function formatAttachments(array $attachments): ?string
    {
        $names = [];
        foreach ($attachments as $attachment) {
            if (!is_array($attachment)) {
                continue;
            }

            $name = trim((string) ($attachment['original_name'] ?? ''));
            if ($name !== '') {
                $names[] = $name;
            }
        }

        return $names ? implode(', ', $names) : null;
    }

    private function bookingErrorStatus(string $message): int
    {
        $message = strtolower($message);
        $conflictNeedles = [
            'no longer reserved',
            'no longer available',
            'currently being requested',
            'choose another time',
            'selected time',
        ];

        foreach ($conflictNeedles as $needle) {
            if (str_contains($message, $needle)) {
                return 409;
            }
        }

        return 422;
    }

    private function nextAvailableForSelection(string $date, string $time, array $serviceIds, int $petCount): ?array
    {
        if (trim($date) === '') {
            return null;
        }

        try {
            return $this->schedule->nextAvailableOption($date, [
                'service_ids' => $serviceIds,
                'pet_count' => max(1, $petCount),
            ], $time !== '' ? $time : null);
        } catch (\Throwable) {
            return null;
        }
    }

    private function isValidDate(string $date): bool
    {
        $parsed = DateTimeImmutable::createFromFormat('Y-m-d', $date);
        return $parsed !== false && $parsed->format('Y-m-d') === $date;
    }
}
