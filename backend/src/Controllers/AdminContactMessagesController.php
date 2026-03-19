<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use BowWowSpa\Http\Response;
use BowWowSpa\Services\AuthService;
use BowWowSpa\Services\ContactService;

final class AdminContactMessagesController
{
    public function __construct(
        private readonly AuthService $auth = new AuthService(),
        private readonly ContactService $contacts = new ContactService(),
    ) {
    }

    public function index(): void
    {
        $this->auth->ensureSectionAccess('contact_messages');
        Response::success(['items' => $this->contacts->listMessages()]);
    }
}
