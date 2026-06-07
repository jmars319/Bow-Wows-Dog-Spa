<?php

declare(strict_types=1);

namespace BowWowSpa\Tests\Feature;

use BowWowSpa\Database\Database;
use BowWowSpa\Services\GalleryService;
use BowWowSpa\Services\MediaService;
use BowWowSpa\Services\RetailService;
use BowWowSpa\Tests\TestCase;

final class RetailAndMediaTest extends TestCase
{
    public function testMediaDeleteBlocksAssetsStillUsedByProducts(): void
    {
        $mediaId = $this->env->insertMediaAsset();
        $retail = new RetailService();
        $category = $retail->saveCategory(['name' => 'Coat Care', 'is_published' => 1]);
        $item = $retail->saveItem([
            'category_id' => $category['id'],
            'name' => 'Detangler Spray',
            'description' => 'Salon shelf favorite',
            'price_cents' => 1499,
            'media_id' => $mediaId,
            'is_published' => 1,
        ]);

        $media = new MediaService();
        $this->assertThrows(fn () => $media->delete($mediaId), 'Archive this media item before deleting it');
        $media->archive($mediaId, true);
        $this->assertThrows(fn () => $media->delete($mediaId), 'still being used by 1 product');

        $retail->deleteItem($item['id']);
        $media->delete($mediaId);

        $this->assertNull($media->find($mediaId));
    }

    public function testMediaMetadataArchiveAndFocalPointRoundTrip(): void
    {
        $mediaId = $this->env->insertMediaAsset();

        $media = new MediaService();
        $updated = $media->update($mediaId, [
            'title' => 'Fresh groom portrait',
            'alt_text' => 'Happy dog after grooming',
            'caption' => 'Ready for pickup.',
            'category' => 'gallery',
            'focal_x' => 42.5,
            'focal_y' => 37,
        ]);

        $this->assertNotNull($updated);
        $this->assertSame('Fresh groom portrait', $updated['title']);
        $this->assertSame('Happy dog after grooming', $updated['alt_text']);
        $this->assertSame('gallery', $updated['category']);
        $this->assertSame(42.5, $updated['focal_x']);
        $this->assertSame(37.0, $updated['focal_y']);
        $this->assertSame('42.5% 37%', $updated['object_position']);
        $this->assertFalse($updated['is_archived']);

        $archived = $media->archive($mediaId, true);
        $this->assertTrue((bool) $archived['is_archived']);
        $this->assertTrue((bool) $archived['can_delete']);
    }

    public function testMediaReplacementUpdatesKnownReferencesAndArchivesOldAsset(): void
    {
        $oldMediaId = $this->env->insertMediaAsset(['title' => 'Old image']);
        $newMediaId = $this->env->insertMediaAsset([
            'original_path' => 'originals/new-image.jpg',
            'original_url' => '/uploads/originals/new-image.jpg',
            'title' => 'New image',
        ]);

        $retail = new RetailService();
        $category = $retail->saveCategory(['name' => 'Grooming Tools', 'is_published' => 1]);
        $item = $retail->saveItem([
            'category_id' => $category['id'],
            'name' => 'Slicker Brush',
            'media_id' => $oldMediaId,
            'is_published' => 1,
        ]);

        Database::run(
            'INSERT INTO content_blocks (`key`, content_json) VALUES ("hero", :content)',
            ['content' => json_encode(['headline' => 'Welcome', 'media_id' => $oldMediaId])]
        );

        $result = (new MediaService())->replace($oldMediaId, $newMediaId);

        $this->assertSame(2, $result['replaced']);
        $this->assertTrue((bool) $result['old_media']['is_archived']);

        $itemRow = Database::fetch('SELECT media_id FROM retail_items WHERE id = :id', ['id' => $item['id']]);
        $this->assertSame($newMediaId, (int) $itemRow['media_id']);

        $hero = Database::fetch('SELECT content_json FROM content_blocks WHERE `key` = "hero"');
        $heroContent = json_decode((string) $hero['content_json'], true);
        $this->assertSame($newMediaId, (int) $heroContent['media_id']);
    }

