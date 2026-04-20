CREATE TABLE IF NOT EXISTS retail_categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    slug VARCHAR(191) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_published TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uniq_retail_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @dbName := DATABASE();

SET @categoryColumnExists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE BINARY table_schema = BINARY @dbName
      AND BINARY table_name = BINARY 'retail_items'
      AND BINARY column_name = BINARY 'category_id'
);
SET @ddl := IF(@categoryColumnExists = 0, 'ALTER TABLE retail_items ADD COLUMN category_id INT UNSIGNED NULL AFTER id', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @categoryIndexExists := (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE BINARY table_schema = BINARY @dbName
      AND BINARY table_name = BINARY 'retail_items'
      AND BINARY index_name = BINARY 'idx_retail_items_category_sort'
);
SET @ddl := IF(@categoryIndexExists = 0, 'ALTER TABLE retail_items ADD INDEX idx_retail_items_category_sort (category_id, sort_order, created_at)', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @categoryForeignKeyExists := (
    SELECT COUNT(*)
    FROM information_schema.referential_constraints
    WHERE BINARY constraint_schema = BINARY @dbName
      AND BINARY table_name = BINARY 'retail_items'
      AND BINARY constraint_name = BINARY 'fk_retail_items_category'
);
SET @ddl := IF(@categoryForeignKeyExists = 0, 'ALTER TABLE retail_items ADD CONSTRAINT fk_retail_items_category FOREIGN KEY (category_id) REFERENCES retail_categories(id) ON DELETE SET NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO retail_categories (name, slug, sort_order, is_published, created_at, updated_at)
SELECT 'General', 'general', 10, 1, NOW(), NOW()
WHERE EXISTS (SELECT 1 FROM retail_items)
  AND NOT EXISTS (SELECT 1 FROM retail_categories);

SET @defaultRetailCategoryId := (
    SELECT id
    FROM retail_categories
    ORDER BY sort_order ASC, id ASC
    LIMIT 1
);

UPDATE retail_items
SET category_id = @defaultRetailCategoryId
WHERE category_id IS NULL
  AND @defaultRetailCategoryId IS NOT NULL;
