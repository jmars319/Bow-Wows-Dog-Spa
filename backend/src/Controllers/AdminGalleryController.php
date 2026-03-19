<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use BowWowSpa\Http\Request;
use BowWowSpa\Http\Response;
use BowWowSpa\Services\AuthService;
use BowWowSpa\Services\GalleryService;

final class AdminGalleryController
{
    public function __construct(
        private readonly AuthService $auth = new AuthService(),
        private readonly GalleryService $gallery = new GalleryService(),
    ) {
    }

    public function index(): void
    {
        $this->auth->ensureSectionAccess('gallery');
        Response::success(['items' => $this->gallery->list()]);
    }

    public function save(Request $request): void
    {
        $this->auth->ensureSectionAccess('gallery');

        try {
            $item = $this->gallery->save($request->body);
        } catch (\Throwable $e) {
            Response::error('gallery_error', $e->getMessage(), 422);
        }

        Response::success($item);
    }
}
