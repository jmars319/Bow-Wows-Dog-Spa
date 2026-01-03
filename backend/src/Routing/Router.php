<?php

declare(strict_types=1);

namespace BowWowSpa\Routing;

use BowWowSpa\Http\Request;
use BowWowSpa\Http\Response;

final class Router
{
    /** @var array<string, array<string, callable>> */
    private array $routes = [];

    /** @var array<string, array<int, array{regex:string, params:array<int,string>, handler:callable}>> */
    private array $patternRoutes = [];

    public function add(string $method, string $path, callable $handler): void
    {
        $method = strtoupper($method);
        $path = $path === '/' ? '/' : rtrim($path, '/');

        if (str_contains($path, '{')) {
            $regex = preg_replace_callback('/\{([a-zA-Z0-9_]+)\}/', function ($matches) {
                return '(?P<' . $matches[1] . '>[^/]+)';
            }, $path);

            $regex = '#^' . $regex . '$#';
            preg_match_all('/\{([a-zA-Z0-9_]+)\}/', $path, $paramMatches);
            $params = $paramMatches[1] ?? [];
            $this->patternRoutes[$method][] = [
                'regex' => $regex,
                'params' => $params,
                'handler' => $handler,
            ];
            return;
        }

        $this->routes[$method][$path] = $handler;
    }

    public function dispatch(Request $request): void
    {
        $methodRoutes = $this->routes[$request->method] ?? [];
        if (isset($methodRoutes[$request->path])) {
            $handler = $methodRoutes[$request->path];
            $handler($request);
            return;
        }

        foreach ($this->patternRoutes[$request->method] ?? [] as $pattern) {
            if (preg_match($pattern['regex'], $request->path, $matches)) {
                $params = [];
                foreach ($pattern['params'] as $name) {
                    $params[$name] = $matches[$name] ?? null;
                }
                $handler = $pattern['handler'];
                $handler($request->withParams($params));
                return;
            }
        }

        Response::error('not_found', 'Endpoint not found.', 404);
    }
}
