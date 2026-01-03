<?php

declare(strict_types=1);

use BowWowSpa\Services\PreviewGateService;

$backendPath = resolveBackendDir();
$bootstrapPath = $backendPath . '/bootstrap/app.php';
if (is_file($bootstrapPath)) {
    require_once $bootstrapPath;
}

$gate = new PreviewGateService();

if ($gate->isEnabled() && !$gate->hasAccess()) {
    header('Location: /preview', true, 302);
    exit;
}

function resolveBackendDir(): string
{
    $base = dirname(__DIR__);
    $paths = [
        $base . '/backend',
        $base . '/api',
    ];

    foreach ($paths as $dir) {
        if (is_dir($dir)) {
            return $dir;
        }
    }

    return $base . '/backend';
}

$relative = (string) ($_GET['path'] ?? '');
$response = serveFile($relative);

if (!$response) {
    http_response_code(404);
    echo 'File not found';
}

function serveFile(string $relative): bool
{
    $base = realpath(__DIR__);
    if ($base === false) {
        return false;
    }

    $target = trim($relative, '/');
    if ($target === '' || $target === 'index.php') {
        $target = 'index.html';
    }

    $fullPath = realpath($base . '/' . $target);

    if (!$fullPath || strncmp($fullPath, $base, strlen($base)) !== 0) {
        return false;
    }

    if (is_dir($fullPath)) {
        $index = $fullPath . '/index.html';
        if (!is_file($index)) {
            return false;
        }
        $fullPath = $index;
    }

    if (!is_file($fullPath)) {
        return false;
    }

    $mime = mime_content_type($fullPath) ?: 'application/octet-stream';
    header('Content-Type: ' . $mime);
    header('Cache-Control: public, max-age=300');

    if ($_SERVER['REQUEST_METHOD'] !== 'HEAD') {
        readfile($fullPath);
    }

    return true;
}
