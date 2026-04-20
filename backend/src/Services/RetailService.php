<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;
use BowWowSpa\Support\Input;

final class RetailService
{
    private const ONLINE_SALE_STATUS_LABELS = [
        'catalog_only' => 'Catalog only for now',
        'ready' => 'Okay to sell online later',
        'in_store_only' => 'Keep in-store only',
    ];

    private const INVENTORY_STATUS_LABELS = [
        'untracked' => 'Not tracked yet',
        'in_stock' => 'In stock',
        'limited' => 'Low or limited',
        'out_of_stock' => 'Out of stock',
    ];

    private const FULFILLMENT_MODE_LABELS = [
        'undecided' => 'Undecided',
        'pickup_only' => 'Pickup only',
        'ship_or_pickup' => 'Can ship or pickup',
    ];

    public function __construct(
        private readonly MediaService $media = new MediaService(),
        private readonly RetailCommerceService $commerce = new RetailCommerceService(),
    )
    {
    }

    public function adminCatalog(): array
    {
        $categories = $this->loadCategories(false);
        $items = $this->loadItems(false);

        return [
            'categories' => $this->attachItemsToCategories($categories, $items, true),
            'items' => $items,
            'commerce' => $this->commerce->adminSnapshot(),
            'product_options' => $this->productOptions(),
        ];
    }

    public function publicCatalog(): array
    {
        $categories = $this->loadCategories(true);
        $items = $this->loadItems(true);

        return [
            'categories' => $this->attachItemsToCategories($categories, $items, false),
            'items' => $items,
            'commerce' => $this->commerce->publicSnapshot(),
        ];
    }

    public function saveCategory(array $payload): array
    {
        $id = !empty($payload['id']) ? (int) $payload['id'] : null;
        $existing = $id ? Database::fetch('SELECT * FROM retail_categories WHERE id = :id LIMIT 1', ['id' => $id]) : null;
        if ($id && !$existing) {
            throw new \RuntimeException('Category not found.');
        }

        $name = Input::clean($payload['name'] ?? null, 191);
        if ($name === null) {
            throw new \RuntimeException('Category name is required.');
        }

        $this->assertUniqueCategoryName($name, $id);
        $slug = $this->uniqueCategorySlug($name, $id);
        $published = array_key_exists('is_published', $payload)
            ? (int) (!empty($payload['is_published']))
            : (int) ($existing['is_published'] ?? 1);
        $sortOrder = $existing ? (int) $existing['sort_order'] : $this->nextCategorySortOrder();

        if ($existing) {
            Database::run(
                'UPDATE retail_categories
                 SET name = :name,
                     slug = :slug,
                     sort_order = :sort_order,
                     is_published = :published,
                     updated_at = NOW()
                 WHERE id = :id',
                [
                    'name' => $name,
                    'slug' => $slug,
                    'sort_order' => $sortOrder,
                    'published' => $published,
                    'id' => $id,
                ]
            );
        } else {
            $id = Database::insert(
                'INSERT INTO retail_categories (name, slug, sort_order, is_published, created_at, updated_at)
                 VALUES (:name, :slug, :sort_order, :published, NOW(), NOW())',
                [
                    'name' => $name,
                    'slug' => $slug,
                    'sort_order' => $sortOrder,
                    'published' => $published,
                ]
            );
        }

        $saved = $this->findCategory((int) $id);
        if ($saved === null) {
            throw new \RuntimeException('Unable to load saved category.');
        }

        return $saved;
    }

    public function deleteCategory(int $id): void
    {
        $existing = $this->findCategory($id);
        if ($existing === null) {
            return;
        }

        $itemCount = Database::fetch(
            'SELECT COUNT(*) AS total FROM retail_items WHERE category_id = :id',
            ['id' => $id]
        );
        if ((int) ($itemCount['total'] ?? 0) > 0) {
            throw new \RuntimeException('Move or delete the products in this category before deleting it.');
        }

        Database::run('DELETE FROM retail_categories WHERE id = :id', ['id' => $id]);
    }

