<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use BowWowSpa\Http\Request;
use BowWowSpa\Http\Response;
use BowWowSpa\Services\AuthService;
use BowWowSpa\Services\RetailService;

final class AdminRetailController
{
    public function __construct(
        private readonly AuthService $auth = new AuthService(),
        private readonly RetailService $retail = new RetailService(),
    ) {
    }

    public function index(): void
    {
        $this->auth->ensureSectionAccess('retail');
        Response::success($this->retail->adminCatalog());
    }

    public function saveItem(Request $request): void
    {
        $this->auth->ensureSectionAccess('retail');
        try {
            $item = $this->retail->saveItem($request->body);
        } catch (\RuntimeException $e) {
            Response::error('retail_error', $e->getMessage(), 422);
        }

        Response::success(['item' => $item]);
    }

    public function saveCategory(Request $request): void
    {
        $this->auth->ensureSectionAccess('retail');

        try {
            $category = $this->retail->saveCategory($request->body);
        } catch (\RuntimeException $e) {
            Response::error('retail_error', $e->getMessage(), 422);
        }

        Response::success(['category' => $category]);
    }

    public function deleteCategory(Request $request): void
    {
        $this->auth->ensureSectionAccess('retail');
        $id = isset($request->params['id']) ? (int) $request->params['id'] : 0;
        if ($id <= 0) {
            Response::error('validation_error', 'Category ID required.', 422);
        }

        try {
            $this->retail->deleteCategory($id);
        } catch (\RuntimeException $e) {
            Response::error('retail_error', $e->getMessage(), 422);
        }

        Response::success(['deleted' => true]);
    }

    public function deleteItem(Request $request): void
    {
        $this->auth->ensureSectionAccess('retail');
        $id = isset($request->params['id']) ? (int) $request->params['id'] : 0;
        if ($id <= 0) {
            Response::error('validation_error', 'Product ID required.', 422);
        }

        $this->retail->deleteItem($id);
        Response::success(['deleted' => true]);
    }
}
