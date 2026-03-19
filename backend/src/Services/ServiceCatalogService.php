<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;
use BowWowSpa\Support\Input;

final class ServiceCatalogService
{
    public function list(bool $activeOnly = false): array
    {
        $sql = 'SELECT * FROM services';
        $params = [];

        if ($activeOnly) {
            $sql .= ' WHERE is_active = 1';
        }

        $sql .= ' ORDER BY sort_order ASC, created_at ASC, id ASC';

        return array_map([$this, 'hydrateRow'], Database::fetchAll($sql, $params));
    }

    public function find(int $id): ?array
    {
        $row = Database::fetch('SELECT * FROM services WHERE id = :id LIMIT 1', ['id' => $id]);
        return $row ? $this->hydrateRow($row) : null;
    }

    public function findMany(array $ids, bool $activeOnly = false): array
    {
        $normalizedIds = $this->normalizeIds($ids);
        if ($normalizedIds === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($normalizedIds), '?'));
        $sql = "SELECT * FROM services WHERE id IN ($placeholders)";
        if ($activeOnly) {
            $sql .= ' AND is_active = 1';
        }

        $rows = Database::fetchAll($sql, $normalizedIds);
        $byId = [];
        foreach ($rows as $row) {
            $hydrated = $this->hydrateRow($row);
            $byId[$hydrated['id']] = $hydrated;
        }

        $ordered = [];
        foreach ($normalizedIds as $id) {
            if (isset($byId[$id])) {
                $ordered[] = $byId[$id];
            }
        }

        return $ordered;
    }

    public function save(array $payload): array
    {
        $fields = [
            'name' => Input::clean($payload['name'] ?? null, 191),
            'short_summary' => Input::clean($payload['short_summary'] ?? null, 1000, true),
            'description' => Input::clean($payload['description'] ?? null, 4000, true),
            'duration_minutes' => min(480, max(15, (int) ($payload['duration_minutes'] ?? 30))),
            'price_label' => Input::clean($payload['price_label'] ?? null, 100),
            'breed_weight_note' => Input::clean($payload['breed_weight_note'] ?? null, 191),
            'is_active' => (int) (!isset($payload['is_active']) || (int) $payload['is_active'] === 1),
            'sort_order' => (int) ($payload['sort_order'] ?? 0),
        ];

        if ($fields['name'] === null) {
            throw new \RuntimeException('Service name is required.');
        }

        if (!empty($payload['id'])) {
            $fields['id'] = (int) $payload['id'];
            Database::run(
                'UPDATE services
                 SET name = :name,
                     short_summary = :short_summary,
                     description = :description,
                     duration_minutes = :duration_minutes,
                     price_label = :price_label,
                     breed_weight_note = :breed_weight_note,
                     is_active = :is_active,
                     sort_order = :sort_order,
                     updated_at = NOW()
                 WHERE id = :id',
                $fields
            );

            $saved = $this->find($fields['id']);
            if ($saved === null) {
                throw new \RuntimeException('Unable to load saved service.');
            }

            return $saved;
        }

        $id = Database::insert(
            'INSERT INTO services (name, short_summary, description, duration_minutes, price_label, breed_weight_note, is_active, sort_order, created_at, updated_at)
             VALUES (:name, :short_summary, :description, :duration_minutes, :price_label, :breed_weight_note, :is_active, :sort_order, NOW(), NOW())',
            $fields
        );

        $saved = $this->find($id);
        if ($saved === null) {
            throw new \RuntimeException('Unable to load saved service.');
        }

        return $saved;
    }

    public function calculateSelection(array $serviceIds, int $petCount = 1): array
    {
        $services = $this->findMany($serviceIds, true);
        $petCount = max(1, $petCount);
        $perPetDuration = 0;

        foreach ($services as $service) {
            $perPetDuration += (int) $service['duration_minutes'];
        }

        $totalDuration = $perPetDuration > 0 ? $perPetDuration * $petCount : 30;

        return [
            'services' => $services,
            'pet_count' => $petCount,
            'per_pet_duration_minutes' => $perPetDuration,
            'total_duration_minutes' => $totalDuration,
        ];
    }

    private function hydrateRow(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'name' => (string) $row['name'],
            'short_summary' => $row['short_summary'],
            'description' => $row['description'],
            'duration_minutes' => (int) $row['duration_minutes'],
            'price_label' => $row['price_label'],
            'breed_weight_note' => $row['breed_weight_note'],
            'is_active' => (int) $row['is_active'] === 1,
            'sort_order' => (int) $row['sort_order'],
            'created_at' => $row['created_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
        ];
    }

    private function normalizeIds(array $ids): array
    {
        $normalized = [];
        foreach ($ids as $id) {
            $value = (int) $id;
            if ($value > 0) {
                $normalized[] = $value;
            }
        }

        return array_values(array_unique($normalized));
    }
}