    public function saveItem(array $payload): array
    {
        $id = !empty($payload['id']) ? (int) $payload['id'] : null;
        $existing = $id ? Database::fetch('SELECT * FROM retail_items WHERE id = :id LIMIT 1', ['id' => $id]) : null;
        if ($id && !$existing) {
            throw new \RuntimeException('Product not found.');
        }

        $name = Input::clean($payload['name'] ?? null, 191);
        if ($name === null) {
            throw new \RuntimeException('Product name is required.');
        }

        $categoryId = isset($payload['category_id']) ? (int) $payload['category_id'] : (int) ($existing['category_id'] ?? 0);
        if ($categoryId <= 0 || $this->findCategory($categoryId) === null) {
            throw new \RuntimeException('Choose a category before saving the product.');
        }

        $priceCents = null;
        if (array_key_exists('price_cents', $payload) && $payload['price_cents'] !== null && $payload['price_cents'] !== '') {
            $priceCents = max(0, (int) $payload['price_cents']);
        } elseif ($existing) {
            $priceCents = $existing['price_cents'] !== null ? (int) $existing['price_cents'] : null;
        }

        $sku = array_key_exists('sku', $payload)
            ? $this->normalizeSku($payload['sku'] ?? null)
            : $this->normalizeSku($existing['sku'] ?? null);
        $this->assertUniqueItemSku($sku, $id);

        $mediaId = array_key_exists('media_id', $payload)
            ? (!empty($payload['media_id']) ? (int) $payload['media_id'] : null)
            : (!empty($existing['media_id']) ? (int) $existing['media_id'] : null);
        $onlineSaleStatus = $this->normalizeEnum(
            $payload['online_sale_status'] ?? ($existing['online_sale_status'] ?? null),
            self::ONLINE_SALE_STATUS_LABELS,
            'catalog_only'
        );
        $inventoryStatus = $this->normalizeEnum(
            $payload['inventory_status'] ?? ($existing['inventory_status'] ?? null),
            self::INVENTORY_STATUS_LABELS,
            'untracked'
        );
        $fulfillmentMode = $this->normalizeEnum(
            $payload['fulfillment_mode'] ?? ($existing['fulfillment_mode'] ?? null),
            self::FULFILLMENT_MODE_LABELS,
            'undecided'
        );
        $published = array_key_exists('is_published', $payload)
            ? (int) (!empty($payload['is_published']))
            : (int) ($existing['is_published'] ?? 1);
        $featured = array_key_exists('is_featured', $payload)
            ? (int) (!empty($payload['is_featured']))
            : (int) ($existing['is_featured'] ?? 0);
        $sortOrder = $existing ? (int) $existing['sort_order'] : $this->nextItemSortOrder($categoryId);
        $description = Input::clean($payload['description'] ?? null, 4000, true);

        if ($existing) {
            Database::run(
                'UPDATE retail_items
                 SET category_id = :category_id,
                     name = :name,
                     sku = :sku,
                     description = :description,
                     price_cents = :price_cents,
                     media_id = :media_id,
                     online_sale_status = :online_sale_status,
                     inventory_status = :inventory_status,
                     fulfillment_mode = :fulfillment_mode,
                     is_featured = :featured,
                     sort_order = :sort_order,
                     is_published = :published,
                     updated_at = NOW()
                 WHERE id = :id',
                [
                    'category_id' => $categoryId,
                    'name' => $name,
                    'sku' => $sku,
                    'description' => $description,
                    'price_cents' => $priceCents,
                    'media_id' => $mediaId,
                    'online_sale_status' => $onlineSaleStatus,
                    'inventory_status' => $inventoryStatus,
                    'fulfillment_mode' => $fulfillmentMode,
                    'featured' => $featured,
                    'sort_order' => $sortOrder,
                    'published' => $published,
                    'id' => $id,
                ]
            );
        } else {
            $id = Database::insert(
                'INSERT INTO retail_items (
                    category_id,
                    name,
                    sku,
                    description,
                    price_cents,
                    media_id,
                    online_sale_status,
                    inventory_status,
                    fulfillment_mode,
                    is_featured,
                    sort_order,
                    is_published,
                    created_at,
                    updated_at
                 ) VALUES (
                    :category_id,
                    :name,
                    :sku,
                    :description,
                    :price_cents,
                    :media_id,
                    :online_sale_status,
                    :inventory_status,
                    :fulfillment_mode,
                    :featured,
                    :sort_order,
                    :published,
                    NOW(),
                    NOW()
                 )',
                [
                    'category_id' => $categoryId,
                    'name' => $name,
                    'sku' => $sku,
                    'description' => $description,
                    'price_cents' => $priceCents,
                    'media_id' => $mediaId,
                    'online_sale_status' => $onlineSaleStatus,
                    'inventory_status' => $inventoryStatus,
                    'fulfillment_mode' => $fulfillmentMode,
                    'featured' => $featured,
                    'sort_order' => $sortOrder,
                    'published' => $published,
                ]
            );
        }

        $saved = $this->findItem((int) $id);
        if ($saved === null) {
            throw new \RuntimeException('Unable to load saved product.');
        }

