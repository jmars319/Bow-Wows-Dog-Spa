<?php

declare(strict_types=1);

$appBootstrap = __DIR__ . '/../bootstrap/app.php';
if (!is_file($appBootstrap)) {
    $appBootstrap = __DIR__ . '/bootstrap/app.php';
}

require $appBootstrap;

use BowWowSpa\Application;

(new Application())->run();
