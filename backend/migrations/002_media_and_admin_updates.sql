ALTER TABLE media_assets
    ADD COLUMN original_url VARCHAR(255) NULL AFTER original_path,
    ADD COLUMN mime_type VARCHAR(100) NULL,
    ADD COLUMN intrinsic_width INT NULL,
    ADD COLUMN intrinsic_height INT NULL,
    ADD COLUMN category VARCHAR(100) NOT NULL DEFAULT 'default',
    ADD COLUMN title VARCHAR(255) NULL,
    ADD COLUMN caption TEXT NULL,
    ADD COLUMN responsive_variants_json JSON NULL,
    ADD COLUMN manifest_path VARCHAR(255) NULL,
    ADD COLUMN optimized_srcset TEXT NULL,
    ADD COLUMN webp_srcset TEXT NULL,
    ADD COLUMN fallback_url VARCHAR(255) NULL;

ALTER TABLE admin_users
    ADD COLUMN display_name VARCHAR(191) NULL AFTER email;
