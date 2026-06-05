<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use BowWowSpa\Http\Request;
use BowWowSpa\Http\Response;
use BowWowSpa\Services\AuthService;
use BowWowSpa\Services\GalleryService;
use BowWowSpa\Services\MediaService;

final class AdminMediaController
{
    public function __construct(
        private readonly AuthService $auth = new AuthService(),
        private readonly MediaService $media = new MediaService(),
        private readonly GalleryService $gallery = new GalleryService(),
    ) {
    }

    public function index(Request $request): void
    {
        $this->auth->ensureSectionAccess('media');
        $category = $request->query['category'] ?? null;
        Response::success(['items' => $this->media->list($category, $request->query)]);
    }

    public function upload(): void
    {
        $user = $this->auth->requireAuth();
        $this->auth->ensureSectionAccess('media');
        $files = $this->normalizeFiles($_FILES['files'] ?? null);
        if ($files !== []) {
            $category = strtolower((string) ($_POST['category'] ?? 'default'));
            if (!in_array($category, ['default', 'gallery'], true)) {
                Response::error('validation_error', 'Bulk upload is available for Default and Gallery images only.', 422);
            }

            $items = [];
            $galleryDrafts = [];
            $messages = [];
            $createGalleryDrafts = $category === 'gallery' && !empty($_POST['create_gallery_drafts']);
            foreach ($files as $file) {
                try {
                    $asset = $this->media->upload($file, $user['id'], [
                        'category' => $category,
                    ]);
                    if (!empty($asset['message'])) {
                        $messages[] = $asset['message'];
                    }
                    $items[] = $asset;
                    if ($createGalleryDrafts && !empty($asset['is_image'])) {
                        $galleryDrafts[] = $this->gallery->createDraftFromMedia($asset);
                    }
                } catch (\Throwable $e) {
                    Response::error('upload_error', $e->getMessage(), 422);
                }
            }

            Response::success([
                'items' => $items,
                'gallery_drafts' => $galleryDrafts,
                'messages' => array_values(array_unique($messages)),
            ]);
        }

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

        Response::success([
            'media' => $asset,
            'message' => $asset['message'] ?? null,
        ]);
    }

    public function update(Request $request): void
    {
        $this->auth->ensureSectionAccess('media');
        $id = isset($request->params['id']) ? (int) $request->params['id'] : 0;
        if (!$id) {
            Response::error('validation_error', 'ID required', 422);
        }

        $asset = $this->media->update($id, $request->body);
        if ($asset === null) {
            Response::error('media_error', 'Media item not found.', 404);
        }

        Response::success(['media' => $asset]);
    }

    public function usages(Request $request): void
    {
        $this->auth->ensureSectionAccess('media');
        $id = isset($request->params['id']) ? (int) $request->params['id'] : 0;
        if (!$id) {
            Response::error('validation_error', 'ID required', 422);
        }

        Response::success(['usages' => $this->media->usages($id)]);
    }

    public function replace(Request $request): void
    {
        $this->auth->ensureSectionAccess('media');
        $id = isset($request->params['id']) ? (int) $request->params['id'] : 0;
        $replacementId = isset($request->body['replacement_media_id']) ? (int) $request->body['replacement_media_id'] : 0;
        if (!$id || !$replacementId) {
            Response::error('validation_error', 'Choose the image to replace and the replacement image.', 422);
        }

        try {
            $result = $this->media->replace($id, $replacementId);
        } catch (\RuntimeException $e) {
            Response::error('media_error', $e->getMessage(), 422);
        }

        Response::success($result);
    }

    public function delete(Request $request): void
    {
        $this->auth->ensureSectionAccess('media');
        $id = isset($request->params['id']) ? (int) $request->params['id'] : 0;
        if (!$id) {
            Response::error('validation_error', 'ID required', 422);
        }

        try {
            $this->media->delete($id);
        } catch (\RuntimeException $e) {
            Response::error('media_error', $e->getMessage(), 422);
        }

        Response::success(['deleted' => true]);
    }

    private function normalizeFiles(?array $input): array
    {
        if (!$input || !isset($input['name'])) {
            return [];
        }

        if (!is_array($input['name'])) {
            return [$input];
        }

        $files = [];
        foreach ($input['name'] as $index => $name) {
            if (($input['error'][$index] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
                continue;
            }

            $files[] = [
                'name' => $name,
                'type' => $input['type'][$index] ?? null,
                'tmp_name' => $input['tmp_name'][$index] ?? null,
                'error' => $input['error'][$index] ?? UPLOAD_ERR_NO_FILE,
                'size' => $input['size'][$index] ?? 0,
            ];
        }

        return $files;
    }
}
