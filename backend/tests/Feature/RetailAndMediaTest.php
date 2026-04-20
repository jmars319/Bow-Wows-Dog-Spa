<?php

declare(strict_types=1);

namespace BowWowSpa\Tests\Feature;

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
        $this->assertThrows(fn () => $media->delete($mediaId), 'still being used by 1 product');

        $retail->deleteItem($item['id']);
        $media->delete($mediaId);

        $this->assertNull($media->find($mediaId));
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
