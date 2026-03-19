<?php

declare(strict_types=1);

namespace BowWowSpa;

use BowWowSpa\Http\Request;
use BowWowSpa\Http\Response;
use BowWowSpa\Routing\Router;
use BowWowSpa\Support\Config;
use BowWowSpa\Controllers\PublicController;
use BowWowSpa\Controllers\AdminAuthController;
use BowWowSpa\Controllers\AdminBookingController;
use BowWowSpa\Controllers\AdminScheduleController;
use BowWowSpa\Controllers\AdminContentController;
use BowWowSpa\Controllers\AdminRetailController;
use BowWowSpa\Controllers\AdminMediaController;
use BowWowSpa\Controllers\AdminAuditController;
use BowWowSpa\Controllers\AdminUsersController;
use BowWowSpa\Controllers\AdminDashboardController;
use BowWowSpa\Controllers\AdminSystemController;
use BowWowSpa\Controllers\AdminServicesController;
use BowWowSpa\Controllers\AdminFeaturedReviewsController;
use BowWowSpa\Controllers\AdminGalleryController;
use BowWowSpa\Controllers\AdminContactMessagesController;

final class Application
{
    private Router $router;

    public function __construct()
    {
        $this->router = new Router();
        $this->registerRoutes();
    }

    public function run(): void
    {
        try {
            $request = Request::capture();
            $this->router->dispatch($request);
        } catch (\Throwable $e) {
            error_log('[BowWow][server_error] ' . $e->getMessage());
            $debug = (bool) Config::get('app.debug', false);
            $message = $debug ? $e->getMessage() : 'Unexpected server error.';
            Response::error('server_error', $message, 500);
        }
    }

    private function registerRoutes(): void
    {
        $this->router->add('GET', '/api/health', function (): void {
            Response::success();
        });

        $public = new PublicController();
        $this->router->add('GET', '/api/public/site', [$public, 'site']);
        $this->router->add('GET', '/api/public/schedule', [$public, 'schedule']);
        $this->router->add('POST', '/api/public/booking-hold', [$public, 'bookingHold']);
        $this->router->add('POST', '/api/public/booking-request', [$public, 'bookingRequest']);
        $this->router->add('POST', '/api/public/contact', [$public, 'contact']);

        $auth = new AdminAuthController();
        $this->router->add('POST', '/api/admin/login', [$auth, 'login']);
        $this->router->add('POST', '/api/admin/logout', [$auth, 'logout']);
        $this->router->add('GET', '/api/admin/me', [$auth, 'me']);

        $dashboard = new AdminDashboardController();
        $this->router->add('GET', '/api/admin/dashboard', [$dashboard, 'overview']);

        $booking = new AdminBookingController();
        $this->router->add('GET', '/api/admin/booking-requests', [$booking, 'index']);
        $this->router->add('POST', '/api/admin/booking-requests', [$booking, 'create']);
        $this->router->add('POST', '/api/admin/booking-requests/action', [$booking, 'transition']);
        $this->router->add('POST', '/api/admin/booking-requests/notes', [$booking, 'updateNotes']);
        $this->router->add('POST', '/api/admin/booking-requests/extend', [$booking, 'extendHold']);
        $this->router->add('POST', '/api/admin/booking-requests/release', [$booking, 'releaseHold']);
        $this->router->add('GET', '/api/admin/booking-requests/{id}/attachments/{attachmentId}', [$booking, 'attachment']);

        $schedule = new AdminScheduleController();
        $this->router->add('GET', '/api/admin/schedule/templates', [$schedule, 'templates']);
        $this->router->add('POST', '/api/admin/schedule/templates', [$schedule, 'saveTemplates']);
        $this->router->add('GET', '/api/admin/schedule/overrides', [$schedule, 'overrides']);
        $this->router->add('POST', '/api/admin/schedule/overrides', [$schedule, 'saveOverride']);
        $this->router->add('DELETE', '/api/admin/schedule/overrides/{id}', [$schedule, 'deleteOverride']);

        $content = new AdminContentController();
        $this->router->add('GET', '/api/admin/content/site', [$content, 'site']);
        $this->router->add('POST', '/api/admin/content/site', [$content, 'saveSite']);

        $services = new AdminServicesController();
        $this->router->add('GET', '/api/admin/services', [$services, 'index']);
        $this->router->add('POST', '/api/admin/services', [$services, 'save']);

        $reviews = new AdminFeaturedReviewsController();
        $this->router->add('GET', '/api/admin/reviews', [$reviews, 'index']);
        $this->router->add('POST', '/api/admin/reviews', [$reviews, 'save']);

        $gallery = new AdminGalleryController();
        $this->router->add('GET', '/api/admin/gallery-items', [$gallery, 'index']);
        $this->router->add('POST', '/api/admin/gallery-items', [$gallery, 'save']);

        $contacts = new AdminContactMessagesController();
        $this->router->add('GET', '/api/admin/contact-messages', [$contacts, 'index']);

        $retail = new AdminRetailController();
        $this->router->add('GET', '/api/admin/retail', [$retail, 'index']);
        $this->router->add('POST', '/api/admin/retail', [$retail, 'save']);

        $media = new AdminMediaController();
        $this->router->add('GET', '/api/admin/media', [$media, 'index']);
        $this->router->add('POST', '/api/admin/media', [$media, 'upload']);
        $this->router->add('DELETE', '/api/admin/media/{id}', [$media, 'delete']);

        $audit = new AdminAuditController();
        $this->router->add('GET', '/api/admin/audit-log', [$audit, 'index']);

        $users = new AdminUsersController();
        $this->router->add('GET', '/api/admin/users', [$users, 'index']);
        $this->router->add('POST', '/api/admin/users', [$users, 'save']);

        $system = new AdminSystemController();
        $this->router->add('GET', '/api/admin/system', [$system, 'diagnostics']);
    }
}
