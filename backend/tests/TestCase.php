<?php

declare(strict_types=1);

namespace BowWowSpa\Tests;

use RuntimeException;
use Throwable;

class TestFailure extends RuntimeException
{
}

abstract class TestCase
{
    public function __construct(protected readonly TestEnvironment $env)
    {
    }

    /**
     * @return array{passed:int, failed:int, failures:list<string>}
     */
    public function run(): array
    {
        $result = [
            'passed' => 0,
            'failed' => 0,
            'failures' => [],
        ];

        $methods = array_values(array_filter(
            get_class_methods($this),
            static fn (string $method): bool => str_starts_with($method, 'test')
        ));
        sort($methods);

        foreach ($methods as $method) {
            $this->env->resetDatabase();

            try {
                $this->setUp();
                $this->{$method}();
                $result['passed']++;
            } catch (Throwable $e) {
                $result['failed']++;
                $result['failures'][] = sprintf(
                    '%s::%s failed: %s',
                    static::class,
                    $method,
                    $e->getMessage()
                );
            } finally {
                $this->tearDown();
            }
        }

        return $result;
    }

    protected function setUp(): void
    {
    }

    protected function tearDown(): void
    {
    }

    protected function fail(string $message): never
    {
        throw new TestFailure($message);
    }

    protected function assertTrue(bool $value, string $message = 'Expected condition to be true.'): void
    {
        if (!$value) {
            $this->fail($message);
        }
    }

    protected function assertFalse(bool $value, string $message = 'Expected condition to be false.'): void
    {
        if ($value) {
            $this->fail($message);
        }
    }

    protected function assertSame(mixed $expected, mixed $actual, string $message = ''): void
    {
        if ($expected !== $actual) {
            $this->fail($message !== '' ? $message : sprintf('Expected %s, got %s.', var_export($expected, true), var_export($actual, true)));
        }
    }

    protected function assertNotNull(mixed $value, string $message = 'Expected value to be non-null.'): void
    {
        if ($value === null) {
            $this->fail($message);
        }
    }

    protected function assertNull(mixed $value, string $message = 'Expected value to be null.'): void
    {
        if ($value !== null) {
            $this->fail($message);
        }
    }

    protected function assertCount(int $expected, array|\Countable $value, string $message = ''): void
    {
        $actual = count($value);
        if ($actual !== $expected) {
            $this->fail($message !== '' ? $message : sprintf('Expected count %d, got %d.', $expected, $actual));
        }
    }

    protected function assertArrayHasKey(string|int $key, array $value, string $message = ''): void
    {
        if (!array_key_exists($key, $value)) {
            $this->fail($message !== '' ? $message : sprintf('Expected array key %s to exist.', (string) $key));
        }
    }

    protected function assertStringContainsString(string $needle, string $haystack, string $message = ''): void
    {
        if (!str_contains($haystack, $needle)) {
            $this->fail($message !== '' ? $message : sprintf('Expected "%s" to contain "%s".', $haystack, $needle));
        }
    }

    protected function assertStringNotContainsString(string $needle, string $haystack, string $message = ''): void
    {
        if (str_contains($haystack, $needle)) {
            $this->fail($message !== '' ? $message : sprintf('Did not expect "%s" to contain "%s".', $haystack, $needle));
        }
    }

    protected function assertGreaterThan(int|float $expectedMinimum, int|float $actual, string $message = ''): void
    {
        if ($actual <= $expectedMinimum) {
            $this->fail($message !== '' ? $message : sprintf('Expected %s to be greater than %s.', (string) $actual, (string) $expectedMinimum));
        }
    }

    protected function assertThrows(callable $callback, string $expectedMessageContains): void
    {
        try {
            $callback();
        } catch (Throwable $e) {
            $this->assertStringContainsString($expectedMessageContains, $e->getMessage());
            return;
        }

        $this->fail('Expected exception containing "' . $expectedMessageContains . '" but none was thrown.');
    }
}
