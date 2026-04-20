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
            $booking = $this->bookings->createBooking($request->body, $request->files);
            if (!empty($request->body['auto_confirm'])) {
                $booking = $this->bookings->transition($booking['id'], 'confirm', $request->body['notes'] ?? null, $user['id'], $this->audit);
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

    public function updateNotes(Request $request): void
    {
        $user = $this->auth->requireAuth();
        $this->auth->ensureSectionAccess('booking');
        $id = (int) ($request->body['id'] ?? 0);

        if (!$id) {
            Response::error('validation_error', 'Missing booking id', 422);
        }

        try {
            $result = $this->bookings->updateNotes($id, $request->body['notes'] ?? null, $user['id'], $this->audit);
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

        try {
            $result = $this->bookings->extendHold($id);
        } catch (\Throwable $e) {
            Response::error('booking_error', $e->getMessage(), 422);
        }

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

        try {
            $result = $this->bookings->releaseHold($id, $request->body['notes'] ?? null, $user['id'], $this->audit);
        } catch (\Throwable $e) {
            Response::error('booking_error', $e->getMessage(), 422);
        }

        Response::success($result);
    }

    public function attachment(Request $request): void
    {
        $this->auth->ensureSectionAccess('booking');
        $bookingId = (int) ($request->params['id'] ?? 0);
        $attachmentId = (int) ($request->params['attachmentId'] ?? 0);

        if ($bookingId <= 0 || $attachmentId <= 0) {
            Response::error('validation_error', 'Attachment id required', 422);
        }

        $attachment = $this->bookings->findAttachment($bookingId, $attachmentId);
        if ($attachment === null) {
            Response::error('not_found', 'Attachment not found', 404);
        }

        $path = $this->bookings->attachmentAbsolutePath($attachment);
        if (!is_file($path)) {
            Response::error('not_found', 'Attachment file missing', 404);
        }

        header('Content-Type: ' . ($attachment['mime_type'] ?: 'application/octet-stream'));
        header('Content-Length: ' . (string) filesize($path));
        header('X-Content-Type-Options: nosniff');
        header('Content-Disposition: attachment; filename="' . $this->asciiDownloadFilename((string) $attachment['original_name']) . '"; filename*=UTF-8\'\'' . rawurlencode((string) $attachment['original_name']));
        readfile($path);
        exit;
    }

    private function asciiDownloadFilename(string $name): string
    {
        $name = basename($name);
        $name = preg_replace('/[^A-Za-z0-9._-]/', '_', $name) ?? 'attachment';
        return $name !== '' ? $name : 'attachment';
    }
}