        return $saved;
    }

    public function deleteItem(int $id): void
    {
        Database::run('DELETE FROM retail_items WHERE id = :id', ['id' => $id]);
    }

    private function findCategory(int $id): ?array
    {
        $row = Database::fetch('SELECT * FROM retail_categories WHERE id = :id LIMIT 1', ['id' => $id]);
        if (!$row) {
            return null;
        }

        $counts = Database::fetch(
            'SELECT COUNT(*) AS total, SUM(CASE WHEN is_published = 1 THEN 1 ELSE 0 END) AS published_total
             FROM retail_items
             WHERE category_id = :id',
            ['id' => $id]
        ) ?: [];

        return $this->hydrateCategory($row, [
            'total' => (int) ($counts['total'] ?? 0),
            'published_total' => (int) ($counts['published_total'] ?? 0),
        ]);
    }

    private function findItem(int $id): ?array
    {
        $row = Database::fetch('SELECT * FROM retail_items WHERE id = :id LIMIT 1', ['id' => $id]);
        return $row ? $this->hydrateItem($row) : null;
    }

    private function loadCategories(bool $publishedOnly): array
    {
        $sql = 'SELECT c.*, COUNT(i.id) AS product_total, SUM(CASE WHEN i.is_published = 1 THEN 1 ELSE 0 END) AS published_product_total
                FROM retail_categories c
                LEFT JOIN retail_items i ON i.category_id = c.id ';

        if ($publishedOnly) {
            $sql .= 'WHERE c.is_published = 1 ';
        }

        $sql .= 'GROUP BY c.id ORDER BY c.sort_order ASC, c.name ASC, c.created_at ASC';

        return array_map(
            fn (array $row): array => $this->hydrateCategory($row, [
                'total' => (int) ($row['product_total'] ?? 0),
                'published_total' => (int) ($row['published_product_total'] ?? 0),
            ]),
            Database::fetchAll($sql)
        );
    }

    private function loadItems(bool $publishedOnly): array
    {
        $sql = 'SELECT retail_items.*,
                       (
                           SELECT COUNT(*)
                           FROM retail_item_variants variants
                           WHERE variants.retail_item_id = retail_items.id
                             AND variants.is_active = 1
                       ) AS variant_count
                FROM retail_items';
        if ($publishedOnly) {
            $sql .= ' WHERE retail_items.is_published = 1';
        }
        $sql .= ' ORDER BY retail_items.sort_order ASC, retail_items.name ASC, retail_items.created_at ASC';

        return array_map(
            fn (array $row): array => $this->hydrateItem($row),
            Database::fetchAll($sql)
        );
    }

    private function hydrateCategory(array $row, array $counts = []): array
    {
        return [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'slug' => $row['slug'],
            'sort_order' => (int) ($row['sort_order'] ?? 0),
            'is_published' => (bool) ($row['is_published'] ?? false),
            'product_count' => (int) ($counts['total'] ?? 0),
            'published_product_count' => (int) ($counts['published_total'] ?? 0),
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
            'items' => [],
        ];
    }

    private function hydrateItem(array $row): array
    {
        $priceCents = $row['price_cents'] !== null ? (int) $row['price_cents'] : null;
        $onlineSaleStatus = $this->normalizeEnum($row['online_sale_status'] ?? null, self::ONLINE_SALE_STATUS_LABELS, 'catalog_only');
        $inventoryStatus = $this->normalizeEnum($row['inventory_status'] ?? null, self::INVENTORY_STATUS_LABELS, 'untracked');
        $fulfillmentMode = $this->normalizeEnum($row['fulfillment_mode'] ?? null, self::FULFILLMENT_MODE_LABELS, 'undecided');

        return [
            'id' => (int) $row['id'],
            'category_id' => $row['category_id'] !== null ? (int) $row['category_id'] : null,
            'name' => $row['name'],
            'sku' => $this->normalizeSku($row['sku'] ?? null),
            'description' => $row['description'],
            'price_cents' => $priceCents,
            'price_label' => $priceCents !== null ? '$' . number_format($priceCents / 100, 2) : null,
            'media_id' => $row['media_id'] !== null ? (int) $row['media_id'] : null,
            'media' => !empty($row['media_id']) ? $this->media->find((int) $row['media_id']) : null,
            'online_sale_status' => $onlineSaleStatus,
            'online_sale_status_label' => self::ONLINE_SALE_STATUS_LABELS[$onlineSaleStatus],
            'inventory_status' => $inventoryStatus,
            'inventory_status_label' => self::INVENTORY_STATUS_LABELS[$inventoryStatus],
            'fulfillment_mode' => $fulfillmentMode,
            'fulfillment_mode_label' => self::FULFILLMENT_MODE_LABELS[$fulfillmentMode],
            'variant_count' => (int) ($row['variant_count'] ?? 0),
            'is_featured' => (bool) ($row['is_featured'] ?? false),
            'sort_order' => (int) ($row['sort_order'] ?? 0),
            'is_published' => (bool) ($row['is_published'] ?? false),
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];
    }

    private function attachItemsToCategories(array $categories, array $items, bool $includeEmptyCategories): array
    {
        $grouped = [];
        foreach ($categories as $category) {
            $category['items'] = [];
            $grouped[$category['id']] = $category;
        }

        foreach ($items as $item) {
            $categoryId = $item['category_id'];
            if ($categoryId !== null && isset($grouped[$categoryId])) {
                $grouped[$categoryId]['items'][] = $item;
            }
        }

        $categories = array_values($grouped);
        if ($includeEmptyCategories) {
            return $categories;
        }

        return array_values(array_filter(
            $categories,
            static fn (array $category): bool => $category['items'] !== []
        ));
    }

    private function assertUniqueCategoryName(string $name, ?int $ignoreId = null): void
    {
        $lower = function_exists('mb_strtolower') ? mb_strtolower($name) : strtolower($name);
        $params = ['name' => $lower];
        $sql = 'SELECT id FROM retail_categories WHERE LOWER(name) = :name';
        if ($ignoreId !== null) {
            $sql .= ' AND id != :id';
            $params['id'] = $ignoreId;
        }

        $existing = Database::fetch($sql . ' LIMIT 1', $params);
        if ($existing) {
            throw new \RuntimeException('That category name is already in use.');
        }
    }

    private function uniqueCategorySlug(string $name, ?int $ignoreId = null): string
    {
        $base = $this->slugify($name);
        $candidate = $base;
        $suffix = 2;

        while (true) {
            $params = ['slug' => $candidate];
            $sql = 'SELECT id FROM retail_categories WHERE slug = :slug';
            if ($ignoreId !== null) {
                $sql .= ' AND id != :id';
                $params['id'] = $ignoreId;
            }

            $existing = Database::fetch($sql . ' LIMIT 1', $params);
            if (!$existing) {
                return $candidate;
            }

            $candidate = $base . '-' . $suffix;
            $suffix++;
        }
    }

    private function slugify(string $value): string
    {
        $slug = strtolower(trim($value));
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
        $slug = trim($slug, '-');

        return $slug !== '' ? $slug : 'category';
    }

    private function nextCategorySortOrder(): int
    {
        $row = Database::fetch('SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM retail_categories');
        return ((int) ($row['max_sort'] ?? 0)) + 10;
    }

    private function nextItemSortOrder(int $categoryId): int
    {
        $row = Database::fetch(
            'SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM retail_items WHERE category_id = :category_id',
            ['category_id' => $categoryId]
        );

        return ((int) ($row['max_sort'] ?? 0)) + 10;
    }

    public function productOptions(): array
    {
        return [
            'online_sale_status' => $this->labelOptions(self::ONLINE_SALE_STATUS_LABELS),
            'inventory_status' => $this->labelOptions(self::INVENTORY_STATUS_LABELS),
            'fulfillment_mode' => $this->labelOptions(self::FULFILLMENT_MODE_LABELS),
        ];
    }

    private function labelOptions(array $labels): array
    {
        $options = [];
        foreach ($labels as $value => $label) {
            $options[] = [
                'value' => $value,
                'label' => $label,
            ];
        }

        return $options;
    }

    private function normalizeEnum(mixed $value, array $labels, string $default): string
    {
        $candidate = is_string($value) ? trim($value) : '';
        return isset($labels[$candidate]) ? $candidate : $default;
    }

    private function normalizeSku(mixed $value): ?string
    {
        $sku = Input::clean($value, 100);
        if ($sku === null || $sku === '') {
            return null;
        }

        $sku = strtoupper(str_replace(' ', '-', $sku));

        return $sku !== '' ? $sku : null;
    }

    private function assertUniqueItemSku(?string $sku, ?int $ignoreId = null): void
    {
        if ($sku === null) {
            return;
        }

        $params = ['sku' => $sku];
        $sql = 'SELECT id FROM retail_items WHERE sku = :sku';
        if ($ignoreId !== null) {
            $sql .= ' AND id != :id';
            $params['id'] = $ignoreId;
        }

        $existing = Database::fetch($sql . ' LIMIT 1', $params);
        if ($existing) {
            throw new \RuntimeException('That SKU is already being used by another product.');
        }
    }
}
