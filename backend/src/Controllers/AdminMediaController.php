<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use BowWowSpa\Http\Request;
use BowWowSpa\Http\Response;
use BowWowSpa\Services\AuthService;
use BowWowSpa\Services\MediaService;

final class AdminMediaController
{
    public function __construct(
        private readonly AuthService $auth = new AuthService(),
        private readonly MediaService $media = new MediaService(),
    ) {
    }

    public function index(Request $request): void
    {
        $this->auth->ensureSectionAccess('media');
        $category = $request->query['category'] ?? null;
        Response::success(['items' => $this->media->list($category)]);
    }

    public function upload(): void
    {
        $user = $this->auth->requireAuth();
        $this->auth->ensureSectionAccess('media');
        if (empty($_FILES['file'])) {
            Response::error('validation_error', 'File missing', 422);
        }

        try {
            $metadata = [
                'alt_text' => $_POST['alt_text'] ?? null,
                'title' => $_POST['title'] ?? null,
                'caption' => $_POST['caption'] ?? null,
                'category' => $_POST['category'] ?? 'default',
            ];
            $asset = $this->media->upload($_FILES['file'], $user['id'], $metadata);
        } catch (\Throwable $e) {
            Response::error('upload_error', $e->getMessage(), 422);
        }

        Response::success(['media' => $asset]);
    }

    public function delete(Request $request): void
    {
        $this->auth->ensureSectionAccess('media');
        $id = isset($request->params['id']) ? (int) $request->params['id'] : 0;
        if (!$id) {
            Response::error('validation_error', 'ID required', 422);
        }
        $this->media->delete($id);
        Response::success(['deleted' => true]);
    }
}
