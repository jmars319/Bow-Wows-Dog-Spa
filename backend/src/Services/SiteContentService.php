<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;
use BowWowSpa\Support\Input;

final class SiteContentService
{
    private array $defaultSettings = [
        'business_name' => "Bow Wow's Dog Spa",
        'serving_area' => 'Proudly serving Greater Winston-Salem and the Triad area',
        'address' => '11141 Old U.S. Hwy 52 #4, Winston-Salem, NC 27107',
        'phone' => '(336) 842-3723',
        'email' => 'bowwowsdogspa@gmail.com',
        'hours' => 'Mon-Thurs 10a-5p · Fri, Sat by special appointment',
        'social_facebook' => '',
        'social_instagram' => '',
        'maps_url' => '',
        'google_reviews_url' => '',
        'google_review_rating' => '',
        'google_review_count' => '',
    ];

    private array $defaultSections = [
        'hero' => [
            'enabled' => true,
            'eyebrow' => 'Calm neighborhood grooming care',
            'headline' => 'Comfort-first grooming care for dogs across Greater Winston-Salem and the Triad.',
            'subheading' => '<p>Bow Wow’s Dog Spa provides appointment-based grooming and bath care for families looking for a calm, reliable experience.</p><p>Request a visit online, then our team will review the details and follow up directly.</p>',
            'cta_text' => 'Request Appointment',
            'cta_secondary' => 'View Services',
        ],
        'trust' => [
            'enabled' => true,
            'title' => 'Why local families choose Bow Wow’s',
            'intro' => 'Clear communication, thoughtful handling, and a tidy boutique environment from drop-off to pick-up.',
            'points' => [
                ['title' => 'Appointment-based care', 'text' => 'Focused visits keep the experience calmer and easier on sensitive dogs.'],
                ['title' => 'Comfort-focused handling', 'text' => 'We work gently, communicate clearly, and adjust for first-timers, seniors, and nervous pups.'],
                ['title' => 'Serving Greater Winston-Salem & the Triad', 'text' => 'A neighborhood dog spa with boutique-level attention and approachable service.'],
            ],
        ],
        'services' => [
            'enabled' => true,
            'title' => 'Clear service options with transparent starting prices',
            'intro' => 'Choose the care that fits your dog best. Starting prices are shown so you can plan with confidence before you request an appointment.',
            'disclaimer' => 'Final pricing may vary based on size, coat condition, matting, temperament, and special handling needs.',
        ],
        'booking' => [
            'enabled' => true,
            'title' => 'Simple, service-aware booking built for phones',
            'intro' => 'Select services first, then choose from time buttons that match the total appointment length.',
            'notice' => 'This is a request. Our team reviews every appointment and confirms within 24 hours.',
            'availability_note' => 'Available times are based on selected services and number of dogs.',
        ],
        'gallery' => [
            'enabled' => true,
            'title' => 'Fresh from the spa',
            'intro' => 'Happy, clean, well-cared-for dogs and a boutique setting that feels calm from the moment you arrive.',
        ],
        'reviews' => [
            'enabled' => true,
            'title' => 'Google reviews and neighborhood trust',
            'intro' => 'Featured notes below are selected from real customer reviews. For the full review history, visit our Google profile.',
            'cta_text' => 'See All Google Reviews',
        ],
        'about' => [
            'enabled' => true,
            'title' => 'Comfort-first care',
            'body' => '<p>We believe a great groom starts with a calm environment, patient handling, and clear communication. Every visit is shaped around what helps your dog feel most comfortable while still getting the care they need.</p><p>That means thoughtful scheduling, honest recommendations, and boutique-level attention without the cold luxury feel. We want families to feel confident leaving their dogs in our hands.</p>',
        ],
        'faq' => [
            'enabled' => true,
            'title' => 'Helpful answers before you book',
            'items' => [
                ['question' => 'Is online booking instant?', 'answer' => '<p>No. Every request is reviewed by our team so we can confirm the service fit, timing, and any special handling notes before finalizing the appointment.</p>'],
                ['question' => 'Can I bring more than one dog?', 'answer' => '<p>Yes. Add each dog during the booking request so we can account for the total appointment time.</p>'],
                ['question' => 'Do you need vet or vaccine information?', 'answer' => '<p>We strongly encourage including your vet details and any important health or grooming notes so we can review them before confirming.</p>'],
            ],
        ],
        'policies' => [
            'enabled' => true,
            'title' => 'Simple expectations and care notes',
            'items' => [
                ['title' => 'Appointment Requests', 'body' => '<p>Appointments are requested online and confirmed by our staff after review.</p>'],
                ['title' => 'Arrival & Timing', 'body' => '<p>Please arrive on time so we can keep the day calm and on schedule for every dog.</p>'],
                ['title' => 'Health & Comfort Notes', 'body' => '<p>Share any medical, behavior, or grooming concerns during intake so we can plan appropriately.</p>'],
            ],
        ],
        'location' => [
            'enabled' => true,
            'title' => 'Location & hours',
            'note' => 'Call or send a message if you need help choosing a service, planning a first visit, or checking paperwork requirements.',
        ],
        'contact' => [
            'enabled' => true,
            'title' => 'Contact Bow Wow’s',
            'note' => 'Questions about coat care, first visits, or paperwork? Send a note and our team will point you in the right direction.',
        ],
        'footer' => [
            'enabled' => true,
            'tagline' => 'Trusted neighborhood boutique grooming for Greater Winston-Salem and Triad families.',
        ],
        'retail' => [
            'enabled' => false,
            'title' => 'Boutique Retail',
            'body' => '',
        ],
        'terms' => [
            'enabled' => true,
            'title' => 'Terms & Conditions',
            'items' => [
                ['title' => 'Appointments & Services', 'body' => 'Appointment requests, confirmed visits, and grooming services follow our posted policies and any care notes reviewed with your family.'],
            ],
        ],
        'privacy' => [
            'enabled' => true,
            'title' => 'Privacy Policy',
            'items' => [
                ['title' => 'How we use your information', 'body' => 'We use contact, appointment, and pet-care details only to respond to inquiries, review requests, schedule services, and communicate about your dog’s visit.'],
            ],
        ],
    ];

