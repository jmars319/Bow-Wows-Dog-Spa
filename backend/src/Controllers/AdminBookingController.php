<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use BowWowSpa\Http\Request;
use BowWowSpa\Http\Response;
use BowWowSpa\Services\AuthService;
use BowWowSpa\Services\BookingAttachmentService;
use BowWowSpa\Services\BookingService;
use BowWowSpa\Services\BookingRequestAdminService;
use BowWowSpa\Services\BookingStatsService;
use BowWowSpa\Services\AuditService;

final class AdminBookingController
{
    public function __construct(
        private readonly AuthService $auth = new AuthService(),
        private readonly BookingService $bookings = new BookingService(),
        private readonly BookingStatsService $bookingStats = new BookingStatsService(),
        private readonly BookingRequestAdminService $bookingAdmin = new BookingRequestAdminService(),
        private readonly BookingAttachmentService $attachments = new BookingAttachmentService(),
        private readonly AuditService $audit = new AuditService(),
    ) {
    }

    public function index(Request $request): void
    {
        $this->auth->ensureSectionAccess('booking');
        $filters = $this->filtersFromRequest($request);
        Response::success([
            'items' => $this->bookings->list($filters),
            'stats' => $this->bookingStats->stats(),
        ]);
    }

    public function create(Request $request): void
    {
        $user = $this->auth->requireAuth();
        $this->auth->ensureSectionAccess('booking');

        try {
            $payload = $request->body;
            $isInternalTest = !empty($payload['is_internal_test']);
            $payload['is_internal_test'] = $isInternalTest ? 1 : 0;
            $payload['source'] = $isInternalTest ? 'admin_test' : ($payload['source'] ?? 'admin_manual');
            $booking = $this->bookings->createBooking($payload, $request->files);
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

    public function emailPreview(Request $request): void
    {
        $this->auth->ensureSectionAccess('booking');
        $id = (int) ($request->body['id'] ?? 0);
        $template = (string) ($request->body['template'] ?? $request->body['action'] ?? 'confirm');

        if ($id <= 0) {
            Response::error('validation_error', 'Booking id required', 422);
        }

        try {
            $preview = $this->bookingAdmin->previewCustomerEmail($id, $template, $request->body['notes'] ?? null);
        } catch (\Throwable $e) {
            Response::error('booking_error', $e->getMessage(), 422);
        }

        Response::success($preview);
    }

    public function export(Request $request): void
    {
        $this->auth->ensureSectionAccess('booking');

        try {
            $csv = $this->bookingAdmin->exportCsv($this->filtersFromRequest($request));
        } catch (\Throwable $e) {
            Response::error('booking_error', $e->getMessage(), 422);
        }

        $filename = 'bowwow-booking-requests-' . date('Ymd') . '.csv';
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('X-Content-Type-Options: nosniff');
        echo $csv;
        exit;
    }

    public function updateDetails(Request $request): void
    {
        $user = $this->auth->requireAuth();
        $this->auth->ensureSectionAccess('booking');
        $id = (int) ($request->body['id'] ?? 0);

        if (!$id) {
            Response::error('validation_error', 'Missing booking id', 422);
        }

        try {
            $result = $this->bookings->updateBookingDetails($id, $request->body, $user['id'], $this->audit);
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

        $attachment = $this->attachments->find($bookingId, $attachmentId);
        if ($attachment === null) {
            Response::error('not_found', 'Attachment not found', 404);
        }

        $path = $this->attachments->absolutePath($attachment);
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

    private function filtersFromRequest(Request $request): array
    {
        return [
            'status' => $request->query['status'] ?? null,
            'test' => $request->query['test'] ?? 'hide',
            'search' => $request->query['search'] ?? null,
            'date_from' => $request->query['date_from'] ?? null,
            'date_to' => $request->query['date_to'] ?? null,
        ];
    }
}
