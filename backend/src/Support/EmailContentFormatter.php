<?php

declare(strict_types=1);

namespace BowWowSpa\Support;

final class EmailContentFormatter
{
    public static function detailsTable(array $rows): string
    {
        $html = '<table style="width:100%;border-collapse:collapse;margin-top:20px;background:#FFFFFF;">';
        foreach ($rows as $label => $value) {
            if ($value === null) {
                continue;
            }
            $stringValue = trim((string) $value);
            if ($stringValue === '') {
                continue;
            }

            $html .= sprintf(
                '<tr><th style="text-align:left;padding:8px 12px;font-size:14px;color:#5F6F6F;width:40%%;background:#F1F3F2;">%s</th>' .
                '<td style="padding:8px 12px;font-size:15px;color:#2F3A3A;">%s</td></tr>',
                htmlspecialchars((string) $label, ENT_QUOTES, 'UTF-8'),
                nl2br(htmlspecialchars($stringValue, ENT_QUOTES, 'UTF-8'))
            );
        }
        $html .= '</table>';

        return $html;
    }

    public static function formatServices(?array $services): string
    {
        if (!$services) {
            return 'Not specified';
        }

        $entries = [];
        foreach ($services as $service) {
            if (is_string($service)) {
                $label = trim($service);
                if ($label !== '') {
                    $entries[] = $label;
                }
                continue;
            }

            if (!is_array($service)) {
                continue;
            }

            $title = trim((string) ($service['title'] ?? ''));
            $desc = trim((string) ($service['description'] ?? ''));
            $label = $title;
            if ($desc !== '') {
                $label .= ($label !== '' ? ' — ' : '') . $desc;
            }
            if ($label !== '') {
                $entries[] = $label;
            }
        }

        return $entries ? implode('; ', $entries) : 'Not specified';
    }
}
