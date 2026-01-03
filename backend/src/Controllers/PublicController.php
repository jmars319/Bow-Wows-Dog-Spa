<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use BowWowSpa\Http\Request;
use BowWowSpa\Http\Response;
use BowWowSpa\Services\SiteContentService;
use BowWowSpa\Services\ScheduleService;
use BowWowSpa\Services\BookingService;
use BowWowSpa\Services\ContactService;
use BowWowSpa\Services\EmailService;
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
        $date = $request->query['date'] ?? null;
        if (!$date) {
            Response::error('validation_error', 'Date is required', 422);
        }

        Response::success([
            'date' => $date,
            'availability' => $this->schedule->availabilityForDate($date),
        ]);
    }

    public function bookingHold(Request $request): void
    {
        $date = $request->body['date'] ?? null;
        $time = $request->body['time'] ?? null;
        if (!$date || !$time) {
            Response::error('validation_error', 'Date and time required', 422);
        }

        $holdMinutes = $this->schedule->holdMinutes();
        try {
            $token = $this->bookings->createHold($date, $time, $holdMinutes);
        } catch (\Throwable $e) {
            Response::error('hold_error', $e->getMessage(), 409);
        }

        Response::success([
            'hold_token' => $token,
            'expires_in_minutes' => $holdMinutes,
        ]);
    }

    public function bookingRequest(Request $request): void
    {
        $required = ['date', 'time', 'customer_name', 'phone', 'email'];
        foreach ($required as $field) {
            if (empty($request->body[$field])) {
                Response::error('validation_error', 'Missing field: ' . $field, 422);
            }
        }

        try {
            $result = $this->bookings->createBooking($request->body);
        } catch (\Throwable $e) {
            Response::error('booking_unavailable', $e->getMessage(), 409);
        }

        $detailsTable = EmailContentFormatter::detailsTable([
            'Preferred Date' => $request->body['date'],
            'Preferred Time' => $request->body['time'],
            'Customer' => $request->body['customer_name'],
            'Phone' => $request->body['phone'],
            'Email' => $request->body['email'],
            'Dog' => $request->body['dog_name'] ?? null,
            'Services' => EmailContentFormatter::formatServices($request->body['services'] ?? []),
            'Notes' => $request->body['dog_notes'] ?? null,
        ]);

        $summary = '<p>A new booking request has been submitted.</p>' . $detailsTable;

        $this->emails->notifyStaff('New booking request', $summary);
        if (Config::get('sendgrid.send_customer_receipts', true)) {
            $customerBody = '<p>Hi ' . htmlspecialchars($request->body['customer_name'], ENT_QUOTES, 'UTF-8') . ',</p>'
                . '<p>Thanks for requesting an appointment with Bow Wow\'s Dog Spa. Your preferred time is on hold while our schedulers review it.</p>'
                . $detailsTable
                . '<p style="margin-top:16px;">We\'ll confirm or follow up soon. Need adjustments? Call (336) 555-9663 or reply to this email.</p>';

            $this->emails->send(
                $request->body['email'],
                $request->body['customer_name'],
                'We received your request',
                $customerBody,
                [
                    'variant' => 'customer',
                    'headline' => 'We received your appointment request',
                ]
            );
        }

        Response::success([
            'booking' => $result,
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

        $this->contacts->handle($request->body);
        Response::success(['received' => true]);
    }
}
