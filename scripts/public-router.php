<?php

declare(strict_types=1);

$documentRoot = rtrim((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''), '/');
$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$normalizedPath = rtrim($requestPath, '/') ?: '/';
$existingFile = realpath($documentRoot . $requestPath);

if ($requestPath !== '/' && $existingFile && str_starts_with($existingFile, $documentRoot) && is_file($existingFile)) {
    return false;
}

if ($normalizedPath === '/preview' || $normalizedPath === '/current') {
    header('Location: /', true, 301);
    exit;
}

if ($normalizedPath === '/api/health') {
    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if (str_starts_with($normalizedPath, '/admin')) {
    $adminIndex = $documentRoot . '/admin/index.html';
    if (is_file($adminIndex)) {
        http_response_code(200);
        header('Content-Type: text/html; charset=utf-8');
        readfile($adminIndex);
        exit;
    }
}

require $documentRoot . '/index.php';
