<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use BowWowSpa\Database\Database;
use BowWowSpa\Http\Response;
use BowWowSpa\Services\AuthService;
use BowWowSpa\Support\Config;
use Jamarq\CpanelBackend\Storage\StorageConfig;
use Jamarq\CpanelBackend\System\SystemCheck;

final class AdminSystemController
{
    public function __construct(private readonly AuthService $auth = new AuthService())
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
        $storageConfig = new StorageConfig($_ENV);
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
                'storage_provider',
                'Storage provider',
                'info',
                'Bow Wow full app uses local cPanel uploads. R2 remains a future migration.',
                'Do not preserve test storage for placeholder deployments. Revisit this before full-app relaunch.',
                $storageConfig->systemCheckDetails()
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
