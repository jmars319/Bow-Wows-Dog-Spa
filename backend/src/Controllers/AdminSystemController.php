<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use BowWowSpa\Database\Database;
use BowWowSpa\Http\Response;
use BowWowSpa\Services\AuthService;
use BowWowSpa\Support\Config;

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
        $app = [
            'env' => Config::get('app.env'),
            'url' => Config::get('app.url'),
        ];

        Response::success([
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
}
