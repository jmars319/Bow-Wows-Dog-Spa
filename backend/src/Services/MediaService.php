<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;
use BowWowSpa\Support\Config;
use BowWowSpa\Support\Input;

final class MediaService
{
    private const ALLOWED_MIME = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'text/plain',
        'text/csv',
        'application/csv',
        'application/msword',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip',
    ];

    private const BLOCKED_EXTENSIONS = [
        'app', 'bat', 'bin', 'cmd', 'com', 'dll', 'dmg', 'exe', 'html', 'htm',
        'iso', 'jar', 'js', 'mjs', 'php', 'phar', 'phtml', 'sh', 'svg', 'swf',
        'tar', 'gz', 'tgz', 'rar', '7z', 'zip',
    ];

    private const EXTENSION_MIME_MAP = [
        'jpg' => ['image/jpeg'],
        'jpeg' => ['image/jpeg'],
        'png' => ['image/png'],
        'gif' => ['image/gif'],
        'webp' => ['image/webp'],
        'pdf' => ['application/pdf'],
        'txt' => ['text/plain'],
        'csv' => ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'],
        'doc' => ['application/msword'],
        'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
        'xls' => ['application/vnd.ms-excel'],
        'xlsx' => ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
    ];

    public function list(?string $category = null): array
    {
        $sql = 'SELECT * FROM media_assets';
        $params = [];
        if ($category) {
            $sql .= ' WHERE category = :category';
            $params['category'] = $this->normalizeCategory($category);
        }
        $sql .= ' ORDER BY created_at DESC';
        $rows = Database::fetchAll($sql, $params);
        return array_map(fn ($row) => $this->hydrateRow($row), $rows);
    }

    public function upload(array $file, int $adminId, array $payload = []): array
    {
        try {
            $config = $this->resolveConfig();
            $this->ensureUploadStructure();
            $this->validateUpload($file, $config);

            $category = $this->normalizeCategory($payload['category'] ?? 'default');
            $altText = Input::clean($payload['alt_text'] ?? null, 255);
            $title = Input::clean($payload['title'] ?? null, 255);
            $caption = Input::clean($payload['caption'] ?? null, 4000, true);

            $detectedMime = $this->detectMime($file['tmp_name']);
            $this->validateExtensionAndMime($file['tmp_name'], (string) ($file['name'] ?? ''), $detectedMime);
            $mime = $this->normalizeDetectedMime($detectedMime, (string) ($file['name'] ?? ''));
            $extension = $this->extensionFromMime($mime, (string) ($file['name'] ?? ''));
            $assetType = $this->assetTypeForMime($mime, (string) ($file['name'] ?? ''));
            $hash = hash_file('sha1', $file['tmp_name']);
            $baseName = $this->buildBaseName($category, (string) ($file['name'] ?? 'upload'), $hash);
            $paths = $this->pathConfig();
            $originalFilename = $this->uniqueFilename(
                $assetType === 'image' ? $paths['originals_path'] : $paths['attachments_path'],
                $baseName . '-original.' . $extension
            );

            $originalPath = ($assetType === 'image' ? $paths['originals_path'] : $paths['attachments_path']) . '/' . $originalFilename;
            if (!move_uploaded_file($file['tmp_name'], $originalPath)) {
                throw new \RuntimeException('Failed moving uploaded file.');
            }

            $width = null;
            $height = null;
            $variants = ['optimized' => [], 'webp' => []];
            $manifest = [
                'path' => null,
                'variants' => $variants,
                'srcset' => ['optimized' => null, 'webp' => null],
            ];
            $originalUrl = ($assetType === 'image' ? $paths['originals_url'] : $paths['attachments_url']) . '/' . $originalFilename;
            $originalStoredPath = ($assetType === 'image' ? 'originals/' : 'attachments/') . $originalFilename;

            if ($assetType === 'image') {
                $this->normalizeOrientation($originalPath, $mime);
                [$width, $height] = getimagesize($originalPath);
                if (!$width || !$height) {
                    unlink($originalPath);
                    throw new \RuntimeException('Unable to read image dimensions.');
                }

                $variants = $this->generateVariants($originalPath, $mime, $category, $baseName, $width, $height, $config);
                $manifest = $this->writeManifest($baseName, $category, $mime, $width, $height, $originalFilename, $variants);
            }

            $id = Database::insert(
                'INSERT INTO media_assets (original_path, original_url, variants_json, mime_type, intrinsic_width, intrinsic_height, category, title, caption, alt_text, responsive_variants_json, manifest_path, optimized_srcset, webp_srcset, fallback_url, created_by, created_at) 
                 VALUES (:path, :url, :variants, :mime, :width, :height, :category, :title, :caption, :alt, :responsive, :manifest, :opt_srcset, :webp_srcset, :fallback, :created_by, NOW())',
                [
                    'path' => $originalStoredPath,
                    'url' => $originalUrl,
                    'variants' => json_encode($variants),
                    'mime' => $mime,
                    'width' => $width,
                    'height' => $height,
                    'category' => $category,
                    'title' => $title,
                    'caption' => $caption,
                    'alt' => $altText,
                    'responsive' => json_encode($manifest['variants']),
                    'manifest' => $manifest['path'],
                    'opt_srcset' => $manifest['srcset']['optimized'] ?? null,
                    'webp_srcset' => $manifest['srcset']['webp'] ?? null,
                    'fallback' => $originalUrl,
                    'created_by' => $adminId,
                ]
            );

            $row = Database::fetch('SELECT * FROM media_assets WHERE id = :id', ['id' => $id]);
            return $this->hydrateRow($row ?? []);
        } catch (\Throwable $e) {
            error_log('[BowWow][media_upload_failed] ' . $e->getMessage());
            throw $e;
        }
    }

    public function delete(int $id): void
    {
        $asset = Database::fetch('SELECT * FROM media_assets WHERE id = :id', ['id' => $id]);
        if (!$asset) {
            return;
        }

        $usages = $this->findUsages($id);
        if ($usages !== []) {
            throw new \RuntimeException(
                'This image is still being used by ' . implode(', ', $usages) . '. Replace it there before deleting it.'
            );
        }

        $paths = $this->pathConfig();
        $toDelete = [];

        $variantData = null;
        if (!empty($asset['manifest_path'])) {
            $manifestFile = $paths['base_path'] . '/' . ltrim($asset['manifest_path'], '/');
            $manifest = $this->safeLoadManifest($manifestFile);
            if ($manifest) {
                $variantData = $manifest['variants'] ?? null;
            }
            $toDelete[] = $manifestFile;
        }

        if (!$variantData) {
            $variantData = json_decode($asset['responsive_variants_json'] ?? '[]', true) ?? [];
        }

        foreach (['optimized', 'webp'] as $type) {
            foreach ($variantData[$type] ?? [] as $variant) {
                $toDelete[] = $paths['base_path'] . '/' . ltrim($variant['path'], '/');
            }
        }

        $toDelete[] = $paths['base_path'] . '/' . ltrim($asset['original_path'], '/');

        foreach ($toDelete as $file) {
            if (is_file($file)) {
                @unlink($file);
            }
        }

        Database::run('DELETE FROM media_assets WHERE id = :id', ['id' => $id]);
    }

    public function find(int $id): ?array
    {
        $row = Database::fetch('SELECT * FROM media_assets WHERE id = :id', ['id' => $id]);
        return $row ? $this->hydrateRow($row) : null;
    }

    private function hydrateRow(array $row): array
    {
        if (!$row) {
            return [];
        }

        $manifest = [];
        if (!empty($row['manifest_path'])) {
            $paths = $this->pathConfig();
            $manifestFile = $paths['base_path'] . '/' . ltrim($row['manifest_path'], '/');
            $manifest = $this->safeLoadManifest($manifestFile) ?: [];
        }

        $variants = $manifest['variants'] ?? json_decode($row['responsive_variants_json'] ?? '[]', true) ?? [];
        $optimizedSrcset = $manifest['srcset']['optimized'] ?? $row['optimized_srcset'];
        $webpSrcset = $manifest['srcset']['webp'] ?? $row['webp_srcset'];

        return [
            'id' => (int) $row['id'],
            'original_path' => $row['original_path'],
            'original_url' => $row['original_url'],
            'category' => $row['category'],
            'mime_type' => $row['mime_type'],
            'asset_type' => $this->assetTypeForMime($row['mime_type'] ?? '', $row['original_path'] ?? ''),
            'storage_provider' => 'local',
            'storage_key' => $row['original_path'],
            'download_url' => $this->assetTypeForMime($row['mime_type'] ?? '', $row['original_path'] ?? '') === 'image' ? null : $row['original_url'],
            'is_image' => $this->assetTypeForMime($row['mime_type'] ?? '', $row['original_path'] ?? '') === 'image',
            'intrinsic_width' => $row['intrinsic_width'],
            'intrinsic_height' => $row['intrinsic_height'],
            'title' => $row['title'],
            'caption' => $row['caption'],
            'alt_text' => $row['alt_text'],
            'responsive_variants' => $variants,
            'manifest_path' => $row['manifest_path'],
            'optimized_srcset' => $optimizedSrcset,
            'webp_srcset' => $webpSrcset,
            'fallback_url' => $row['fallback_url'] ?? $row['original_url'],
            'created_at' => $row['created_at'],
        ];
    }

    private function findUsages(int $mediaId): array
    {
        $usages = [];

        $retail = Database::fetch(
            'SELECT COUNT(*) AS total
             FROM retail_items
             WHERE media_id = :media_id',
            ['media_id' => $mediaId]
        );
        $retailTotal = (int) ($retail['total'] ?? 0);
        if ($retailTotal > 0) {
            $usages[] = $retailTotal . ' product' . ($retailTotal === 1 ? '' : 's');
        }

        $gallery = Database::fetch(
            'SELECT COUNT(*) AS total
             FROM gallery_items
             WHERE primary_media_id = :media_id OR secondary_media_id = :media_id',
            ['media_id' => $mediaId]
        );
        $galleryTotal = (int) ($gallery['total'] ?? 0);
        if ($galleryTotal > 0) {
            $usages[] = $galleryTotal . ' gallery item' . ($galleryTotal === 1 ? '' : 's');
        }

        $legacyGallery = Database::fetch(
            'SELECT COUNT(*) AS total
             FROM happy_clients
             WHERE before_media_id = :media_id OR after_media_id = :media_id',
            ['media_id' => $mediaId]
        );
        $legacyTotal = (int) ($legacyGallery['total'] ?? 0);
        if ($legacyTotal > 0) {
            $usages[] = $legacyTotal . ' legacy gallery item' . ($legacyTotal === 1 ? '' : 's');
        }

        $hero = Database::fetch(
            'SELECT COUNT(*) AS total
             FROM content_blocks
             WHERE `key` = "hero"
               AND JSON_UNQUOTE(JSON_EXTRACT(content_json, "$.media_id")) = :media_id',
            ['media_id' => (string) $mediaId]
        );
        $heroTotal = (int) ($hero['total'] ?? 0);
        if ($heroTotal > 0) {
            $usages[] = 'the hero section';
        }

        return $usages;
    }

    private function validateUpload(array $file, array $config): void
    {
        if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
            throw new \RuntimeException('Upload error.');
        }

        if (($file['size'] ?? 0) <= 0) {
            throw new \RuntimeException('Empty upload.');
        }

        if ($file['size'] > $config['max_bytes']) {
            throw new \RuntimeException('File exceeds allowed size.');
        }

        $tmpName = (string) ($file['tmp_name'] ?? '');
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            throw new \RuntimeException('Uploaded file could not be verified.');
        }

        $mime = $this->detectMime($file['tmp_name']);
        if (!in_array($mime, self::ALLOWED_MIME, true)) {
            throw new \RuntimeException('Unsupported file type.');
        }
    }

    private function detectMime(string $path): string
    {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $path) ?: 'application/octet-stream';
        if (PHP_VERSION_ID < 80500) {
            finfo_close($finfo);
        }
        return $mime;
    }

    private function extensionFromMime(string $mime, string $originalName = ''): string
    {
        return match ($mime) {
            'image/png' => 'png',
            'image/gif' => 'gif',
            'image/webp' => 'webp',
            'application/pdf' => 'pdf',
            'text/csv', 'application/csv' => 'csv',
            'text/plain' => strtolower(pathinfo($originalName, PATHINFO_EXTENSION)) === 'csv' ? 'csv' : 'txt',
            'application/msword' => 'doc',
            'application/vnd.ms-excel' => strtolower(pathinfo($originalName, PATHINFO_EXTENSION)) === 'csv' ? 'csv' : 'xls',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
            default => 'jpg',
        };
    }

    private function extensionForOriginalName(string $originalName): string
    {
        return strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    }

    private function validateExtensionAndMime(string $path, string $originalName, string $mime): void
    {
        $extension = $this->extensionForOriginalName($originalName);
        if ($extension === '') {
            throw new \RuntimeException('Uploaded file needs a valid extension.');
        }
        if (in_array($extension, self::BLOCKED_EXTENSIONS, true)) {
            throw new \RuntimeException('File type not allowed.');
        }
        if (!isset(self::EXTENSION_MIME_MAP[$extension])) {
            throw new \RuntimeException('File type not allowed.');
        }
        if (!in_array($mime, self::EXTENSION_MIME_MAP[$extension], true)) {
            throw new \RuntimeException('File extension does not match the file type.');
        }
        if ($mime === 'application/zip' && in_array($extension, ['docx', 'xlsx'], true) && !$this->isOfficeOpenXml($path, $extension)) {
            throw new \RuntimeException('Office document could not be verified.');
        }
    }

    private function isOfficeOpenXml(string $path, string $extension): bool
    {
        if (!class_exists(\ZipArchive::class)) {
            return true;
        }
        $zip = new \ZipArchive();
        if ($zip->open($path) !== true) {
            return false;
        }
        $hasContentTypes = $zip->locateName('[Content_Types].xml') !== false;
        $hasOfficeRoot = $extension === 'docx'
            ? $zip->locateName('word/document.xml') !== false
            : $zip->locateName('xl/workbook.xml') !== false;
        $zip->close();
        return $hasContentTypes && $hasOfficeRoot;
    }

    private function normalizeDetectedMime(string $mime, string $originalName): string
    {
        $extension = $this->extensionForOriginalName($originalName);
        if ($mime === 'application/zip') {
            if ($extension === 'docx') {
                return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            }
            if ($extension === 'xlsx') {
                return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            }
        }
        return $mime;
    }

    private function assetTypeForMime(string $mime, string $name = ''): string
    {
        if (str_starts_with($mime, 'image/')) {
            return 'image';
        }
        $extension = $this->extensionForOriginalName($name);
        if (in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true)) {
            return 'image';
        }
        if (in_array($extension, ['csv', 'xls', 'xlsx'], true)) {
            return 'spreadsheet';
        }
        if ($extension === 'txt') {
            return 'text';
        }
        return 'document';
    }

    private function slugify(string $value, string $fallback = 'asset'): string
    {
        $slug = strtolower(trim($value));
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?: '';
        $slug = trim($slug, '-');
        return $slug === '' ? $fallback : substr($slug, 0, 80);
    }

    private function buildBaseName(string $category, string $originalName, string $hash): string
    {
        return sprintf(
            '%s-%s-%s',
            $this->slugify($category, 'media'),
            $this->slugify(pathinfo($originalName, PATHINFO_FILENAME), 'upload'),
            substr($hash, 0, 10)
        );
    }

    private function uniqueFilename(string $directory, string $filename): string
    {
        $candidate = $filename;
        $extension = pathinfo($filename, PATHINFO_EXTENSION);
        $base = pathinfo($filename, PATHINFO_FILENAME);
        $i = 2;
        while (is_file(rtrim($directory, '/') . '/' . $candidate)) {
            $candidate = $base . '-' . $i . ($extension ? '.' . $extension : '');
            $i++;
        }
        return $candidate;
    }

    private function generateVariants(
        string $originalPath,
        string $mime,
        string $category,
        string $baseName,
        int $width,
        int $height,
        array $config
    ): array {
        if (!extension_loaded('gd')) {
            return [
                'optimized' => [],
                'webp' => [],
            ];
        }

        $source = imagecreatefromstring((string) file_get_contents($originalPath));
        if (!$source) {
            throw new \RuntimeException('Unable to process image.');
        }

        $hasAlpha = $this->imageHasAlpha($mime, $source);
        $optimizedExtension = $hasAlpha ? 'png' : 'jpg';
        $optimizedVariants = [];
        $webpVariants = [];
        $paths = $this->pathConfig();
        $widths = $this->widthProfile($category, $config);
        $ratio = $height / $width;

        $generated = [];
        foreach ($widths as $targetWidth) {
            if ($targetWidth >= $width) {
                $targetWidth = $width;
            }
            if (in_array($targetWidth, $generated, true)) {
                continue;
            }
            $generated[] = $targetWidth;
            $targetHeight = max(1, (int) round($targetWidth * $ratio));
            $canvas = imagecreatetruecolor($targetWidth, $targetHeight);

            if ($hasAlpha) {
                imagealphablending($canvas, false);
                imagesavealpha($canvas, true);
            }

            imagecopyresampled($canvas, $source, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height);

            $optimizedName = sprintf('%s-w%s.%s', $baseName, $targetWidth, $optimizedExtension);
            $optimizedPath = $paths['optimized_path'] . '/' . $optimizedName;
            if ($optimizedExtension === 'png') {
                imagepng($canvas, $optimizedPath, max(0, min(9, (int) $config['png_compression'])));
            } else {
                imagejpeg($canvas, $optimizedPath, max(0, min(100, (int) $config['jpeg_quality'])));
            }

            $optimizedVariants[] = [
                'width' => $targetWidth,
                'height' => $targetHeight,
                'path' => 'variants/optimized/' . $optimizedName,
                'url' => $paths['optimized_url'] . '/' . $optimizedName,
            ];

            if (function_exists('imagewebp')) {
                $webpName = sprintf('%s-w%s.webp', $baseName, $targetWidth);
                $webpPath = $paths['webp_path'] . '/' . $webpName;
                if (@imagewebp($canvas, $webpPath, max(0, min(100, (int) $config['webp_quality'])))) {
                    $webpVariants[] = [
                        'width' => $targetWidth,
                        'height' => $targetHeight,
                        'path' => 'variants/webp/' . $webpName,
                        'url' => $paths['webp_url'] . '/' . $webpName,
                    ];
                }
            }

            if (PHP_VERSION_ID < 80000) {
                imagedestroy($canvas);
            }
        }

        if (PHP_VERSION_ID < 80000) {
            imagedestroy($source);
        }

        return [
            'optimized' => $optimizedVariants,
            'webp' => $webpVariants,
        ];
    }

    private function writeManifest(string $baseName, string $category, string $mime, int $width, int $height, string $filename, array $variants): array
    {
        $paths = $this->pathConfig();
        $manifest = [
            'category' => $category,
            'original' => [
                'path' => 'originals/' . $filename,
                'url' => $paths['originals_url'] . '/' . $filename,
                'width' => $width,
                'height' => $height,
                'mime' => $mime,
            ],
            'variants' => $variants,
            'srcset' => [
                'optimized' => $this->buildSrcset($variants['optimized'] ?? []),
                'webp' => $this->buildSrcset($variants['webp'] ?? []),
            ],
        ];

        $manifestPath = 'manifests/' . $baseName . '.json';
        $manifestFullPath = $paths['manifests_path'] . '/' . $baseName . '.json';
        if (file_put_contents($manifestFullPath, json_encode($manifest, JSON_PRETTY_PRINT)) === false) {
            throw new \RuntimeException('Unable to write manifest.');
        }

        return [
            'path' => $manifestPath,
            'variants' => $manifest['variants'],
            'srcset' => $manifest['srcset'],
        ];
    }

    private function buildSrcset(array $variants): ?string
    {
        if (empty($variants)) {
            return null;
        }

        $parts = [];
        foreach ($variants as $variant) {
            $parts[] = $variant['url'] . ' ' . $variant['width'] . 'w';
        }

        return implode(', ', $parts);
    }

    private function normalizeOrientation(string $path, string $mime): void
    {
        if ($mime !== 'image/jpeg' || !function_exists('exif_read_data') || !extension_loaded('gd')) {
            return;
        }

        $exif = @exif_read_data($path);
        if (!$exif || empty($exif['Orientation'])) {
            return;
        }

        $image = imagecreatefromjpeg($path);
        $orientation = (int) $exif['Orientation'];

        switch ($orientation) {
            case 3:
                $image = imagerotate($image, 180, 0);
                break;
            case 6:
                $image = imagerotate($image, -90, 0);
                break;
            case 8:
                $image = imagerotate($image, 90, 0);
                break;
            default:
                return;
        }

        imagejpeg($image, $path, 95);
        imagedestroy($image);
    }

    private function imageHasAlpha(string $mime, \GdImage $image): bool
    {
        if (in_array($mime, ['image/png', 'image/gif'], true)) {
            return true;
        }
        $width = imagesx($image);
        $height = imagesy($image);
        for ($x = 0; $x < $width; $x++) {
            for ($y = 0; $y < $height; $y++) {
                $color = imagecolorat($image, $x, $y);
                if ((($color & 0x7F000000) >> 24) > 0) {
                    return true;
                }
            }
        }

        return false;
    }

    private function resolveConfig(): array
    {
        $config = Config::get('media', []);
        $config['max_bytes'] = $config['max_bytes'] ?? (8 * 1024 * 1024);
        $config['width_profiles'] = $config['width_profiles'] ?: ['default' => [480, 960, 1440]];
        return $config;
    }

    private function widthProfile(string $category, array $config): array
    {
        $profiles = $config['width_profiles'] ?? [];
        $candidate = $profiles[$category] ?? $profiles['default'] ?? [480, 960, 1440];
        if (!is_array($candidate)) {
            $candidate = [$candidate];
        }
        $candidate = array_values(array_unique(array_map('intval', $candidate)));
        sort($candidate);

        if (count($candidate) < 3) {
            $last = end($candidate);
            while (count($candidate) < 3) {
                $last += 200;
                $candidate[] = $last;
            }
        }

        return $candidate;
    }

    private function pathConfig(): array
    {
        $uploadDir = Config::get('media.upload_dir') ?: (BOWWOW_APP_PATH . '/uploads');
        $basePath = rtrim($uploadDir, '/');
        $prefix = rtrim(Config::get('media.public_url_prefix', '/uploads'), '/');

        return [
            'base_path' => $basePath,
            'attachments_path' => $basePath . '/attachments',
            'originals_path' => $basePath . '/originals',
            'optimized_path' => $basePath . '/variants/optimized',
            'webp_path' => $basePath . '/variants/webp',
            'manifests_path' => $basePath . '/manifests',
            'attachments_url' => $prefix . '/attachments',
            'originals_url' => $prefix . '/originals',
            'optimized_url' => $prefix . '/variants/optimized',
            'webp_url' => $prefix . '/variants/webp',
        ];
    }

    private function ensureUploadStructure(): void
    {
        $paths = $this->pathConfig();
        foreach (['base_path', 'attachments_path', 'originals_path', 'optimized_path', 'webp_path', 'manifests_path'] as $key) {
            if (!is_dir($paths[$key]) && !mkdir($paths[$key], 0775, true) && !is_dir($paths[$key])) {
                throw new \RuntimeException('Unable to prepare media upload directories.');
            }
        }
    }

    private function safeLoadManifest(string $path): ?array
    {
        if (!is_file($path)) {
            return null;
        }

        $contents = file_get_contents($path);
        return $contents ? json_decode($contents, true) : null;
    }

    private function normalizeCategory(string $category): string
    {
        $slug = preg_replace('/[^a-z0-9_\-]/i', '', strtolower($category));
        return $slug ?: 'default';
    }
}
