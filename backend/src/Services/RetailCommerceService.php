<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;

final class RetailCommerceService
{
    private const DEFAULT_MODE = 'catalog_only';
    private const DEFAULT_CURRENCY = 'USD';
    private const DEFAULT_PROVIDER = '';

    private const MODE_LABELS = [
        'catalog_only' => 'Catalog only',
        'coming_soon' => 'Online ordering coming soon',
        'live' => 'Online ordering live',
    ];

    public function publicSnapshot(): array
    {
        $settings = $this->loadSettings();

        return [
            'mode' => $settings['mode'],
            'mode_label' => self::MODE_LABELS[$settings['mode']] ?? self::MODE_LABELS[self::DEFAULT_MODE],
            'currency' => $settings['currency'],
            'provider' => $settings['provider'],
            'checkout_enabled' => $settings['mode'] === 'live',
        ];
    }

    public function adminSnapshot(): array
    {
        $snapshot = $this->publicSnapshot();

        return $snapshot + [
            'mode_options' => $this->modeOptions(),
        ];
    }

    public function modeOptions(): array
    {
        $options = [];
        foreach (self::MODE_LABELS as $value => $label) {
            $options[] = [
                'value' => $value,
                'label' => $label,
            ];
        }

        return $options;
    }

    private function loadSettings(): array
    {
        $row = Database::fetchAll(
            'SELECT `key`, `value`
             FROM site_settings
             WHERE `key` IN ("commerce_mode", "commerce_currency", "commerce_provider")'
        );

        $settings = [
            'mode' => self::DEFAULT_MODE,
            'currency' => self::DEFAULT_CURRENCY,
            'provider' => self::DEFAULT_PROVIDER,
        ];

        foreach ($row as $item) {
            $key = (string) ($item['key'] ?? '');
            $value = trim((string) ($item['value'] ?? ''));

            if ($key === 'commerce_mode' && isset(self::MODE_LABELS[$value])) {
                $settings['mode'] = $value;
                continue;
            }

            if ($key === 'commerce_currency' && preg_match('/^[A-Z]{3}$/', strtoupper($value)) === 1) {
                $settings['currency'] = strtoupper($value);
                continue;
            }

            if ($key === 'commerce_provider') {
                $settings['provider'] = $value;
            }
        }

        return $settings;
    }
}
