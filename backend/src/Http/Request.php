<?php

declare(strict_types=1);

namespace BowWowSpa\Http;

final class Request
{
    public function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $query,
        public readonly array $body,
        public readonly array $headers,
        public readonly array $server,
        public readonly array $params = [],
    ) {
    }

    public static function capture(): self
    {
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $uri = $_SERVER['REQUEST_URI'] ?? '/';
        $path = parse_url($uri, PHP_URL_PATH) ?? '/';
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $body = json_decode(file_get_contents('php://input') ?: '[]', true);

        if (!is_array($body)) {
            $body = [];
        }

        return new self($method, rtrim($path, '/') ?: '/', $_GET, $body, $headers, $_SERVER);
    }

    public function input(string $key, mixed $default = null): mixed
    {
        return $this->body[$key] ?? $this->query[$key] ?? $default;
    }

    public function withParams(array $params): self
    {
        return new self($this->method, $this->path, $this->query, $this->body, $this->headers, $this->server, $params);
    }
}
