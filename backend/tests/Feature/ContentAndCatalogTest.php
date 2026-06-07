<?php

declare(strict_types=1);

namespace BowWowSpa\Tests\Feature;

use BowWowSpa\Services\AdminUserService;
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

    public function testServiceCatalogCanHideShowAndRemoveServices(): void
    {
        $catalog = new ServiceCatalogService();
        $service = $catalog->save([
            'name' => 'Seasonal Shed Treatment',
            'short_summary' => 'Spring coat support',
            'duration_minutes' => 30,
            'price_label' => '$35+',
            'is_active' => 1,
        ]);

        $hidden = $catalog->setActive((int) $service['id'], false);
        $this->assertFalse((bool) $hidden['is_active']);
        $activeNames = array_column($catalog->list(true), 'name');
        $this->assertFalse(
            in_array('Seasonal Shed Treatment', $activeNames, true),
            'Hidden services should not appear in public active lists.'
        );

        $visible = $catalog->setActive((int) $service['id'], true);
        $this->assertTrue((bool) $visible['is_active']);

        $catalog->delete((int) $service['id']);
        $this->assertNull($catalog->find((int) $service['id']));
    }

    public function testAdminUserCanChangeOwnPasswordWithCurrentPassword(): void
    {
        $adminId = $this->env->seedAdminUser([
            'password_hash' => password_hash('old-password', PASSWORD_DEFAULT),
        ]);

        $users = new AdminUserService();
        $users->changePassword($adminId, 'old-password', 'new-password');

        $row = $this->env->pdo()
            ->query('SELECT password_hash FROM admin_users WHERE id = ' . (int) $adminId)
            ->fetch();

        $this->assertTrue(password_verify('new-password', (string) $row['password_hash']));
        $this->assertThrows(fn () => $users->changePassword($adminId, 'old-password', 'another-password'), 'Current password is incorrect');
        $this->assertThrows(fn () => $users->changePassword($adminId, 'new-password', 'short'), 'at least 8 characters');
    }

    public function testSiteContentSnapshotSanitizesHtmlAndRespectsSectionToggles(): void
    {
        $content = new SiteContentService();
        $content->saveBlocks([
            'hero' => [
                'subheading' => '<p class="ql-align-center" onclick="alert(1)">Calm grooming</p><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">Unsafe</a><a href="https://example.com" target="_blank">Safe</a>',
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
        $this->assertStringNotContainsString('<img', $heroHtml);
        $this->assertStringNotContainsString('onclick', $heroHtml);
        $this->assertStringNotContainsString('ql-align-center', $heroHtml);
        $this->assertStringNotContainsString('javascript:', $heroHtml);
        $this->assertStringContainsString('<p>Calm grooming</p>', $heroHtml);
        $this->assertStringContainsString('https://example.com', $heroHtml);
        $this->assertStringContainsString('rel="noopener noreferrer"', $heroHtml);
        $this->assertStringNotContainsString('<iframe', $retailHtml);
    }

    public function testHomepageSectionOrderNormalizesSavedMiddleSections(): void
    {
        $content = new SiteContentService();
        $content->saveBlocks([
            'homepage_order' => [
                'items' => ['contact', 'booking', 'services', 'unknown-section', 'contact'],
            ],
        ]);

        $snapshot = $content->getSiteSnapshot();
        $items = $snapshot['sections']['homepage_order']['items'];

        $this->assertSame(['contact', 'booking', 'services'], array_slice($items, 0, 3));
        $this->assertFalse(in_array('unknown-section', $items, true));
        $this->assertSame(10, count($items));
        $this->assertSame(array_values(array_unique($items)), $items);
        $this->assertTrue(in_array('policies', $items, true));
    }
}
