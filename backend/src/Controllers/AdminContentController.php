<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use BowWowSpa\Http\Request;
use BowWowSpa\Http\Response;
use BowWowSpa\Services\AuthService;
use BowWowSpa\Services\SiteContentService;

final class AdminContentController
{
    public function __construct(
        private readonly AuthService $auth = new AuthService(),
        private readonly SiteContentService $content = new SiteContentService(),
    ) {
    }

    public function site(): void
    {
        $this->auth->ensureSectionAccess('content');
        Response::success($this->content->getSiteSnapshot());
    }

    public function saveSite(Request $request): void
    {
        $this->auth->ensureSectionAccess('content');
        $this->content->saveSettings($request->body['settings'] ?? []);
        $this->content->saveBlocks($request->body['sections'] ?? []);
        Response::success(['saved' => true]);
    }
}
