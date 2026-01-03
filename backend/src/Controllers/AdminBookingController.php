<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use BowWowSpa\Http\Request;
use BowWowSpa\Http\Response;
use BowWowSpa\Services\AuthService;
use BowWowSpa\Services\BookingService;
use BowWowSpa\Services\AuditService;

final class AdminBookingController
{
    public function __construct(
        private readonly AuthService $auth = new AuthService(),
        private readonly BookingService $bookings = new BookingService(),
        private readonly AuditService $audit = new AuditService(),
    ) {
    }

    public function index(Request $request): void
    {
        $this->auth->ensureSectionAccess('booking');
        $status = $request->query['status'] ?? null;
        Response::success([
            'items' => $this->bookings->list(['status' => $status]),
            'stats' => $this->bookings->stats(),
        ]);
    }

    public function create(Request $request): void
    {
        $user = $this->auth->requireAuth();
        $this->auth->ensureSectionAccess('booking');

        try {
            $booking = $this->bookings->createBooking($request->body);
            if (!empty($request->body['auto_confirm'])) {
                $this->bookings->transition($booking['id'], 'confirm', $request->body['notes'] ?? null, $user['id'], $this->audit);
            }
        } catch (\Throwable $e) {
            Response::error('booking_error', $e->getMessage(), 422);
        }

        $this->audit->log($user['id'], 'booking_create', 'booking_requests', $booking['id'], []);
        Response::success($booking);
    }

    public function transition(Request $request): void
    {
        $user = $this->auth->requireAuth();
        $this->auth->ensureSectionAccess('booking');
        $id = (int) ($request->body['id'] ?? 0);
        $action = $request->body['action'] ?? null;

        if (!$id || !$action) {
            Response::error('validation_error', 'Missing booking id/action', 422);
        }

        try {
            $result = $this->bookings->transition($id, $action, $request->body['notes'] ?? null, $user['id'], $this->audit);
        } catch (\Throwable $e) {
            Response::error('booking_error', $e->getMessage(), 422);
        }

        Response::success($result);
    }

    public function extendHold(Request $request): void
    {
        $user = $this->auth->requireAuth();
        $this->auth->ensureSectionAccess('booking');
        $id = (int) ($request->body['id'] ?? 0);
        if (!$id) {
            Response::error('validation_error', 'Booking id required', 422);
        }
        $result = $this->bookings->extendHold($id);
        $this->audit->log($user['id'], 'booking_extend_hold', 'booking_requests', $id, []);
        Response::success($result);
    }

    public function releaseHold(Request $request): void
    {
        $user = $this->auth->requireAuth();
        $this->auth->ensureSectionAccess('booking');
        $id = (int) ($request->body['id'] ?? 0);
        if (!$id) {
            Response::error('validation_error', 'Booking id required', 422);
        }

        $result = $this->bookings->releaseHold($id, $request->body['notes'] ?? null, $user['id'], $this->audit);
        Response::success($result);
    }
}