    public function testMediaListFiltersImagesAndPrivateAttachmentsStayOutOfImagePickerResults(): void
    {
        $imageId = $this->env->insertMediaAsset([
            'title' => 'Gallery dog',
            'category' => 'gallery',
            'alt_text' => 'Gallery dog portrait',
        ]);
        $this->env->insertMediaAsset([
            'original_path' => 'attachments/intake-form.pdf',
            'original_url' => '/uploads/attachments/intake-form.pdf',
            'mime_type' => 'application/pdf',
            'category' => 'attachments',
            'title' => 'Private intake paperwork',
        ]);

        $items = (new MediaService())->list(null, [
            'asset_type' => 'image',
            'archived' => 'active',
            'search' => 'Gallery',
        ]);

        $this->assertCount(1, $items);
        $this->assertSame($imageId, $items[0]['id']);
        $this->assertTrue((bool) $items[0]['is_image']);
    }

    public function testMediaDiagnosticsReportMissingMetadataAndVariantsFriendly(): void
    {
        $mediaId = $this->env->insertMediaAsset([
            'category' => 'gallery',
            'alt_text' => '',
            'optimized_srcset' => null,
            'webp_srcset' => null,
            'fallback_url' => null,
        ]);

        $asset = (new MediaService())->find($mediaId);

        $this->assertTrue(in_array('missing_alt', $asset['diagnostic_codes'], true));
        $this->assertTrue(in_array('missing_variants', $asset['diagnostic_codes'], true));
        $this->assertTrue(in_array('missing_local_file', $asset['diagnostic_codes'], true));
    }

    public function testMediaNeedsAttentionFilterFindsActionableDiagnostics(): void
    {
        $attentionId = $this->env->insertMediaAsset([
            'category' => 'hero',
            'alt_text' => '',
            'intrinsic_width' => 900,
            'intrinsic_height' => 200,
            'optimized_srcset' => null,
            'webp_srcset' => null,
            'fallback_url' => null,
        ]);
        $this->env->insertMediaAsset([
            'category' => 'gallery',
            'alt_text' => 'Fresh groom portrait',
            'intrinsic_width' => 1800,
            'intrinsic_height' => 1200,
            'optimized_srcset' => '/uploads/photo-w900.jpg 900w',
            'webp_srcset' => '/uploads/photo-w900.webp 900w',
            'fallback_url' => '/uploads/photo.jpg',
            'storage_provider' => 'r2',
            'storage_key' => 'gallery/photo.jpg',
        ]);

        $items = (new MediaService())->list(null, ['health' => 'needs_attention']);

        $this->assertCount(1, $items);
        $this->assertSame($attentionId, $items[0]['id']);
        $this->assertTrue(in_array('small_hero', $items[0]['diagnostic_codes'], true));
        $this->assertTrue(in_array('unusual_aspect', $items[0]['diagnostic_codes'], true));
    }

    public function testGalleryDraftsCanBeCreatedFromBulkUploadedMedia(): void
    {
        $mediaId = $this->env->insertMediaAsset([
            'title' => 'Fresh puppy trim',
            'category' => 'gallery',
            'alt_text' => 'Fresh puppy trim after grooming',
        ]);

        $media = (new MediaService())->find($mediaId);
        $draft = (new GalleryService())->createDraftFromMedia($media);

        $this->assertSame('Fresh puppy trim', $draft['title']);
        $this->assertSame($mediaId, $draft['primary_media_id']);
        $this->assertFalse($draft['is_published']);

        $asset = (new MediaService())->find($mediaId);
        $this->assertSame('/admin/gallery', $asset['usages'][0]['admin_path']);
        $this->assertSame('/#gallery', $asset['usages'][0]['public_path']);
    }

    public function testDuplicateImageUploadReusesExistingMediaAsset(): void
    {
        $adminId = $this->env->seedAdminUser();
        $firstPath = $this->env->uploadDir() . '/first-upload.png';
        $secondPath = $this->env->uploadDir() . '/second-upload.png';
        $image = imagecreatetruecolor(2, 2);
        imagefilledrectangle($image, 0, 0, 1, 1, imagecolorallocate($image, 90, 120, 200));
        imagepng($image, $firstPath);
        if (PHP_VERSION_ID < 80000) {
            imagedestroy($image);
        }
        copy($firstPath, $secondPath);

        $media = new MediaService();
        $first = $media->upload([
            'name' => 'duplicate-dog.png',
            'type' => 'image/png',
            'tmp_name' => $firstPath,
            'error' => UPLOAD_ERR_OK,
            'size' => filesize($firstPath),
        ], $adminId, ['category' => 'gallery', 'alt_text' => 'Small dog']);
        $second = $media->upload([
            'name' => 'duplicate-dog-copy.png',
            'type' => 'image/png',
            'tmp_name' => $secondPath,
            'error' => UPLOAD_ERR_OK,
            'size' => filesize($secondPath),
        ], $adminId, ['category' => 'retail']);

        $this->assertSame($first['id'], $second['id']);
        $this->assertTrue((bool) $second['duplicate_reused']);
        $this->assertStringContainsString('already in the library', $second['message']);

        $rows = Database::fetch('SELECT COUNT(*) AS total FROM media_assets');
        $this->assertSame(1, (int) $rows['total']);
    }

