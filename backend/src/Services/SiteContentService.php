<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;

final class SiteContentService
{
    private array $defaultSettings = [
        'business_name' => "Bow Wow's Dog Spa & Boutique",
        'serving_area' => 'Proudly serving Lexington & Davidson County',
        'address' => '123 Bark Avenue, Lexington, NC 27292',
        'phone' => '(336) 555-9663',
        'email' => 'info@bowwowsspa.com',
        'hours' => 'Mon-Fri 8a-6p · Sat 9a-5p · Sun by special appointment',
        'social_facebook' => '@BowWowsSpa',
        'social_instagram' => '@BowWowsSpaLexington',
    ];

    private array $defaultSections = [
        'hero' => [
            'enabled' => true,
            'headline' => 'Where Every Dog is Pampered Like Royalty',
            'subheading' => '<p>Premium grooming services and carefully curated pet products for the four-legged members of your family. Experience the Bow Wow’s difference where luxury meets love.</p>',
            'cta_text' => 'Book Appointment',
            'cta_secondary' => 'View Services',
        ],
        'services' => [
            'enabled' => true,
            'intro' => 'Signature spa experiences tailored to every breed, coat, and personality.',
            'grooming' => 'Full-service grooming tailored to each pup.',
            'baths' => 'Spa baths with premium shampoos.',
            'play' => 'Supervised free roam and calm suites.',
            'cards' => [
                [
                    'title' => 'Signature Spa Package',
                    'price' => '$65+',
                    'description' => '<p>Our complete luxury grooming experience with hypoallergenic products, styling, and finishing touches.</p>',
                    'bullets' => [
                        'Luxury bath + blowout',
                        'Breed-specific cut & styling',
                        'Nail trim, ear care, teeth brushing',
                    ],
                ],
                [
                    'title' => 'Bath & Brush Deluxe',
                    'price' => '$45+',
                    'description' => '<p>Deep cleansing and coat conditioning refresh between full grooms.</p>',
                    'bullets' => [
                        'Premium shampoo + conditioner',
                        'Deshedding brush-out',
                        'Paw pad moisturizing treatment',
                    ],
                ],
                [
                    'title' => 'Pawdicure & Facial',
                    'price' => '$25+',
                    'description' => '<p>Quick refresh for paws, nails, and face to keep pups photo ready.</p>',
                    'bullets' => [
                        'Nail trim & filing',
                        'Blueberry facial & tear stain care',
                        'Paw massage + moisturizing',
                    ],
                ],
            ],
        ],
        'booking' => [
            'enabled' => true,
            'intro' => 'Select a preferred date and time below. Each appointment request is held exclusively for 24 hours while our team confirms availability.',
        ],
        'gallery' => [
            'enabled' => true,
            'title' => 'Happy Clients & Glow-Ups',
        ],
        'retail' => [
            'enabled' => true,
            'title' => 'Boutique Retail',
            'body' => 'Curated spa essentials, healthy treats, and locally-made gifts you will not find in big-box stores.',
        ],
        'about' => [
            'enabled' => true,
            'title' => 'Meet Bow Wow’s Dog Spa & Boutique',
            'body' => '<p>We are a woman-owned, neighborhood grooming studio that pairs spa-quality treatments with genuine Southern hospitality. Our certified groomers tailor each service to your dog’s coat, energy level, and sensitivities so every visit feels like a treat.</p><p>From senior dogs that need extra patience to puppies experiencing their first bath, we promise gentle handling, premium products, and a calming environment that feels like home.</p>',
        ],
        'faq' => [
            'enabled' => true,
            'items' => [
                ['question' => 'Do you take walk-ins?', 'answer' => 'Appointments ensure 1:1 attention; call us for last-minute availability and we will do our best to help.'],
                ['question' => 'What vaccinations do you require?', 'answer' => 'We ask for current rabies, distemper, and bordetella vaccinations before your first visit. Please bring records so we can keep them on file.'],
                ['question' => 'Do you work with anxious or senior dogs?', 'answer' => 'Absolutely. We schedule longer appointments, build in breaks, and adapt our process to keep sensitive pups comfortable.'],
            ],
        ],
        'policies' => [
            'enabled' => true,
            'items' => [
                ['title' => 'Vaccinations', 'body' => 'We require rabies, distemper, and bordetella vaccinations for the safety of every guest.'],
                ['title' => 'Cancellations', 'body' => 'Need to reschedule? Please let us know 24 hours in advance so we can offer the slot to another family.'],
                ['title' => 'Late Arrivals', 'body' => 'Arriving more than 15 minutes late may require rescheduling to preserve the stress-free environment.'],
            ],
        ],
        'location' => [
            'enabled' => true,
            'note' => 'Find us in historic Downtown Lexington—just minutes from Uptown, serving Davidson County and the Winston-Salem metro.',
        ],
        'contact' => [
            'enabled' => true,
            'note' => 'Call, email, or DM us on social—we love answering grooming questions and welcoming new pups to the Bow Wow’s family.',
        ],
        'terms' => [
            'enabled' => true,
            'items' => [
                ['title' => 'Standard Terms', 'body' => 'All appointments follow our posted policies.'],
            ],
        ],
        'privacy' => [
            'enabled' => true,
            'items' => [
                ['title' => 'Privacy', 'body' => 'We only use your information to provide services.'],
            ],
        ],
    ];

    private array $listSections = ['faq', 'policies', 'terms', 'privacy'];

    public function __construct(private readonly MediaService $media = new MediaService())
    {
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
            } else {
                $blocks[$key] = array_merge($defaults, $blocks[$key]);
            }
            if (!isset($blocks[$key]['enabled'])) {
                $blocks[$key]['enabled'] = true;
            }
        }

        $gallery = Database::fetchAll('SELECT * FROM happy_clients WHERE is_published = 1 ORDER BY sort_order ASC, created_at DESC');
        foreach ($gallery as &$entry) {
            $entry['before_media'] = $entry['before_media_id'] ? $this->media->find((int) $entry['before_media_id']) : null;
            $entry['after_media'] = $entry['after_media_id'] ? $this->media->find((int) $entry['after_media_id']) : null;
        }
        unset($entry);

        $retail = Database::fetchAll('SELECT * FROM retail_items WHERE is_published = 1 ORDER BY sort_order ASC, created_at DESC');
        foreach ($retail as &$item) {
            $item['media'] = $item['media_id'] ? $this->media->find((int) $item['media_id']) : null;
        }
        unset($item);

        return [
            'settings' => $settings,
            'sections' => $blocks,
            'faqs' => $blocks['faq']['items'] ?? [],
            'policies' => $blocks['policies']['items'] ?? [],
            'happy_clients' => $gallery,
            'retail' => $retail,
        ];
    }

    public function saveSettings(array $settings): void
    {
        foreach ($settings as $key => $value) {
            Database::run(
                'INSERT INTO site_settings (`key`, `value`) VALUES (:key, :value)
                 ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
                ['key' => $key, 'value' => (string) $value]
            );
        }
    }

    public function saveBlocks(array $blocks): void
    {
        foreach ($blocks as $key => $content) {
            $normalized = $this->normalizeSection($key, $content);
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
                $value = [
                    'items' => array_values($value),
                ];
            } else {
                $value['items'] = [];
            }
        }

        $value['enabled'] = $enabled;
        return $value;
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
