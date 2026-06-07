<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

final class BookingRequestAdminService
{
    public function __construct(
        private readonly BookingService $bookings = new BookingService(),
        private readonly BookingCustomerEmailService $customerEmails = new BookingCustomerEmailService(),
    ) {
    }

    public function previewCustomerEmail(int $bookingId, string $template, ?string $notes = null): array
    {
        $booking = $this->bookings->find($bookingId);
        if ($booking === null) {
            throw new \RuntimeException('Booking not found.');
        }

        return $this->customerEmails->preview($template === 'decline' ? 'declined' : 'confirmed', $booking, $notes);
    }

    public function exportCsv(array $filters = []): string
    {
        $rows = $this->bookings->list($filters);
        $handle = fopen('php://temp', 'r+');
        if ($handle === false) {
            throw new \RuntimeException('Unable to prepare export.');
        }

        fputcsv($handle, [
            'Request ID',
            'Status',
            'Internal Test',
            'Source',
            'Customer',
            'Email',
            'Phone',
            'Date',
            'Time',
            'End Time',
            'Duration Minutes',
            'Dogs',
            'Services',
            'Request Notes',
            'Admin Notes',
            'Created At',
        ], ',', '"', '');

        foreach ($rows as $booking) {
            fputcsv($handle, [
                $booking['id'],
                $booking['status'],
                !empty($booking['is_internal_test']) ? 'Yes' : 'No',
                $booking['source'] ?? '',
                $booking['customer_name'],
                $booking['email'],
                $booking['phone'],
                $booking['date'],
                $booking['time'],
                $booking['end_time'],
                $booking['total_duration_minutes'],
                $this->csvPets($booking['pets']),
                implode('; ', $booking['service_names']),
                $booking['request_notes'],
                $booking['admin_notes'],
                $booking['created_at'],
            ], ',', '"', '');
        }

        rewind($handle);
        $csv = stream_get_contents($handle);
        fclose($handle);
        return $csv === false ? '' : $csv;
    }

    private function csvPets(array $pets): string
    {
        $labels = [];
        foreach ($pets as $pet) {
            if (!is_array($pet)) {
                continue;
            }

            $label = trim((string) ($pet['pet_name'] ?? $pet['name'] ?? ''));
            $weight = trim((string) ($pet['approximate_weight'] ?? $pet['weight'] ?? ''));
            if ($weight !== '') {
                $label .= $label !== '' ? ' (' . $weight . ')' : $weight;
            }
            if ($label !== '') {
                $labels[] = $label;
            }
        }

        return implode('; ', $labels);
    }
}
