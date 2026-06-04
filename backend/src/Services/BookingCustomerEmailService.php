<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Support\EmailContentFormatter;

final class BookingCustomerEmailService
{
    public function __construct(private readonly EmailService $emails = new EmailService())
    {
    }

    public function sendConfirmed(array $booking): void
    {
        $detailsTable = EmailContentFormatter::detailsTable([
            'Appointment Date' => $booking['date'],
            'Appointment Time' => $booking['time'],
            'Estimated Duration' => $booking['total_duration_minutes'] . ' minutes',
            'Dogs' => $this->formatPets($booking['pets']),
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

    public function sendDeclined(array $booking, ?string $notes): void
    {
        $detailsTable = EmailContentFormatter::detailsTable([
            'Requested Date' => $booking['date'],
            'Requested Time' => $booking['time'],
            'Dogs' => $this->formatPets($booking['pets']),
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

    private function formatPets(array $pets): ?string
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
}