    public function testDocumentMediaHydratesAsAttachment(): void
    {
        $mediaId = $this->env->insertMediaAsset([
            'original_path' => 'attachments/policy-abc123-original.pdf',
            'original_url' => '/uploads/attachments/policy-abc123-original.pdf',
            'mime_type' => 'application/pdf',
            'category' => 'policies',
        ]);

        $asset = (new MediaService())->find($mediaId);

        $this->assertSame('document', $asset['asset_type']);
        $this->assertFalse($asset['is_image']);
        $this->assertSame('local', $asset['storage_provider']);
        $this->assertSame('attachments/policy-abc123-original.pdf', $asset['storage_key']);
        $this->assertSame('/uploads/attachments/policy-abc123-original.pdf', $asset['download_url']);
    }

    public function testLegacyImageMediaWithoutMimeHydratesAsImage(): void
    {
        $mediaId = $this->env->insertMediaAsset([
            'original_path' => 'originals/legacy-photo.jpg',
            'original_url' => '/uploads/originals/legacy-photo.jpg',
            'mime_type' => '',
            'category' => 'gallery',
        ]);

        $asset = (new MediaService())->find($mediaId);

        $this->assertSame('image', $asset['asset_type']);
        $this->assertTrue($asset['is_image']);
        $this->assertNull($asset['download_url']);
    }

    public function testPublicCatalogGroupsPublishedProductsUnderPublishedCategories(): void
    {
        $mediaId = $this->env->insertMediaAsset();
        $retail = new RetailService();

        $publishedCategory = $retail->saveCategory(['name' => 'Boutique Treats', 'is_published' => 1]);
        $hiddenCategory = $retail->saveCategory(['name' => 'Private Backstock', 'is_published' => 0]);

        $retail->saveItem([
            'category_id' => $publishedCategory['id'],
            'name' => 'Blueberry Biscuits',
            'description' => 'Front counter snack',
            'price_cents' => 899,
            'media_id' => $mediaId,
            'is_published' => 1,
            'is_featured' => 1,
        ]);
        $retail->saveItem([
            'category_id' => $publishedCategory['id'],
            'name' => 'Hidden Treat',
            'is_published' => 0,
        ]);
        $retail->saveItem([
            'category_id' => $hiddenCategory['id'],
            'name' => 'Warehouse Only',
            'is_published' => 1,
        ]);

        $public = $retail->publicCatalog();

        $this->assertCount(1, $public['categories']);
        $this->assertSame('Boutique Treats', $public['categories'][0]['name']);
        $this->assertCount(1, $public['categories'][0]['items']);
        $this->assertSame('$8.99', $public['categories'][0]['items'][0]['price_label']);
        $this->assertNotNull($public['categories'][0]['items'][0]['media']);
        $this->assertSame('catalog_only', $public['commerce']['mode']);
        $this->assertFalse($public['commerce']['checkout_enabled']);
    }

    public function testRetailSalesPrepFieldsRoundTripWithoutTurningOnCheckout(): void
    {
        $retail = new RetailService();
        $category = $retail->saveCategory(['name' => 'Boutique Sprays', 'is_published' => 1]);
        $item = $retail->saveItem([
            'category_id' => $category['id'],
            'name' => 'Lavender Coat Mist',
            'sku' => 'lavender-mist-001',
            'price_cents' => 1699,
            'online_sale_status' => 'ready',
            'inventory_status' => 'limited',
            'fulfillment_mode' => 'pickup_only',
            'is_published' => 1,
        ]);

        $admin = $retail->adminCatalog();

        $this->assertSame('LAVENDER-MIST-001', $item['sku']);
        $this->assertSame('ready', $item['online_sale_status']);
        $this->assertSame('limited', $item['inventory_status']);
        $this->assertSame('pickup_only', $item['fulfillment_mode']);
        $this->assertSame('catalog_only', $admin['commerce']['mode']);
        $this->assertFalse($admin['commerce']['checkout_enabled']);
        $this->assertSame('Catalog only for now', $admin['product_options']['online_sale_status'][0]['label']);
    }
}
