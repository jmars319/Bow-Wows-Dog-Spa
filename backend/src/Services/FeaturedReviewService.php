<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;
use BowWowSpa\Support\Input;

final class FeaturedReviewService
{
    public function list(bool $featuredOnly = false): array
    {
        $sql = 'SELECT * FROM featured_reviews';
        $params = [];

        if ($featuredOnly) {
            $sql .= ' WHERE is_featured = 1';
        }

        $sql .= ' ORDER BY display_order ASC, created_at ASC, id ASC';

        return array_map([$this, 'hydrateRow'], Database::fetchAll($sql, $params));
    }

    public function save(array $payload): array
    {
        $fields = [
            'reviewer_name' => Input::clean($payload['reviewer_name'] ?? null, 191),
            'review_text' => Input::clean($payload['review_text'] ?? null, 4000, true),
            'star_rating' => max(1, min(5, (int) ($payload['star_rating'] ?? 5))),
            'source_label' => Input::clean($payload['source_label'] ?? null, 100) ?: 'Google',
            'source_url' => Input::url($payload['source_url'] ?? null, 255),
            'display_order' => (int) ($payload['display_order'] ?? 0),
            'is_featured' => (int) (!isset($payload['is_featured']) || (int) $payload['is_featured'] === 1),
        ];

        if ($fields['reviewer_name'] === null || $fields['review_text'] === null) {
            throw new \RuntimeException('Reviewer name and review text are required.');
        }

        if (!empty($payload['id'])) {
            $fields['id'] = (int) $payload['id'];
            Database::run(
                'UPDATE featured_reviews
                 SET reviewer_name = :reviewer_name,
                     review_text = :review_text,
                     star_rating = :star_rating,
                     source_label = :source_label,
                     source_url = :source_url,
                     display_order = :display_order,
                     is_featured = :is_featured,
                     updated_at = NOW()
                 WHERE id = :id',
                $fields
            );

            $saved = $this->find($fields['id']);
            if ($saved === null) {
                throw new \RuntimeException('Unable to load saved review.');
            }

            return $saved;
        }

        $id = Database::insert(
            'INSERT INTO featured_reviews (reviewer_name, review_text, star_rating, source_label, source_url, display_order, is_featured, created_at, updated_at)
             VALUES (:reviewer_name, :review_text, :star_rating, :source_label, :source_url, :display_order, :is_featured, NOW(), NOW())',
            $fields
        );

        $saved = $this->find($id);
        if ($saved === null) {
            throw new \RuntimeException('Unable to load saved review.');
        }

        return $saved;
    }

    public function find(int $id): ?array
    {
        $row = Database::fetch('SELECT * FROM featured_reviews WHERE id = :id LIMIT 1', ['id' => $id]);
        return $row ? $this->hydrateRow($row) : null;
    }

    private function hydrateRow(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'reviewer_name' => (string) $row['reviewer_name'],
            'review_text' => (string) $row['review_text'],
            'star_rating' => (int) $row['star_rating'],
            'source_label' => (string) $row['source_label'],
            'source_url' => $row['source_url'],
            'display_order' => (int) $row['display_order'],
            'is_featured' => (int) $row['is_featured'] === 1,
            'created_at' => $row['created_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
        ];
    }
}
