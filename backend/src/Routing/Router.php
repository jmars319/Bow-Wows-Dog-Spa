<?php

declare(strict_types=1);

namespace BowWowSpa\Routing;

use BowWowSpa\Http\Request;
use BowWowSpa\Http\Response;
use Jamarq\CpanelBackend\Http\Request as KitRequest;
use Jamarq\CpanelBackend\Routing\Router as KitRouter;

final class Router
{
    private KitRouter $router;

    public function __construct()
    {
        $this->router = new KitRouter();
    }

    public function add(string $method, string $path, callable $handler): void
    {
        $this->router->add($method, $path, function (KitRequest $kitRequest, array $params) use ($handler): void {
            $request = $kitRequest->attribute('bowwowRequest');
            if (!$request instanceof Request) {
                Response::error('bad_request', 'Request context was unavailable.', 500);
            }

            $handler($request->withParams($params));
        });
    }

    public function dispatch(Request $request): void
    {
        $kitRequest = new KitRequest(
            $request->method,
            $request->path,
            $request->query,
            $request->headers,
            json_encode($request->body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '',
            $request->files,
            [],
            $request->server
        );

        $response = $this->router->dispatch($kitRequest->withAttribute('bowwowRequest', $request));
        if ($response->getStatus() !== 404) {
            $response->send();
            exit;
        }

        Response::error('not_found', 'Endpoint not found.', 404);
    }
}
