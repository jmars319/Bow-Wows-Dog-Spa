<?php

declare(strict_types=1);

if (!defined('BOWWOW_APP_PATH')) {
    define('BOWWOW_APP_PATH', dirname(__DIR__));
}

require BOWWOW_APP_PATH . '/bootstrap/autoload.php';

spl_autoload_register(static function (string $class): void {
    $prefix = 'BowWowSpa\\Tests\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }

    $relative = substr($class, strlen($prefix));
    $path = __DIR__ . '/' . str_replace('\\', DIRECTORY_SEPARATOR, $relative) . '.php';
    if (is_file($path)) {
        require $path;
    }
});
