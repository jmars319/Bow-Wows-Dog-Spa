<?php

declare(strict_types=1);

function bowwowPublicRequestPath(): string
{
    $uri = $_SERVER['REQUEST_URI'] ?? '/';
    $path = parse_url($uri, PHP_URL_PATH) ?: '/';

    return rtrim($path, '/') ?: '/';
}

function bowwowPublicStatusForPath(string $path): int
{
    return match ($path) {
        '/', '/privacy', '/terms' => 200,
        '/status/access-denied' => 403,
        '/status/not-found' => 404,
        '/status/server-error' => 500,
        '/status/maintenance' => 503,
        default => 404,
    };
}

function bowwowPublicBuildCandidates(string $rootDir): array
{
    return [
        $rootDir . '/index.html',
        $rootDir . '/frontend/public-app/dist/index.html',
    ];
}

function bowwowPublicErrorDocument(string $rootDir, int $status): string
{
    return $rootDir . '/error-documents/' . $status . '.html';
}

function bowwowSendHtmlFile(string $file, int $status, array $headers = []): never
{
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate');
    header('X-Content-Type-Options: nosniff');

    if ($status >= 400) {
        header('X-Robots-Tag: noindex, nofollow');
    }

    foreach ($headers as $name => $value) {
        header($name . ': ' . $value);
    }

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') {
        readfile($file);
    }

    exit;
}

function bowwowSendBuildMissing503(string $rootDir): never
{
    $errorDocument = bowwowPublicErrorDocument($rootDir, 503);
    if (is_file($errorDocument)) {
        bowwowSendHtmlFile($errorDocument, 503, ['Retry-After' => '3600']);
    }

    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate');
    header('X-Content-Type-Options: nosniff');
    header('X-Robots-Tag: noindex, nofollow');
    header('Retry-After: 3600');

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') {
        echo "Public site build not found.\nRun `npm run build` in frontend/public-app or use the Vite dev server.\n";
    }

    exit;
}

$rootDir = __DIR__;

if (is_file($rootDir . '/maintenance.flag')) {
    $errorDocument = bowwowPublicErrorDocument($rootDir, 503);
    if (is_file($errorDocument)) {
        bowwowSendHtmlFile($errorDocument, 503, ['Retry-After' => '3600']);
    }

    bowwowSendBuildMissing503($rootDir);
}

$status = bowwowPublicStatusForPath(bowwowPublicRequestPath());

foreach (bowwowPublicBuildCandidates($rootDir) as $candidate) {
    if (!is_file($candidate)) {
        continue;
    }

    $headers = $status === 503 ? ['Retry-After' => '3600'] : [];
    bowwowSendHtmlFile($candidate, $status, $headers);
}

bowwowSendBuildMissing503($rootDir);
