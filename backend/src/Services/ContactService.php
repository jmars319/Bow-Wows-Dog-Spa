<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;
use BowWowSpa\Support\EmailContentFormatter;

final class ContactService
{
    public function __construct(private readonly EmailService $emails = new EmailService())
    {
    }

    public function handle(array $payload): void
    {
        Database::insert(
            'INSERT INTO contact_messages (name, email, phone, message, created_at) VALUES (:name, :email, :phone, :message, NOW())',
            [
                'name' => $payload['name'],
                'email' => $payload['email'],
                'phone' => $payload['phone'],
                'message' => $payload['message'],
            ]
        );

        $details = EmailContentFormatter::detailsTable([
            'Name' => $payload['name'],
            'Email' => $payload['email'],
            'Phone' => $payload['phone'],
        ]);

        $body = '<p>A new contact message was submitted on the website.</p>'
            . $details
            . '<p style="margin-top:16px;">' . nl2br(htmlspecialchars($payload['message'], ENT_QUOTES, 'UTF-8')) . '</p>';

        $this->emails->notifyStaff('New contact from website', $body);
    }
}
