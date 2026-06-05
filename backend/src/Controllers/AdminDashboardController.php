<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use BowWowSpa\Database\Database;
use BowWowSpa\Http\Response;
use BowWowSpa\Services\AuthService;
use BowWowSpa\Services\BookingService;
use BowWowSpa\Services\AuditService;

final class AdminDashboardController
{
    public function __construct(
        private readonly AuthService $auth = new AuthService(),
        private readonly BookingService $bookings = new BookingService(),
        private readonly AuditService $audit = new AuditService(),
    ) {
    }

    public function overview(): void
    {
        $this->auth->requireAuth();
        Response::success([
            'stats' => $this->bookings->stats(),
            'tasks' => $this->taskList(),
            'recent_activity' => $this->audit->recent(10),
        ]);
    }

    private function taskList(): array
    {
        $tasks = [];

        $pendingBookings = $this->countRows('booking_requests', 'status = :status', ['status' => 'pending_confirmation']);
        if ($pendingBookings > 0) {
            $tasks[] = [
                'id' => 'pending_bookings',
                'label' => $pendingBookings . ' booking request' . ($pendingBookings === 1 ? '' : 's') . ' waiting for review',
                'message' => 'Confirm, decline, or update new appointment requests.',
                'href' => '/admin/booking',
                'tone' => 'warning',
            ];
        }

        $calendar = Database::fetch(
            "SELECT COUNT(*) AS total,
                    SUM(CASE WHEN is_enabled = 1 AND connection_status = 'connected' THEN 1 ELSE 0 END) AS connected_total,
                    SUM(CASE WHEN is_primary_write_target = 1 THEN 1 ELSE 0 END) AS primary_total
             FROM calendar_integrations"
        ) ?: [];
        if ((int) ($calendar['connected_total'] ?? 0) === 0 || (int) ($calendar['primary_total'] ?? 0) === 0) {
            $tasks[] = [
                'id' => 'calendar_setup',
                'label' => 'Finish Google Calendar setup',
                'message' => 'Connect a primary calendar so public booking slots use real availability.',
                'href' => '/admin/calendar-sync',
                'tone' => 'info',
            ];
        }

        $missingAlt = $this->countRows(
            'media_assets',
            "archived_at IS NULL AND mime_type LIKE 'image/%' AND (alt_text IS NULL OR TRIM(alt_text) = '')"
        );
        if ($missingAlt > 0) {
            $tasks[] = [
                'id' => 'missing_alt',
                'label' => $missingAlt . ' image' . ($missingAlt === 1 ? '' : 's') . ' need alt text',
                'message' => 'Add simple descriptions so public images are easier to understand.',
                'href' => '/admin/media',
                'tone' => 'warning',
            ];
        }

        $galleryDrafts = $this->countRows('gallery_items', 'is_published = 0');
        if ($galleryDrafts > 0) {
            $tasks[] = [
                'id' => 'gallery_drafts',
                'label' => $galleryDrafts . ' gallery draft' . ($galleryDrafts === 1 ? '' : 's') . ' not published',
                'message' => 'Review captions and publish the photos you want customers to see.',
                'href' => '/admin/gallery',
                'tone' => 'info',
            ];
        }

        $hiddenServices = $this->countRows('services', 'is_active = 0');
        if ($hiddenServices > 0) {
            $tasks[] = [
                'id' => 'hidden_services',
                'label' => $hiddenServices . ' hidden service' . ($hiddenServices === 1 ? '' : 's'),
                'message' => 'Seasonal or paused services stay hidden from booking until you show them again.',
                'href' => '/admin/services',
                'tone' => 'info',
            ];
        }

        return $tasks;
    }

    private function countRows(string $table, string $where, array $params = []): int
    {
        $row = Database::fetch("SELECT COUNT(*) AS total FROM {$table} WHERE {$where}", $params);
        return (int) ($row['total'] ?? 0);
    }
}
