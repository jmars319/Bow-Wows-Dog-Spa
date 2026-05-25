<?php

declare(strict_types=1);

$composerAutoload = dirname(__DIR__) . '/vendor/autoload.php';
if (is_file($composerAutoload)) {
    require_once $composerAutoload;
}

$baseDir = dirname(__DIR__) . '/src/';

spl_autoload_register(function (string $class) use ($baseDir): void {
    $prefix = 'BowWowSpa\\';

    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }

    $relative = substr($class, strlen($prefix));
    $relativePath = str_replace('\\', DIRECTORY_SEPARATOR, $relative);
    $file = $baseDir . $relativePath . '.php';

    if (file_exists($file)) {
        require $file;
    }
});
