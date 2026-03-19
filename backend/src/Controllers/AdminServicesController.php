<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use BowWowSpa\Http\Request;
use BowWowSpa\Http\Response;
use BowWowSpa\Services\AuthService;
use BowWowSpa\Services\ServiceCatalogService;

final class AdminServicesController
{
    public function __construct(
        private readonly AuthService $auth = new AuthService(),
        private readonly ServiceCatalogService $services = new ServiceCatalogService(),
    ) {
    }

    public function index(): void
    {
        $this->auth->ensureSectionAccess('services');
        Response::success(['items' => $this->services->list()]);
    }

    public function save(Request $request): void
    {
        $this->auth->ensureSectionAccess('services');

        try {
            $service = $this->services->save($request->body);
        } catch (\Throwable $e) {
            Response::error('service_error', $e->getMessage(), 422);
        }

        Response::success($service);
    }
}
