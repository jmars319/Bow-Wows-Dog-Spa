<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;
use BowWowSpa\Support\Config;
use BowWowSpa\Support\Input;

final class MediaService
{
    public function __construct(
        private readonly StorageService $storage = new StorageService(),
        private readonly MediaUploadValidator $uploadValidator = new MediaUploadValidator(),
    )
    {
    }

    public function list(?string $category = null, array $filters = []): array
    {
        $sql = 'SELECT * FROM media_assets';
        $params = [];
        $where = [];

        if ($category) {
            $where[] = 'category = :category';
            $params['category'] = $this->normalizeCategory($category);
        }

        $archived = strtolower((string) ($filters['archived'] ?? 'active'));
        if ($archived === 'archived') {
            $where[] = 'archived_at IS NOT NULL';
        } elseif ($archived !== 'all') {
            $where[] = 'archived_at IS NULL';
        }

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $where[] = '(title LIKE :search OR alt_text LIKE :search OR caption LIKE :search OR original_path LIKE :search OR original_url LIKE :search)';
            $params['search'] = '%' . $search . '%';
        }

        if ($where !== []) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }

        $sql .= ' ORDER BY created_at DESC';
        $rows = Database::fetchAll($sql, $params);
        $items = array_map(fn ($row) => $this->hydrateRow($row), $rows);

        $type = strtolower((string) ($filters['asset_type'] ?? 'all'));
        if ($type !== 'all' && $type !== '') {
            $items = array_values(array_filter(
                $items,
                static fn (array $item): bool => $type === 'image'
                    ? (bool) ($item['is_image'] ?? false)
                    : (string) ($item['asset_type'] ?? '') === $type
            ));
        }

        $inUse = strtolower((string) ($filters['in_use'] ?? 'all'));
        if ($inUse === 'yes' || $inUse === 'no') {
            $items = array_values(array_filter(
                $items,
                static fn (array $item): bool => $inUse === 'yes'
                    ? !empty($item['usage_labels'])
                    : empty($item['usage_labels'])
            ));
        }

        $health = strtolower((string) ($filters['health'] ?? 'all'));
        if ($health !== 'all' && $health !== '') {
            $items = array_values(array_filter(
                $items,
                static fn (array $item): bool => in_array($health, $item['diagnostic_codes'] ?? [], true)
            ));
        }

        return $items;
    }

    public function upload(array $file, int $adminId, array $payload = []): array
    {
        try {
            $config = $this->resolveConfig();
            $this->ensureUploadStructure();
            $this->uploadValidator->validateUpload($file, $config);

            $category = $this->normalizeCategory($payload['category'] ?? 'default');
            $altText = Input::clean($payload['alt_text'] ?? null, 255);
            $title = Input::clean($payload['title'] ?? null, 255);
            $caption = Input::clean($payload['caption'] ?? null, 4000, true);

            $detectedMime = $this->uploadValidator->detectMime($file['tmp_name']);
            $this->uploadValidator->validateExtensionAndMime($file['tmp_name'], (string) ($file['name'] ?? ''), $detectedMime);
            $mime = $this->uploadValidator->normalizeDetectedMime($detectedMime, (string) ($file['name'] ?? ''));
            $extension = $this->uploadValidator->extensionFromMime($mime, (string) ($file['name'] ?? ''));
            $assetType = $this->uploadValidator->assetTypeForMime($mime, (string) ($file['name'] ?? ''));
            $checksum = hash_file('sha256', $file['tmp_name']) ?: null;
            if ($assetType === 'image' && $checksum !== null) {
                $duplicate = $this->findDuplicateAsset($checksum);
                if ($duplicate !== null) {
                    if (!empty($duplicate['archived_at'])) {
                        $this->archive((int) $duplicate['id'], false);
                        $duplicate = Database::fetch('SELECT * FROM media_assets WHERE id = :id', ['id' => (int) $duplicate['id']]) ?: $duplicate;
                    }

                    $hydrated = $this->hydrateRow($duplicate);
                    $hydrated['was_duplicate'] = true;
                    $hydrated['duplicate_reused'] = true;
                    $hydrated['message'] = 'This image was already in the library, so we reused it.';
                    return $hydrated;
                }
            }

            $hash = hash_file('sha1', $file['tmp_name']);
            $baseName = $this->buildBaseName($category, (string) ($file['name'] ?? 'upload'), $hash);
            $paths = $this->pathConfig();
            $originalFilename = $this->uniqueFilename(
                $assetType === 'image' ? $paths['originals_path'] : $paths['attachments_path'],
                $baseName . '-original.' . $extension
            );

            $originalPath = ($assetType === 'image' ? $paths['originals_path'] : $paths['attachments_path']) . '/' . $originalFilename;
            if (!$this->storeUploadedFile($file['tmp_name'], $originalPath)) {
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
            $storageProvider = 'local';
            $storageBucket = null;
            $storageKey = $originalStoredPath;
            $checksum = $checksum ?? (hash_file('sha256', $originalPath) ?: null);

            if ($assetType === 'image') {
                $this->normalizeOrientation($originalPath, $mime);
                [$width, $height] = getimagesize($originalPath);
                if (!$width || !$height) {
                    unlink($originalPath);
                    throw new \RuntimeException('Unable to read image dimensions.');
                }

                $variants = $this->generateVariants($originalPath, $mime, $category, $baseName, $width, $height, $config);
            }

            if ($this->storage->provider() === 'r2') {
                $storedOriginal = $this->storage->putPublic($originalStoredPath, $originalPath, [
                    'content_type' => $mime,
                    'cache_control' => 'public, max-age=31536000, immutable',
                    'meta_category' => $category,
                ]);
                $storageProvider = $storedOriginal->provider;
                $storageBucket = $storedOriginal->metadata['bucket'] ?? $this->storage->publicBucket();
                $storageKey = $storedOriginal->key;
                $checksum = $storedOriginal->checksum;
                $originalUrl = $storedOriginal->url ?? $originalUrl;

                if ($assetType === 'image') {
                    $variants = $this->uploadVariantsToPublicStorage($variants);
                }
            }

            if ($assetType === 'image') {
                $manifest = $this->writeManifest($baseName, $category, $mime, (int) $width, (int) $height, $originalFilename, $originalUrl, $variants);
                if ($storageProvider === 'r2' && !empty($manifest['path'])) {
                    $this->storage->putPublic($manifest['path'], $paths['base_path'] . '/' . $manifest['path'], [
                        'content_type' => 'application/json',
                        'cache_control' => 'no-cache',
                        'meta_category' => $category,
                    ]);
                }
            }

            $id = Database::insert(
                'INSERT INTO media_assets (original_path, original_url, variants_json, mime_type, intrinsic_width, '
                    . 'intrinsic_height, category, title, caption, alt_text, responsive_variants_json, manifest_path, '
                    . 'optimized_srcset, webp_srcset, fallback_url, storage_provider, storage_bucket, storage_key, '
                    . 'checksum_sha256, created_by, created_at) '
                    . 'VALUES (:path, :url, :variants, :mime, :width, :height, :category, :title, :caption, :alt, '
                    . ':responsive, :manifest, :opt_srcset, :webp_srcset, :fallback, :storage_provider, :storage_bucket, '
                    . ':storage_key, :checksum, :created_by, NOW())',
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
                    'storage_provider' => $storageProvider,
                    'storage_bucket' => $storageBucket,
                    'storage_key' => $storageKey,
                    'checksum' => $checksum,
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

        if (empty($asset['archived_at'])) {
            throw new \RuntimeException('Archive this media item before deleting it.');
        }

        $usages = $this->usageLabels($id);
        if ($usages !== []) {
            throw new \RuntimeException(
                'This image is still being used by ' . implode(', ', $usages) . '. Replace it there before deleting it.'
            );
        }

        $paths = $this->pathConfig();
        $toDelete = [];
        $storageKeys = [];

        $variantData = null;
        if (!empty($asset['manifest_path'])) {
            $manifestFile = $paths['base_path'] . '/' . ltrim($asset['manifest_path'], '/');
            $manifest = $this->safeLoadManifest($manifestFile);
            if ($manifest) {
                $variantData = $manifest['variants'] ?? null;
            }
            $toDelete[] = $manifestFile;
            $storageKeys[] = (string) $asset['manifest_path'];
        }

        if (!$variantData) {
            $variantData = json_decode($asset['responsive_variants_json'] ?? '[]', true) ?? [];
        }

        foreach (['optimized', 'webp'] as $type) {
            foreach ($variantData[$type] ?? [] as $variant) {
                $toDelete[] = $paths['base_path'] . '/' . ltrim($variant['path'], '/');
                $storageKeys[] = (string) ($variant['path'] ?? '');
            }
        }

        $toDelete[] = $paths['base_path'] . '/' . ltrim($asset['original_path'], '/');
        $storageKeys[] = (string) ($asset['storage_key'] ?? $asset['original_path']);

        foreach ($toDelete as $file) {
            if (is_file($file)) {
                @unlink($file);
            }
        }

        if ((string) ($asset['storage_provider'] ?? 'local') === 'r2') {
            foreach (array_filter(array_unique($storageKeys)) as $key) {
                try {
                    $this->storage->deletePublic($key);
                } catch (\Throwable $e) {
                    error_log('[BowWow][media_r2_delete_failed] key=' . $key . ' error=' . $e->getMessage());
                }
            }
        }

        Database::run('DELETE FROM media_assets WHERE id = :id', ['id' => $id]);
    }

    public function update(int $id, array $payload): ?array
    {
        $existing = Database::fetch('SELECT * FROM media_assets WHERE id = :id', ['id' => $id]);
        if (!$existing) {
            return null;
        }

        $category = array_key_exists('category', $payload)
            ? $this->normalizeCategory((string) $payload['category'])
            : (string) ($existing['category'] ?? 'default');
        $focalX = $this->normalizeFocalValue($payload['focal_x'] ?? ($existing['focal_x'] ?? null));
        $focalY = $this->normalizeFocalValue($payload['focal_y'] ?? ($existing['focal_y'] ?? null));
        $archivedAt = $existing['archived_at'] ?? null;
        if (array_key_exists('is_archived', $payload)) {
            $archivedAt = !empty($payload['is_archived']) ? date('Y-m-d H:i:s') : null;
        }

        Database::run(
            'UPDATE media_assets
             SET category = :category,
                 title = :title,
                 caption = :caption,
                 alt_text = :alt_text,
                 focal_x = :focal_x,
                 focal_y = :focal_y,
                 archived_at = :archived_at
             WHERE id = :id',
            [
                'category' => $category,
                'title' => Input::clean($payload['title'] ?? ($existing['title'] ?? null), 255),
                'caption' => Input::clean($payload['caption'] ?? ($existing['caption'] ?? null), 4000, true),
                'alt_text' => Input::clean($payload['alt_text'] ?? ($existing['alt_text'] ?? null), 255),
                'focal_x' => $focalX,
                'focal_y' => $focalY,
                'archived_at' => $archivedAt,
                'id' => $id,
            ]
        );

        return $this->find($id);
    }

    public function archive(int $id, bool $archived = true): ?array
    {
        Database::run(
            'UPDATE media_assets SET archived_at = :archived_at WHERE id = :id',
            ['archived_at' => $archived ? date('Y-m-d H:i:s') : null, 'id' => $id]
        );

        return $this->find($id);
    }

    public function usages(int $id): array
    {
        return $this->usageDetails($id);
    }

    public function replace(int $id, int $replacementId): array
    {
        if ($id === $replacementId) {
            throw new \RuntimeException('Choose a different replacement image.');
        }

        $asset = $this->find($id);
        $replacement = $this->find($replacementId);
        if (!$asset || !$replacement) {
            throw new \RuntimeException('Media item not found.');
        }
        if (empty($replacement['is_image'])) {
            throw new \RuntimeException('Replacement must be an image.');
        }

        $counts = [
            'products' => $this->replaceColumnReferences('retail_items', 'media_id', $id, $replacementId),
            'gallery_primary' => $this->replaceColumnReferences('gallery_items', 'primary_media_id', $id, $replacementId),
            'gallery_secondary' => $this->replaceColumnReferences('gallery_items', 'secondary_media_id', $id, $replacementId),
            'legacy_gallery_before' => $this->replaceColumnReferences('happy_clients', 'before_media_id', $id, $replacementId),
            'legacy_gallery_after' => $this->replaceColumnReferences('happy_clients', 'after_media_id', $id, $replacementId),
            'content_blocks' => $this->replaceContentBlockReferences($id, $replacementId),
        ];

        $this->archive($id, true);

        return [
            'replaced' => array_sum($counts),
            'counts' => $counts,
            'old_media' => $this->find($id),
            'replacement_media' => $this->find($replacementId),
        ];
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
        $assetType = $this->uploadValidator->assetTypeForMime($row['mime_type'] ?? '', $row['original_path'] ?? '');
        $usages = $this->usageDetails((int) $row['id']);
        $diagnostics = $this->diagnosticsForRow($row, $assetType, $optimizedSrcset, $webpSrcset);
        $focalX = isset($row['focal_x']) && $row['focal_x'] !== null ? (float) $row['focal_x'] : null;
        $focalY = isset($row['focal_y']) && $row['focal_y'] !== null ? (float) $row['focal_y'] : null;

        return [
            'id' => (int) $row['id'],
            'original_path' => $row['original_path'],
            'original_url' => $row['original_url'],
            'category' => $row['category'],
            'mime_type' => $row['mime_type'],
            'asset_type' => $assetType,
            'storage_provider' => $row['storage_provider'] ?? 'local',
            'storage_bucket' => $row['storage_bucket'] ?? null,
            'storage_key' => $row['storage_key'] ?? $row['original_path'],
            'checksum_sha256' => $row['checksum_sha256'] ?? null,
            'download_url' => $assetType === 'image' ? null : $row['original_url'],
            'is_image' => $assetType === 'image',
            'intrinsic_width' => $row['intrinsic_width'],
            'intrinsic_height' => $row['intrinsic_height'],
            'title' => $row['title'],
            'caption' => $row['caption'],
            'alt_text' => $row['alt_text'],
            'focal_x' => $focalX,
            'focal_y' => $focalY,
            'object_position' => ($focalX !== null && $focalY !== null)
                ? $this->formatFocal($focalX) . '% ' . $this->formatFocal($focalY) . '%'
                : null,
            'responsive_variants' => $variants,
            'manifest_path' => $row['manifest_path'],
            'optimized_srcset' => $optimizedSrcset,
            'webp_srcset' => $webpSrcset,
            'fallback_url' => $row['fallback_url'] ?? $row['original_url'],
            'archived_at' => $row['archived_at'] ?? null,
            'is_archived' => !empty($row['archived_at']),
            'health_status' => $row['health_status'] ?? null,
            'last_verified_at' => $row['last_verified_at'] ?? null,
            'usages' => $usages,
            'usage_labels' => array_map(static fn (array $usage): string => $usage['label'], $usages),
            'is_in_use' => $usages !== [],
            'diagnostics' => $diagnostics,
            'diagnostic_codes' => array_map(static fn (array $diagnostic): string => $diagnostic['code'], $diagnostics),
            'can_archive' => empty($row['archived_at']),
            'can_delete' => !empty($row['archived_at']) && $usages === [],
            'created_at' => $row['created_at'],
        ];
    }

    private function usageLabels(int $mediaId): array
    {
        return array_map(static fn (array $usage): string => $usage['label'], $this->usageDetails($mediaId));
    }

    private function usageDetails(int $mediaId): array
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
            $usages[] = [
                'type' => 'retail',
                'count' => $retailTotal,
                'label' => $retailTotal . ' product' . ($retailTotal === 1 ? '' : 's'),
                'admin_path' => '/admin/retail',
                'public_path' => '/#products',
            ];
        }

        $gallery = Database::fetch(
            'SELECT COUNT(*) AS total
             FROM gallery_items
             WHERE primary_media_id = :media_id OR secondary_media_id = :media_id',
            ['media_id' => $mediaId]
        );
        $galleryTotal = (int) ($gallery['total'] ?? 0);
        if ($galleryTotal > 0) {
            $usages[] = [
                'type' => 'gallery',
                'count' => $galleryTotal,
                'label' => $galleryTotal . ' gallery item' . ($galleryTotal === 1 ? '' : 's'),
                'admin_path' => '/admin/gallery',
                'public_path' => '/#gallery',
            ];
        }

        $legacyGallery = Database::fetch(
            'SELECT COUNT(*) AS total
             FROM happy_clients
             WHERE before_media_id = :media_id OR after_media_id = :media_id',
            ['media_id' => $mediaId]
        );
        $legacyTotal = (int) ($legacyGallery['total'] ?? 0);
        if ($legacyTotal > 0) {
            $usages[] = [
                'type' => 'legacy_gallery',
                'count' => $legacyTotal,
                'label' => $legacyTotal . ' legacy gallery item' . ($legacyTotal === 1 ? '' : 's'),
                'admin_path' => '/admin/gallery',
                'public_path' => '/#gallery',
            ];
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
            $usages[] = [
                'type' => 'hero',
                'count' => $heroTotal,
                'label' => 'the hero section',
                'admin_path' => '/admin/content',
                'public_path' => '/#home',
            ];
        }

        return $usages;
    }

    private function diagnosticsForRow(array $row, string $assetType, ?string $optimizedSrcset, ?string $webpSrcset): array
    {
        $diagnostics = [];

        if (!empty($row['archived_at'])) {
            $diagnostics[] = ['code' => 'archived', 'label' => 'Archived'];
        }

        if ($assetType === 'image') {
            if (trim((string) ($row['alt_text'] ?? '')) === '') {
                $diagnostics[] = ['code' => 'missing_alt', 'label' => 'Alt text needed'];
            }
            if (!$optimizedSrcset && !$webpSrcset) {
                $diagnostics[] = ['code' => 'missing_variants', 'label' => 'Optimized versions missing'];
            }
            if (($row['storage_provider'] ?? 'local') === 'local') {
                $paths = $this->pathConfig();
                $localOriginal = $paths['base_path'] . '/' . ltrim((string) ($row['original_path'] ?? ''), '/');
                if (!is_file($localOriginal)) {
                    $diagnostics[] = ['code' => 'missing_local_file', 'label' => 'Local fallback missing'];
                }
            }
        }

        return $diagnostics;
    }

    private function storeUploadedFile(string $source, string $target): bool
    {
        if (is_uploaded_file($source)) {
            return move_uploaded_file($source, $target);
        }

        if (Config::get('app.env') === 'testing' && is_file($source)) {
            return rename($source, $target) || copy($source, $target);
        }

        return false;
    }

    private function findDuplicateAsset(string $checksum): ?array
    {
        if ($checksum === '') {
            return null;
        }

        $rows = Database::fetchAll(
            'SELECT * FROM media_assets
             WHERE checksum_sha256 = :checksum
             ORDER BY archived_at IS NULL DESC, created_at ASC, id ASC',
            ['checksum' => $checksum]
        );

        foreach ($rows as $row) {
            if ($this->uploadValidator->assetTypeForMime($row['mime_type'] ?? '', $row['original_path'] ?? '') === 'image') {
                return $row;
            }
        }

        return null;
    }

    private function normalizeFocalValue(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        return max(0.0, min(100.0, round((float) $value, 2)));
    }

    private function formatFocal(float $value): string
    {
        return rtrim(rtrim(number_format($value, 2), '0'), '.');
    }

    private function replaceColumnReferences(string $table, string $column, int $oldId, int $replacementId): int
    {
        $count = Database::fetch(
            sprintf('SELECT COUNT(*) AS total FROM %s WHERE %s = :old_id', $table, $column),
            ['old_id' => $oldId]
        );

        Database::run(
            sprintf('UPDATE %s SET %s = :replacement_id WHERE %s = :old_id', $table, $column, $column),
            ['replacement_id' => $replacementId, 'old_id' => $oldId]
        );

        return (int) ($count['total'] ?? 0);
    }

    private function replaceContentBlockReferences(int $oldId, int $replacementId): int
    {
        $updated = 0;
        $rows = Database::fetchAll('SELECT `key`, content_json FROM content_blocks');
        foreach ($rows as $row) {
            $content = json_decode((string) ($row['content_json'] ?? ''), true);
            if (!is_array($content) || (int) ($content['media_id'] ?? 0) !== $oldId) {
                continue;
            }

            $content['media_id'] = $replacementId;
            unset($content['media']);
            Database::run(
                'UPDATE content_blocks SET content_json = :content WHERE `key` = :key',
                ['content' => json_encode($content), 'key' => $row['key']]
            );
            $updated++;
        }

        return $updated;
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

    private function writeManifest(string $baseName, string $category, string $mime, int $width, int $height, string $filename, string $originalUrl, array $variants): array
    {
        $paths = $this->pathConfig();
        $manifest = [
            'category' => $category,
            'original' => [
                'path' => 'originals/' . $filename,
                'url' => $originalUrl,
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

    private function uploadVariantsToPublicStorage(array $variants): array
    {
        $paths = $this->pathConfig();
        foreach (['optimized', 'webp'] as $type) {
            foreach ($variants[$type] ?? [] as $index => $variant) {
                $key = (string) ($variant['path'] ?? '');
                $localPath = $paths['base_path'] . '/' . ltrim($key, '/');
                if ($key === '' || !is_file($localPath)) {
                    continue;
                }

                $stored = $this->storage->putPublic($key, $localPath, [
                    'content_type' => $type === 'webp' ? 'image/webp' : null,
                    'cache_control' => 'public, max-age=31536000, immutable',
                ]);
                $variants[$type][$index]['url'] = $stored->url ?? (string) ($variant['url'] ?? '');
            }
        }

        return $variants;
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
