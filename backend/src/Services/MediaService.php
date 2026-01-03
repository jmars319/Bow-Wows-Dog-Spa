<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;
use BowWowSpa\Support\Config;

final class MediaService
{
    private const ALLOWED_MIME = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
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
        $config = $this->resolveConfig();
        $this->ensureUploadStructure();
        $this->validateUpload($file, $config);

        $category = $this->normalizeCategory($payload['category'] ?? 'default');
        $altText = $payload['alt_text'] ?? null;
        $title = $payload['title'] ?? null;
        $caption = $payload['caption'] ?? null;

        $mime = $this->detectMime($file['tmp_name']);
        $extension = $this->extensionFromMime($mime);
        $hash = hash_file('sha1', $file['tmp_name']);
        $baseName = $hash;
        $originalFilename = $baseName . '.' . $extension;
        $paths = $this->pathConfig();

        $originalPath = $paths['originals_path'] . '/' . $originalFilename;
        if (!move_uploaded_file($file['tmp_name'], $originalPath)) {
            throw new \RuntimeException('Failed moving uploaded file.');
        }

        $this->normalizeOrientation($originalPath, $mime);
        [$width, $height] = getimagesize($originalPath);
        if (!$width || !$height) {
            unlink($originalPath);
            throw new \RuntimeException('Unable to read image dimensions.');
        }

        $variants = $this->generateVariants($originalPath, $mime, $category, $baseName, $width, $height, $config);
        $manifest = $this->writeManifest($baseName, $category, $mime, $width, $height, $originalFilename, $variants);

        $originalUrl = $paths['originals_url'] . '/' . $originalFilename;

        $id = Database::insert(
            'INSERT INTO media_assets (original_path, original_url, variants_json, mime_type, intrinsic_width, intrinsic_height, category, title, caption, alt_text, responsive_variants_json, manifest_path, optimized_srcset, webp_srcset, fallback_url, created_by, created_at) 
             VALUES (:path, :url, :variants, :mime, :width, :height, :category, :title, :caption, :alt, :responsive, :manifest, :opt_srcset, :webp_srcset, :fallback, :created_by, NOW())',
            [
                'path' => 'originals/' . $originalFilename,
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
    }

    public function delete(int $id): void
    {
        $asset = Database::fetch('SELECT * FROM media_assets WHERE id = :id', ['id' => $id]);
        if (!$asset) {
            return;
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

        $mime = $this->detectMime($file['tmp_name']);
        if (!in_array($mime, self::ALLOWED_MIME, true)) {
            throw new \RuntimeException('Unsupported file type.');
        }
    }

    private function detectMime(string $path): string
    {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $path) ?: 'application/octet-stream';
        finfo_close($finfo);
        return $mime;
    }

    private function extensionFromMime(string $mime): string
    {
        return match ($mime) {
            'image/png' => 'png',
            'image/gif' => 'gif',
            'image/webp' => 'webp',
            default => 'jpg',
        };
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

            imagedestroy($canvas);
        }

        imagedestroy($source);

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
            'originals_path' => $basePath . '/originals',
            'optimized_path' => $basePath . '/variants/optimized',
            'webp_path' => $basePath . '/variants/webp',
            'manifests_path' => $basePath . '/manifests',
            'originals_url' => $prefix . '/originals',
            'optimized_url' => $prefix . '/variants/optimized',
            'webp_url' => $prefix . '/variants/webp',
        ];
    }

    private function ensureUploadStructure(): void
    {
        $paths = $this->pathConfig();
        foreach (['base_path', 'originals_path', 'optimized_path', 'webp_path', 'manifests_path'] as $key) {
            if (!is_dir($paths[$key])) {
                mkdir($paths[$key], 0775, true);
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
