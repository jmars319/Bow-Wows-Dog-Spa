<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;
use BowWowSpa\Support\EmailContentFormatter;
use BowWowSpa\Support\Input;

final class ContactService
{
    public function __construct(private readonly EmailService $emails = new EmailService())
    {
    }

    public function listMessages(): array
    {
        return Database::fetchAll('SELECT * FROM contact_messages ORDER BY created_at DESC, id DESC LIMIT 250');
    }

    public function handle(array $payload): void
    {
        $name = Input::clean($payload['name'] ?? null, 191);
        $email = Input::email($payload['email'] ?? null);
        $phone = Input::phone($payload['phone'] ?? null);
        $message = Input::clean($payload['message'] ?? null, 5000, true);

        if ($name === null || $email === null || $message === null) {
            throw new \RuntimeException('Please provide a valid name, email, and message.');
        }

        Database::insert(
            'INSERT INTO contact_messages (name, email, phone, message, created_at) VALUES (:name, :email, :phone, :message, NOW())',
            [
                'name' => $name,
                'email' => $email,
                'phone' => $phone !== '' ? $phone : null,
                'message' => $message,
            ]
        );

        $details = EmailContentFormatter::detailsTable([
            'Name' => $name,
            'Email' => $email,
            'Phone' => $phone !== '' ? $phone : null,
        ]);

        $body = '<p><strong>New website contact message.</strong></p>'
            . $details
            . '<p style="margin-top:16px;"><strong>Message</strong></p>'
            . '<p>' . nl2br(htmlspecialchars($message, ENT_QUOTES, 'UTF-8')) . '</p>'
            . '<p style="margin-top:16px;">Reply directly to answer this customer.</p>';

        $this->emails->notifyStaff(
            'New website contact message',
            $body,
            [
                'reply_to' => [
                    'email' => $email,
                    'name' => $name !== '' ? $name : $email,
                ],
            ]
        );
    }
}
