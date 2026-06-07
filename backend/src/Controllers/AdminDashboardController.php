<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use BowWowSpa\Database\Database;
use BowWowSpa\Http\Response;
use BowWowSpa\Services\AuthService;
use BowWowSpa\Services\BookingStatsService;
use BowWowSpa\Services\AuditService;

final class AdminDashboardController
{
    public function __construct(
        private readonly AuthService $auth = new AuthService(),
        private readonly BookingStatsService $bookingStats = new BookingStatsService(),
        private readonly AuditService $audit = new AuditService(),
    ) {
    }

    public function overview(): void
    {
        $this->auth->requireAuth();
        $taskGroups = $this->taskGroups();
        Response::success([
            'stats' => $this->bookingStats->stats(),
            'tasks' => $this->flattenTasks($taskGroups),
            'task_groups' => $taskGroups,
            'content_completeness' => $this->contentCompleteness($taskGroups),
            'recent_activity' => $this->audit->recent(10),
        ]);
    }

    private function taskGroups(): array
    {
        $required = [];
        $optional = [];

        $visibleServices = $this->countRows('services', 'is_active = 1 AND duration_minutes > 0');
        $visibleServiceMissingDuration = $this->countRows('services', 'is_active = 1 AND duration_minutes <= 0');
        $required[] = $this->task(
            'services_ready',
            'Services are ready',
            $visibleServices > 0 && $visibleServiceMissingDuration === 0,
            $visibleServices > 0
                ? 'Active services have appointment durations and can appear in public booking.'
                : 'Add at least one visible service before launch.',
            '/admin/services',
            'warning'
        );

        $enabledSlots = (int) (Database::fetch(
            "SELECT COUNT(*) AS total FROM schedule_templates WHERE is_enabled = 1 AND JSON_LENGTH(times_json) > 0"
        )['total'] ?? 0);
        $required[] = $this->task(
            'schedule_ready',
            'Booking times are ready',
            $enabledSlots > 0,
            $enabledSlots > 0
                ? 'Public booking has visible appointment times.'
                : 'Add at least one enabled day with appointment times.',
            '/admin/schedule',
            'warning'
        );

        $calendar = Database::fetch(
            "SELECT COUNT(*) AS total,
                    SUM(CASE WHEN is_enabled = 1 AND connection_status = 'connected' THEN 1 ELSE 0 END) AS connected_total,
                    SUM(CASE WHEN is_primary_write_target = 1 AND is_enabled = 1 THEN 1 ELSE 0 END) AS primary_total,
                    SUM(CASE WHEN blocks_availability = 1 AND is_enabled = 1 AND connection_status = 'connected' THEN 1 ELSE 0 END) AS blocking_total
             FROM calendar_integrations"
        ) ?: [];
        $required[] = $this->task(
            'calendar_setup',
            'Google Calendar is connected',
            (int) ($calendar['connected_total'] ?? 0) > 0
                && (int) ($calendar['primary_total'] ?? 0) > 0
                && (int) ($calendar['blocking_total'] ?? 0) > 0,
            'Connect a primary calendar and at least one blocking calendar before public booking goes live.',
            '/admin/calendar-sync',
            'warning'
        );

        $contactRows = Database::fetchAll(
            "SELECT `key`, `value` FROM site_settings WHERE `key` IN ('phone', 'email', 'address', 'hours')"
        );
        $contact = [];
        foreach ($contactRows as $row) {
            $contact[$row['key']] = trim((string) $row['value']);
        }
        $required[] = $this->task(
            'contact_ready',
            'Contact and location are complete',
            !empty($contact['phone']) && !empty($contact['email']) && !empty($contact['address']) && !empty($contact['hours']),
            'Add phone, email, address, and business hours for customers.',
            '/admin/content',
            'warning'
        );

        $contentRows = Database::fetchAll("SELECT `key`, content_json FROM content_blocks");
        $content = [];
        foreach ($contentRows as $row) {
            $content[$row['key']] = json_decode((string) $row['content_json'], true) ?: [];
        }
        $hero = $content['hero'] ?? [];
        $required[] = $this->task(
            'hero_ready',
            'Homepage hero is ready',
            !empty($hero['headline']) && !empty($hero['media_id']),
            'Set a homepage headline and hero image.',
            '/admin/content',
            'warning'
        );

        $policyCount = count($content['policies']['items'] ?? []);
        $required[] = $this->task(
            'policies_ready',
            'Policies are published',
            $policyCount > 0,
            'Add the basic appointment and care policies before launch.',
            '/admin/content',
            'warning'
        );

        $pendingBookings = $this->countRows('booking_requests', 'status = :status AND is_internal_test = 0', ['status' => 'pending_confirmation']);
        if ($pendingBookings > 0) {
            $required[] = [
                'id' => 'pending_bookings',
                'label' => $pendingBookings . ' booking request' . ($pendingBookings === 1 ? '' : 's') . ' waiting for review',
                'message' => 'Confirm, decline, or update new appointment requests.',
                'href' => '/admin/booking',
                'tone' => 'warning',
                'done' => false,
            ];
        }

        $missingAlt = $this->countRows(
            'media_assets',
            "archived_at IS NULL AND mime_type LIKE 'image/%' AND (alt_text IS NULL OR TRIM(alt_text) = '')"
        );
        $optional[] = $this->task(
            'media_alt_text',
            'Public images have alt text',
            $missingAlt === 0,
            $missingAlt > 0
                ? $missingAlt . ' image' . ($missingAlt === 1 ? '' : 's') . ' still need simple descriptions.'
                : 'Images have public descriptions.',
            '/admin/media?health=missing_alt',
            'info'
        );

        $galleryCount = $this->countRows('gallery_items', 'is_published = 1');
        $optional[] = $this->task(
            'gallery_ready',
            'Gallery has visible photos',
            $galleryCount > 0,
            'Publish customer or trust-building photos when they are ready.',
            '/admin/gallery',
            'info'
        );

        $retailCount = $this->countRows('retail_items', 'is_active = 1');
        $optional[] = $this->task(
            'retail_ready',
            'Retail catalog has visible products',
            $retailCount > 0,
            'Add catalog-only products if Bow Wow wants this section at launch.',
            '/admin/retail',
            'info'
        );

        $faqCount = count($content['faq']['items'] ?? []);
        $optional[] = $this->task(
            'faq_ready',
            'FAQ has answers',
            $faqCount > 0,
            'Add common customer questions when the client is ready.',
            '/admin/content',
            'info'
        );

        return [
            [
                'id' => 'required',
                'label' => 'Required before launch',
                'tasks' => $required,
            ],
            [
                'id' => 'optional',
                'label' => 'Helpful polish',
                'tasks' => $optional,
            ],
        ];
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

    private function task(string $id, string $label, bool $done, string $message, string $href, string $tone): array
    {
        return [
            'id' => $id,
            'label' => $label,
            'message' => $message,
            'href' => $href,
            'tone' => $done ? 'success' : $tone,
            'done' => $done,
        ];
    }

    private function flattenTasks(array $groups): array
    {
        $tasks = [];
        foreach ($groups as $group) {
            foreach ($group['tasks'] ?? [] as $task) {
                if (empty($task['done'])) {
                    $tasks[] = $task;
                }
            }
        }

        return $tasks;
    }

    private function contentCompleteness(array $groups): array
    {
        $total = 0;
        $done = 0;
        foreach ($groups as $group) {
            foreach ($group['tasks'] ?? [] as $task) {
                $total++;
                if (!empty($task['done'])) {
                    $done++;
                }
            }
        }

        $score = $total > 0 ? (int) round(($done / $total) * 100) : 0;
        return [
            'score' => $score,
            'complete' => $done,
            'total' => $total,
            'label' => $score . '% launch content ready',
        ];
    }

    private function countRows(string $table, string $where, array $params = []): int
    {
        $row = Database::fetch("SELECT COUNT(*) AS total FROM {$table} WHERE {$where}", $params);
        return (int) ($row['total'] ?? 0);
    }
}
