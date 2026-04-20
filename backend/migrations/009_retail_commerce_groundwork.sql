CREATE TABLE IF NOT EXISTS retail_item_variants (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    retail_item_id INT UNSIGNED NOT NULL,
    label VARCHAR(191) NOT NULL,
    sku VARCHAR(100) NULL,
    price_cents INT NULL,
    inventory_status ENUM('untracked', 'in_stock', 'limited', 'out_of_stock') NOT NULL DEFAULT 'untracked',
    stock_quantity INT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_retail_item_variants_item_sort (retail_item_id, is_active, sort_order, created_at),
    UNIQUE KEY uniq_retail_item_variants_sku (sku),
    CONSTRAINT fk_retail_item_variants_item FOREIGN KEY (retail_item_id) REFERENCES retail_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @dbName := DATABASE();

SET @skuColumnExists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'retail_items' AND column_name = 'sku'
);
SET @ddl := IF(@skuColumnExists = 0, 'ALTER TABLE retail_items ADD COLUMN sku VARCHAR(100) NULL AFTER name', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @onlineStatusColumnExists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'retail_items' AND column_name = 'online_sale_status'
);
SET @ddl := IF(@onlineStatusColumnExists = 0, 'ALTER TABLE retail_items ADD COLUMN online_sale_status ENUM(''catalog_only'', ''ready'', ''in_store_only'') NOT NULL DEFAULT ''catalog_only'' AFTER media_id', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @inventoryStatusColumnExists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'retail_items' AND column_name = 'inventory_status'
);
SET @ddl := IF(@inventoryStatusColumnExists = 0, 'ALTER TABLE retail_items ADD COLUMN inventory_status ENUM(''untracked'', ''in_stock'', ''limited'', ''out_of_stock'') NOT NULL DEFAULT ''untracked'' AFTER online_sale_status', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fulfillmentModeColumnExists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = @dbName AND table_name = 'retail_items' AND column_name = 'fulfillment_mode'
);
SET @ddl := IF(@fulfillmentModeColumnExists = 0, 'ALTER TABLE retail_items ADD COLUMN fulfillment_mode ENUM(''undecided'', ''pickup_only'', ''ship_or_pickup'') NOT NULL DEFAULT ''undecided'' AFTER inventory_status', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @skuIndexExists := (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = @dbName AND table_name = 'retail_items' AND index_name = 'uniq_retail_items_sku'
);
SET @ddl := IF(@skuIndexExists = 0, 'ALTER TABLE retail_items ADD UNIQUE KEY uniq_retail_items_sku (sku)', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO site_settings (`key`, `value`)
VALUES
    ('commerce_mode', 'catalog_only'),
    ('commerce_currency', 'USD'),
    ('commerce_provider', '')
ON DUPLICATE KEY UPDATE
    `value` = IF(TRIM(COALESCE(`value`, '')) = '', VALUES(`value`), `value`);
