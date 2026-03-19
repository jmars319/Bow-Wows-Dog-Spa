<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;
use BowWowSpa\Support\Input;

final class GalleryService
{
    public function __construct(private readonly MediaService $media = new MediaService())
    {
    }

    public function list(bool $publishedOnly = false): array
    {
        $sql = 'SELECT * FROM gallery_items';
        $params = [];

        if ($publishedOnly) {
            $sql .= ' WHERE is_published = 1';
        }

        $sql .= ' ORDER BY sort_order ASC, created_at ASC, id ASC';

        $rows = Database::fetchAll($sql, $params);
        return array_map([$this, 'hydrateRow'], $rows);
    }

    public function save(array $payload): array
    {
        $fields = [
            'title' => Input::clean($payload['title'] ?? null, 191),
            'caption' => Input::clean($payload['caption'] ?? null, 4000, true),
            'item_type' => $this->normalizeType($payload['item_type'] ?? 'groomed_pet'),
            'primary_media_id' => !empty($payload['primary_media_id']) ? (int) $payload['primary_media_id'] : null,
            'secondary_media_id' => !empty($payload['secondary_media_id']) ? (int) $payload['secondary_media_id'] : null,
            'sort_order' => (int) ($payload['sort_order'] ?? 0),
            'is_published' => (int) (!isset($payload['is_published']) || (int) $payload['is_published'] === 1),
        ];

        if ($fields['title'] === null) {
            throw new \RuntimeException('Gallery title is required.');
        }

        if ($fields['primary_media_id'] === null) {
            throw new \RuntimeException('Choose a primary image for this gallery item.');
        }

        if (!empty($payload['id'])) {
            $fields['id'] = (int) $payload['id'];
            Database::run(
                'UPDATE gallery_items
                 SET title = :title,
                     caption = :caption,
                     item_type = :item_type,
                     primary_media_id = :primary_media_id,
                     secondary_media_id = :secondary_media_id,
                     sort_order = :sort_order,
                     is_published = :is_published,
                     updated_at = NOW()
                 WHERE id = :id',
                $fields
            );

            $saved = $this->find($fields['id']);
            if ($saved === null) {
                throw new \RuntimeException('Unable to load saved gallery item.');
            }

            return $saved;
        }

        $id = Database::insert(
            'INSERT INTO gallery_items (title, caption, item_type, primary_media_id, secondary_media_id, sort_order, is_published, created_at, updated_at)
             VALUES (:title, :caption, :item_type, :primary_media_id, :secondary_media_id, :sort_order, :is_published, NOW(), NOW())',
            $fields
        );

        $saved = $this->find($id);
        if ($saved === null) {
            throw new \RuntimeException('Unable to load saved gallery item.');
        }

        return $saved;
    }

    public function find(int $id): ?array
    {
        $row = Database::fetch('SELECT * FROM gallery_items WHERE id = :id LIMIT 1', ['id' => $id]);
        return $row ? $this->hydrateRow($row) : null;
    }

    private function hydrateRow(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'title' => (string) $row['title'],
            'caption' => $row['caption'],
            'item_type' => (string) $row['item_type'],
            'primary_media_id' => $row['primary_media_id'] ? (int) $row['primary_media_id'] : null,
            'secondary_media_id' => $row['secondary_media_id'] ? (int) $row['secondary_media_id'] : null,
            'primary_media' => $row['primary_media_id'] ? $this->media->find((int) $row['primary_media_id']) : null,
            'secondary_media' => $row['secondary_media_id'] ? $this->media->find((int) $row['secondary_media_id']) : null,
            'sort_order' => (int) $row['sort_order'],
            'is_published' => (int) $row['is_published'] === 1,
            'created_at' => $row['created_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
        ];
    }

    private function normalizeType(mixed $value): string
    {
        $type = strtolower(trim((string) $value));
        $allowed = ['groomed_pet', 'before_after', 'facility', 'boutique'];

        return in_array($type, $allowed, true) ? $type : 'groomed_pet';
    }
}
