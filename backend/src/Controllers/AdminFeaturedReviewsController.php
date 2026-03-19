<?php

declare(strict_types=1);

namespace BowWowSpa\Controllers;

use BowWowSpa\Http\Request;
use BowWowSpa\Http\Response;
use BowWowSpa\Services\AuthService;
use BowWowSpa\Services\FeaturedReviewService;

final class AdminFeaturedReviewsController
{
    public function __construct(
        private readonly AuthService $auth = new AuthService(),
        private readonly FeaturedReviewService $reviews = new FeaturedReviewService(),
    ) {
    }

    public function index(): void
    {
        $this->auth->ensureSectionAccess('reviews');
        Response::success(['items' => $this->reviews->list()]);
    }

    public function save(Request $request): void
    {
        $this->auth->ensureSectionAccess('reviews');

        try {
            $review = $this->reviews->save($request->body);
        } catch (\Throwable $e) {
            Response::error('review_error', $e->getMessage(), 422);
        }

        Response::success($review);
    }
}
