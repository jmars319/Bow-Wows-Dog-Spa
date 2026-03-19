<?php

declare(strict_types=1);

$candidates = [
    __DIR__ . '/index.html',
    __DIR__ . '/frontend/public-app/dist/index.html',
];

foreach ($candidates as $candidate) {
    if (!is_file($candidate)) {
        continue;
    }

    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate');

    if ($_SERVER['REQUEST_METHOD'] !== 'HEAD') {
        readfile($candidate);
    }
    exit;
}

http_response_code(503);
header('Content-Type: text/plain; charset=utf-8');
echo "Public site build not found.\nRun `npm run build` in frontend/public-app or use the Vite dev server.\n";
