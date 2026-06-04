<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use BowWowSpa\Database\Database;
use BowWowSpa\Http\Response;
use BowWowSpa\Services\AuthService;
use BowWowSpa\Services\StorageService;
use BowWowSpa\Support\Config;
use Jamarq\CpanelBackend\System\SystemCheck;

final class AdminSystemController
{
    public function __construct(
        private readonly AuthService $auth = new AuthService(),
        private readonly StorageService $storage = new StorageService(),
    )
    {
    }

    public function diagnostics(): void
    {
        $this->auth->ensureSectionAccess('system');
        $paths = $this->pathChecks();
        $extensions = [
            'gd' => extension_loaded('gd'),
            'imagick' => extension_loaded('imagick'),
        ];
        $webpSupport = ($extensions['gd'] && function_exists('imagewebp')) || ($extensions['imagick'] && class_exists(\Imagick::class));

        $dbOk = true;
        try {
            Database::fetch('SELECT 1 as ok');
        } catch (\Throwable $e) {
            $dbOk = false;
        }

        $sendgridConfigured = (bool) (Config::get('sendgrid.api_key') && Config::get('sendgrid.from_email'));
        $storageDetails = $this->storage->systemStatus();
        $storageDetails['r2_env'] = [
            'R2_ENDPOINT',
            'R2_ACCESS_KEY_ID',
            'R2_SECRET_ACCESS_KEY',
            'R2_PUBLIC_BUCKET',
            'R2_PRIVATE_BUCKET',
            'R2_PUBLIC_BASE_URL',
        ];
        $storageReady = $this->storage->provider() === 'r2' && $this->storage->r2Configured();
        $googleReady = trim((string) Config::get('calendar_sync.google_client_id', '')) !== ''
            && trim((string) Config::get('calendar_sync.google_client_secret', '')) !== ''
            && trim((string) Config::get('calendar_sync.google_redirect_uri', '')) !== ''
            && trim((string) Config::get('calendar_sync.google_token_key', '')) !== '';
        $app = [
            'env' => Config::get('app.env'),
            'url' => Config::get('app.url'),
        ];
        $checks = [
            $this->check('api_health', 'API health', 'ok', 'The Bow Wow API is responding.', 'No action needed.'),
            $this->check('admin_auth', 'Admin login', 'ok', 'You are signed in and the protected admin route is working.', 'No action needed.'),
            $this->check(
                'production_env',
                'Production environment file',
                is_file(BOWWOW_APP_PATH . '/.env') ? 'ok' : 'warning',
                is_file(BOWWOW_APP_PATH . '/.env') ? 'The deployed API environment file is present.' : 'The API .env file is missing in this environment.',
                'The full-site deploy stages backend/.env.production as api/.env. Placeholder deploy does not use the full app backend.'
            ),
            $this->check('database', 'Database connection', $dbOk ? 'ok' : 'error', $dbOk ? 'The API can reach the Bow Wow database.' : 'The API could not reach the Bow Wow database.', 'Check api/.env database values and the cPanel database user.'),
            $this->check('webp_support', 'Image optimization support', $webpSupport ? 'ok' : 'warning', $webpSupport ? 'WebP image generation is available.' : 'WebP image generation is not available.', 'Enable GD WebP or Imagick in cPanel if the full app needs media uploads.'),
            $this->check('sendgrid_readiness', 'SendGrid readiness', $sendgridConfigured ? 'ok' : 'warning', $sendgridConfigured ? 'Email notification settings are configured.' : 'Email notification settings are incomplete or disabled.', 'Full-app booking/contact emails need SendGrid before launch. Placeholder deploy is unaffected.'),
            $this->check(
                'google_calendar_readiness',
                'Google Calendar readiness',
                $googleReady ? 'ok' : 'warning',
                $googleReady ? 'Google Calendar OAuth settings are configured.' : 'Google Calendar OAuth settings are incomplete.',
                $googleReady ? 'Connect the primary calendar from Calendar Sync before launch.' : 'Set the Google client id, client secret, redirect URI, and token encryption key before launch.',
                [
                    'required_env' => [
                        'GOOGLE_CALENDAR_CLIENT_ID',
                        'GOOGLE_CALENDAR_CLIENT_SECRET',
                        'GOOGLE_CALENDAR_REDIRECT_URI',
                        'GOOGLE_CALENDAR_TOKEN_KEY',
                    ],
                ]
            ),
            $this->check(
                'storage_provider',
                'Storage provider',
                $storageReady ? 'ok' : 'info',
                $storageReady ? 'Full-app uploads are configured for Cloudflare R2 with local fallback retained.' : 'R2 buckets and CDN are prepared. Placeholder production still does not use the full app media backend.',
                $storageReady ? 'Keep local uploads until manual full-app verification is complete.' : 'Set R2 env values only before the full app relaunch.',
                $storageDetails
            ),
        ];

        foreach ($paths as $key => $ok) {
            $checks[] = $this->check(
                $key,
                'Writable: ' . str_replace('_', ' ', $key),
                $ok ? 'ok' : 'warning',
                $ok ? 'This media folder is writable.' : 'This media folder is not writable.',
                'Adjust cPanel folder permissions before enabling full-app media uploads.'
            );
        }

        foreach ([
            'admin_users' => 'Admin user storage',
            'booking_requests' => 'Booking request storage',
            'contact_messages' => 'Contact message storage',
            'media_assets' => 'Media library records',
            'services' => 'Service content storage',
            'retail_items' => 'Retail/catalog storage',
        ] as $table => $label) {
            $checks[] = $this->tableCheck($table, $label);
        }

        Response::success([
            'success' => true,
            'checks' => $checks,
            'sections' => [
                ['id' => 'core', 'label' => 'Core Site', 'checks' => ['api_health', 'admin_auth', 'database', 'production_env']],
                ['id' => 'full_app', 'label' => 'Full App Storage', 'checks' => ['admin_users', 'booking_requests', 'contact_messages', 'services', 'retail_items']],
                ['id' => 'media', 'label' => 'Media Storage', 'checks' => ['media_assets', 'webp_support', 'upload_dir_writable', 'originals_writable', 'variants_optimized_writable', 'variants_webp_writable', 'manifests_writable', 'storage_provider']],
                ['id' => 'calendar', 'label' => 'Calendar Sync', 'checks' => ['google_calendar_readiness']],
                ['id' => 'email', 'label' => 'Email', 'checks' => ['sendgrid_readiness']],
            ],
            'php_version' => PHP_VERSION,
            'extensions' => $extensions,
            'webp_support' => $webpSupport,
            'paths_writable' => $paths,
            'db_ok' => $dbOk,
            'sendgrid_configured' => $sendgridConfigured,
            'app' => $app,
        ]);
    }

    private function pathChecks(): array
    {
        $uploadDir = rtrim(Config::get('media.upload_dir'), '/');
        $checks = [
            'upload_dir_writable' => is_writable($uploadDir),
            'originals_writable' => is_writable($uploadDir . '/originals'),
            'variants_optimized_writable' => is_writable($uploadDir . '/variants/optimized'),
            'variants_webp_writable' => is_writable($uploadDir . '/variants/webp'),
            'manifests_writable' => is_writable($uploadDir . '/manifests'),
        ];

        return $checks;
    }

    private function check(string $id, string $label, string $status, string $message, string $action = '', array $details = []): array
    {
        return (new SystemCheck($id, $label, $status, $message, $details, $action))->toArray();
    }

    private function tableCheck(string $table, string $label): array
    {
        try {
            $row = Database::fetch(
                'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1',
                [$table]
            );
            $exists = (bool) $row;
        } catch (\Throwable $e) {
            $exists = false;
        }

        return $this->check(
            $table,
            $label,
            $exists ? 'ok' : 'warning',
            $exists ? "{$label} is available." : "{$label} is not available in this database.",
            $exists ? 'No action needed.' : 'Run backend/db/master_schema.sql before relaunching the full app.'
        );
    }
}
