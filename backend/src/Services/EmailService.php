<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Support\Config;

final class EmailService
{
    public function send(string $toEmail, string $toName, string $subject, string $html, array $options = []): void
    {
        if (!Config::get('sendgrid.enabled', true)) {
            return;
        }

        $apiKey = Config::get('sendgrid.api_key');
        if (!$apiKey || $apiKey === 'SENDGRID_API_KEY') {
            return;
        }

        $rendered = $this->renderTemplate(
            $options['headline'] ?? $subject,
            $html,
            $options['variant'] ?? 'generic'
        );

        $payload = [
            'personalizations' => [
                [
                    'to' => [
                        ['email' => $toEmail, 'name' => $toName],
                    ],
                    'subject' => $subject,
                ],
            ],
            'from' => [
                'email' => Config::get('sendgrid.from_email'),
                'name' => Config::get('sendgrid.from_name'),
            ],
            'content' => [
                [
                    'type' => 'text/html',
                    'value' => $rendered,
                ],
            ],
        ];

        $ch = curl_init('https://api.sendgrid.com/v3/mail/send');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $apiKey,
                'Content-Type: application/json',
            ],
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_RETURNTRANSFER => true,
        ]);

        curl_exec($ch);
        curl_close($ch);
    }

    public function notifyStaff(string $subject, string $body): void
    {
        $staffRecipients = Config::get('sendgrid.staff_notifications', []);
        foreach ($staffRecipients as $email) {
            $this->send(
                $email,
                'Bow Wow\'s Dog Spa',
                $subject,
                $body,
                [
                    'variant' => 'staff',
                    'headline' => $subject,
                ]
            );
        }
    }

    private function renderTemplate(string $headline, string $body, string $variant): string
    {
        $appUrl = rtrim((string) Config::get('app.url', 'https://bowwowsdogspa.com'), '/');
        $logoUrl = $appUrl . '/current/share-logo.png';
        $accent = $variant === 'staff' ? '#2F3A3A' : '#8FB6B1';
        $eyebrow = $variant === 'staff' ? 'Internal notification · Please review' : 'Bow Wow\'s Dog Spa';

        return <<<HTML
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>{$headline}</title>
  </head>
  <body style="margin:0;padding:0;background:#FAF9F6;font-family:'Inter',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FAF9F6;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#FFFFFF;border-radius:20px;box-shadow:0 20px 40px rgba(47,58,58,0.08);overflow:hidden;">
            <tr>
              <td style="padding:24px;text-align:center;border-bottom:1px solid #E7ECEB;">
                <img src="{$logoUrl}" alt="Bow Wow's Dog Spa" style="max-width:220px;height:auto;">
                <p style="margin:12px 0 0;font-size:12px;letter-spacing:0.25em;text-transform:uppercase;color:#5F6F6F;">{$eyebrow}</p>
                <h1 style="margin:8px 0 0;font-size:24px;color:#2F3A3A;">{$headline}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;font-size:15px;line-height:1.6;color:#2F3A3A;">
                {$body}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;background:{$accent};color:#FFFFFF;font-size:14px;text-align:center;">
                Bow Wow's Dog Spa · bowwowsdogspa.com
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
HTML;
    }
}
