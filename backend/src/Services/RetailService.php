<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;
use BowWowSpa\Support\Input;

final class RetailService
{
    public function __construct(private readonly MediaService $media = new MediaService())
    {
    }

    public function list(): array
    {
        $items = Database::fetchAll('SELECT * FROM retail_items ORDER BY sort_order ASC, created_at DESC');
        foreach ($items as &$item) {
            $item['media'] = $item['media_id'] ? $this->media->find((int) $item['media_id']) : null;
        }
        unset($item);

        return $items;
    }

    public function save(array $payload): array
    {
        $fields = [
            'name' => Input::clean($payload['name'] ?? null, 191),
            'description' => Input::clean($payload['description'] ?? null, 4000, true),
            'price' => isset($payload['price_cents']) && $payload['price_cents'] !== null ? max(0, (int) $payload['price_cents']) : null,
            'media' => !empty($payload['media_id']) ? (int) $payload['media_id'] : null,
            'featured' => (int) ($payload['is_featured'] ?? 0),
            'sort_order' => (int) ($payload['sort_order'] ?? 0),
            'published' => (int) ($payload['is_published'] ?? 1),
        ];

        if ($fields['name'] === null) {
            throw new \RuntimeException('Product name is required.');
        }

        if (!empty($payload['id'])) {
            Database::run(
                'UPDATE retail_items SET name = :name, description = :description, price_cents = :price, media_id = :media, is_featured = :featured, sort_order = :sort_order, is_published = :published, updated_at = NOW() WHERE id = :id',
                $fields + ['id' => (int) $payload['id']]
            );

            return ['id' => $payload['id']];
        }

        $id = Database::insert(
            'INSERT INTO retail_items (name, description, price_cents, media_id, is_featured, sort_order, is_published, created_at, updated_at) 
             VALUES (:name, :description, :price, :media, :featured, :sort_order, :published, NOW(), NOW())',
            $fields
        );

        return ['id' => $id];
    }
}
