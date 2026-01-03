#!/usr/bin/env php
<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$sourceDir = $root . '/frontend/public-app/src/assets/logos';
$placeholderDir = $root . '/placeholder/assets';
$files = glob($sourceDir . '/*.png');

if (!$files) {
    fwrite(STDERR, "No PNG logos found in {$sourceDir}\n");
    exit(1);
}

foreach ($files as $file) {
    $basename = pathinfo($file, PATHINFO_FILENAME);
    $webpPath = $sourceDir . '/' . $basename . '.webp';
    convertToWebp($file, $webpPath);
    copy($webpPath, $placeholderDir . '/' . basename($webpPath));
    copy($file, $placeholderDir . '/' . basename($file));
    echo "Generated {$webpPath}\n";
}

function convertToWebp(string $source, string $destination): void
{
    if (!extension_loaded('gd') || !function_exists('imagewebp')) {
        throw new RuntimeException('GD extension with WebP support is required.');
    }

    $image = imagecreatefromstring((string) file_get_contents($source));
    if (!$image) {
        throw new RuntimeException("Unable to read {$source}");
    }

    imagepalettetotruecolor($image);
    imagealphablending($image, true);
    imagesavealpha($image, true);

    if (!imagewebp($image, $destination, 90)) {
        throw new RuntimeException("Unable to write {$destination}");
    }

    if (function_exists('imagedestroy')) {
        imagedestroy($image);
    }
}