    private array $listSections = ['faq', 'policies', 'terms', 'privacy'];

    public function __construct(
        private readonly MediaService $media = new MediaService(),
        private readonly ServiceCatalogService $services = new ServiceCatalogService(),
        private readonly FeaturedReviewService $reviews = new FeaturedReviewService(),
        private readonly GalleryService $gallery = new GalleryService(),
    ) {
    }

    public function getSiteSnapshot(): array
    {
        $settings = $this->defaultSettings;
        foreach (Database::fetchAll('SELECT `key`, `value` FROM site_settings') as $row) {
            $settings[$row['key']] = $row['value'];
        }

        $blocks = $this->defaultSections;
        foreach (Database::fetchAll('SELECT `key`, content_json FROM content_blocks') as $row) {
            $decoded = json_decode($row['content_json'], true) ?? [];
            $blocks[$row['key']] = $this->normalizeSection($row['key'], $decoded);
        }

        foreach ($this->defaultSections as $key => $defaults) {
            if (!isset($blocks[$key])) {
                $blocks[$key] = $defaults;
                continue;
            }

            $blocks[$key] = $this->mergeSectionDefaults($defaults, $blocks[$key]);
            if (!isset($blocks[$key]['enabled'])) {
                $blocks[$key]['enabled'] = true;
            }
        }

        $galleryItems = $this->gallery->list(true);
        if ($galleryItems === []) {
            $galleryItems = $this->legacyGalleryFallback();
        }

        $retail = Database::fetchAll('SELECT * FROM retail_items WHERE is_published = 1 ORDER BY sort_order ASC, created_at DESC');
        foreach ($retail as &$item) {
            $item['media'] = $item['media_id'] ? $this->media->find((int) $item['media_id']) : null;
        }
        unset($item);

        return [
            'settings' => $settings,
            'sections' => $blocks,
            'services' => $this->services->list(true),
            'featured_reviews' => $this->reviews->list(true),
            'gallery_items' => $galleryItems,
            'faqs' => $blocks['faq']['items'] ?? [],
            'policies' => $blocks['policies']['items'] ?? [],
            'happy_clients' => $galleryItems,
            'retail' => $retail,
        ];
    }

