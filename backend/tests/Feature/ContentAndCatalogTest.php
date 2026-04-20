<?php

declare(strict_types=1);

namespace BowWowSpa\Tests\Feature;

use BowWowSpa\Services\ServiceCatalogService;
use BowWowSpa\Services\SiteContentService;
use BowWowSpa\Tests\TestCase;

final class ContentAndCatalogTest extends TestCase
{
    public function testServiceCatalogSanitizesDescriptionsAndCalculatesSelection(): void
    {
        $catalog = new ServiceCatalogService();

        $bath = $catalog->save([
            'name' => 'Bath & Brush',
            'description' => '<p>Clean coat</p><script>alert(1)</script>',
            'duration_minutes' => 45,
            'price_label' => '$45+',
            'is_active' => 1,
        ]);
        $nails = $catalog->save([
            'name' => 'Nail Trim',
            'description' => '<p>Quick add-on</p>',
            'duration_minutes' => 15,
            'price_label' => '$15',
            'is_active' => 0,
        ]);

        $selection = $catalog->calculateSelection([$bath['id']], 2);
        $active = $catalog->list(true);
        $ordered = $catalog->findMany([$nails['id'], $bath['id']]);
        $activeNames = array_column($active, 'name');

        $this->assertStringContainsString('Bath & Brush', implode(' | ', $activeNames));
        $this->assertFalse(in_array('Nail Trim', $activeNames, true), 'Inactive services should not appear in the active catalog.');
        $this->assertStringNotContainsString('<script', (string) $bath['description']);
        $this->assertSame(90, $selection['total_duration_minutes']);
        $this->assertSame([$nails['id'], $bath['id']], array_column($ordered, 'id'));
    }

    public function testSiteContentSnapshotSanitizesHtmlAndRespectsSectionToggles(): void
    {
        $content = new SiteContentService();
        $content->saveBlocks([
            'hero' => [
                'subheading' => '<p>Calm grooming</p><script>alert(1)</script><a href="javascript:alert(1)">Unsafe</a><a href="https://example.com" target="_blank">Safe</a>',
            ],
            'retail' => [
                'enabled' => false,
                'title' => 'Shop',
                'body' => '<p>Fresh products</p><iframe src="https://example.com/embed"></iframe>',
            ],
            'footer' => [
                'enabled' => false,
                'tagline' => 'Footer hidden for now',
            ],
        ]);

        $snapshot = $content->getSiteSnapshot();
        $heroHtml = (string) $snapshot['sections']['hero']['subheading'];
        $retailHtml = (string) $snapshot['sections']['retail']['body'];

        $this->assertFalse((bool) $snapshot['sections']['retail']['enabled']);
        $this->assertFalse((bool) $snapshot['sections']['footer']['enabled']);
        $this->assertStringNotContainsString('<script', $heroHtml);
        $this->assertStringNotContainsString('javascript:', $heroHtml);
        $this->assertStringContainsString('https://example.com', $heroHtml);
        $this->assertStringNotContainsString('<iframe', $retailHtml);
    }
}
