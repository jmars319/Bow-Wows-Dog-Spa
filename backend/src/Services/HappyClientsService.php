<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;

final class HappyClientsService
{
    public function __construct(private readonly MediaService $media = new MediaService())
    {
    }

    public function list(): array
    {
        $items = Database::fetchAll('SELECT * FROM happy_clients ORDER BY sort_order ASC, created_at DESC');
        foreach ($items as &$item) {
            $item['before_media'] = $item['before_media_id'] ? $this->media->find((int) $item['before_media_id']) : null;
            $item['after_media'] = $item['after_media_id'] ? $this->media->find((int) $item['after_media_id']) : null;
            $item['tags_list'] = $this->decodeTags($item['tags'] ?? null);
        }
        unset($item);

        return $items;
    }

    public function save(array $payload): array
    {
        if (!empty($payload['id'])) {
            Database::run(
                'UPDATE happy_clients SET title = :title, blurb = :blurb, before_media_id = :before_id, after_media_id = :after_id, tags = :tags, is_published = :published, sort_order = :sort_order, updated_at = NOW() WHERE id = :id',
                [
                    'title' => $payload['title'],
                    'blurb' => $payload['blurb'] ?? null,
                    'before_id' => $payload['before_media_id'] ?? null,
                    'after_id' => $payload['after_media_id'] ?? null,
                    'tags' => json_encode($payload['tags'] ?? []),
                    'published' => (int) ($payload['is_published'] ?? 1),
                    'sort_order' => (int) ($payload['sort_order'] ?? 0),
                    'id' => $payload['id'],
                ]
            );

            return ['id' => $payload['id']];
        }

        $id = Database::insert(
            'INSERT INTO happy_clients (title, blurb, before_media_id, after_media_id, tags, is_published, sort_order, created_at, updated_at) 
             VALUES (:title, :blurb, :before_id, :after_id, :tags, :published, :sort_order, NOW(), NOW())',
            [
                'title' => $payload['title'],
                'blurb' => $payload['blurb'] ?? null,
                'before_id' => $payload['before_media_id'] ?? null,
                'after_id' => $payload['after_media_id'] ?? null,
                'tags' => json_encode($payload['tags'] ?? []),
                'published' => (int) ($payload['is_published'] ?? 1),
                'sort_order' => (int) ($payload['sort_order'] ?? 0),
            ]
        );

        return ['id' => $id];
    }

    private function decodeTags(?string $json): array
    {
        $decoded = $json ? json_decode($json, true) : [];
        return array_filter(is_array($decoded) ? $decoded : []);
    }
}