    public function saveSettings(array $settings): void
    {
        $allowed = array_keys($this->defaultSettings);
        foreach ($settings as $key => $value) {
            if (!in_array($key, $allowed, true)) {
                continue;
            }

            $sanitized = match ($key) {
                'email' => Input::email($value, 191),
                'phone' => Input::phone($value, 50),
                'social_facebook', 'social_instagram', 'maps_url', 'google_reviews_url' => Input::url($value, 255),
                'google_review_rating', 'google_review_count' => Input::clean($value, 20),
                default => Input::clean($value, 255, true),
            };

            Database::run(
                'INSERT INTO site_settings (`key`, `value`) VALUES (:key, :value)
                 ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
                ['key' => $key, 'value' => (string) ($sanitized ?? '')]
            );
        }
    }

    public function saveBlocks(array $blocks): void
    {
        $allowed = array_keys($this->defaultSections);
        foreach ($blocks as $key => $content) {
            if (!in_array((string) $key, $allowed, true)) {
                continue;
            }

            $normalized = $this->normalizeSection($key, is_array($content) ? $content : []);
            Database::run(
                'INSERT INTO content_blocks (`key`, content_json) VALUES (:key, :json)
                 ON DUPLICATE KEY UPDATE content_json = VALUES(content_json)',
                ['key' => $key, 'json' => json_encode($normalized)]
            );
        }
    }

    private function normalizeSection(string $key, array $value): array
    {
        $enabled = isset($value['enabled']) ? (bool) $value['enabled'] : true;
        unset($value['enabled']);

        if (in_array($key, $this->listSections, true)) {
            if (isset($value['items']) && is_array($value['items'])) {
                $value['items'] = array_values($value['items']);
            } elseif ($this->isList($value)) {
                $value = ['items' => array_values($value)];
            } else {
                $value['items'] = [];
            }
        }

        if ($key === 'trust') {
            $points = $value['points'] ?? [];
            $value['points'] = is_array($points) ? array_values($points) : [];
        }

        $value['enabled'] = $enabled;
        return $value;
    }

    private function mergeSectionDefaults(array $defaults, array $value): array
    {
        $merged = array_merge($defaults, $value);

        foreach ($defaults as $key => $defaultValue) {
            if (is_array($defaultValue) && isset($value[$key]) && is_array($value[$key]) && !$this->isList($defaultValue)) {
                $merged[$key] = array_merge($defaultValue, $value[$key]);
            }
        }

        return $merged;
    }

    private function legacyGalleryFallback(): array
    {
        $rows = Database::fetchAll('SELECT * FROM happy_clients WHERE is_published = 1 ORDER BY sort_order ASC, created_at DESC');
        $items = [];

        foreach ($rows as $row) {
            $primary = $row['before_media_id'] ? $this->media->find((int) $row['before_media_id']) : null;
            $secondary = $row['after_media_id'] ? $this->media->find((int) $row['after_media_id']) : null;
            $items[] = [
                'id' => (int) $row['id'],
                'title' => (string) $row['title'],
                'caption' => $row['blurb'],
                'item_type' => ($primary && $secondary) ? 'before_after' : 'groomed_pet',
                'primary_media' => $primary,
                'secondary_media' => $secondary,
                'sort_order' => (int) $row['sort_order'],
                'is_published' => (int) $row['is_published'] === 1,
            ];
        }

        return $items;
    }

    private function isList(array $value): bool
    {
        if (function_exists('array_is_list')) {
            return array_is_list($value);
        }

        $i = 0;
        foreach ($value as $key => $_) {
            if ($key !== $i++) {
                return false;
            }
        }

        return true;
    }
}
