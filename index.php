<?php

declare(strict_types=1);

use BowWowSpa\Services\PreviewGateService;
use BowWowSpa\Services\SiteContentService;

$backendDir = resolveBackendDir();
$bootstrapPath = $backendDir . '/bootstrap/app.php';
if (is_file($bootstrapPath)) {
    if (!defined('BOWWOW_OPTIONAL_BOOTSTRAP')) {
        define('BOWWOW_OPTIONAL_BOOTSTRAP', true);
    }
    require_once $bootstrapPath;
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$gate = new PreviewGateService();

if ($path === '/preview' || $path === '/preview/') {
    renderPreviewGate($gate);
    return;
}

if (!$gate->isEnabled()) {
    header('Location: /current', true, 302);
    exit;
}

renderPlaceholder(fetchSiteDetails());

function fetchSiteDetails(): array
{
    $details = [
        'business_name' => "Bow Wow's Dog Spa",
        'phone' => null,
        'email' => null,
        'address' => null,
        'hours' => null,
        'serving_area' => 'Serving the Winston-Salem area',
        'tagline' => 'Where Every Dog is Pampered Like Royalty',
        'intro' => 'Premium grooming services, spa baths, and curated retail for the pups who mean everything.',
        'highlights' => [
            'Signature spa packages with hypoallergenic products and detailed styling.',
            'Bath & Brush Deluxe refreshes between full grooms.',
            'Gentle, supervised play styles plus a boutique retail corner.',
        ],
    ];

    try {
        if (class_exists(SiteContentService::class)) {
            $service = new SiteContentService();
            $snapshot = $service->getSiteSnapshot();
            $settings = $snapshot['settings'] ?? [];
            $details = array_merge($details, [
                'business_name' => $settings['business_name'] ?? $details['business_name'],
                'phone' => $settings['phone'] ?? null,
                'email' => $settings['email'] ?? null,
                'address' => $settings['address'] ?? null,
                'hours' => $settings['hours'] ?? null,
                'serving_area' => $settings['serving_area'] ?? $details['serving_area'],
            ]);

            $sections = $snapshot['sections'] ?? [];
            $hero = $sections['hero'] ?? [];
            if (!empty($hero['headline'])) {
                $details['tagline'] = trim((string) $hero['headline']);
            }
            if (!empty($hero['subheading'])) {
                $details['intro'] = trim(strip_tags((string) $hero['subheading']));
            }
            $cards = $sections['services']['cards'] ?? [];
            $fetchedHighlights = [];
            foreach ($cards as $card) {
                $title = trim((string) ($card['title'] ?? ''));
                $desc = trim(strip_tags((string) ($card['description'] ?? '')));
                if ($title === '' && $desc === '') {
                    continue;
                }
                $line = $title;
                if ($desc !== '') {
                    $line .= ($line !== '' ? ' — ' : '') . $desc;
                }
                if ($line !== '') {
                    $fetchedHighlights[] = $line;
                }
                if (count($fetchedHighlights) >= 4) {
                    break;
                }
            }
            if ($fetchedHighlights) {
                $details['highlights'] = $fetchedHighlights;
            }
        }
    } catch (Throwable $e) {
        // Silent fallback when DB/config unavailable during early setup.
    }

    return $details;
}

function renderPlaceholder(array $details): void
{
    $contactBlocks = array_filter([
        $details['phone'] ? 'Call us: ' . htmlspecialchars($details['phone']) : null,
        $details['email'] ? 'Email: ' . htmlspecialchars($details['email']) : null,
        $details['address'] ? htmlspecialchars($details['address']) : null,
        $details['hours'] ? 'Hours: ' . htmlspecialchars($details['hours']) : null,
    ]);

    $business = htmlspecialchars($details['business_name']);
    $servingArea = $details['serving_area'] ? htmlspecialchars($details['serving_area']) : '';
    $intro = htmlspecialchars($details['intro']);
    $tagline = htmlspecialchars($details['tagline']);
    ?>
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="shortcut icon" href="/favicon.ico">
    <link rel="manifest" href="/site.webmanifest">
    <link rel="canonical" href="https://bowwowsdogspa.com/">
    <meta name="description" content="<?php echo $intro; ?>">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="<?php echo $business; ?>">
    <meta property="og:title" content="<?php echo $business; ?> — Coming Soon">
    <meta property="og:description" content="<?php echo $intro; ?>">
    <meta property="og:url" content="https://bowwowsdogspa.com/">
    <meta property="og:image" content="https://bowwowsdogspa.com/placeholder/assets/logo-primary.png">
    <meta property="og:image:alt" content="<?php echo $business; ?> logo">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="<?php echo $business; ?>">
    <meta name="twitter:description" content="<?php echo $intro; ?>">
    <meta name="twitter:image" content="https://bowwowsdogspa.com/placeholder/assets/logo-primary.png">
    <title><?php echo $business; ?> — Coming Soon</title>
    <style>
      :root {
        font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: #FAF9F6;
        color: #2F3A3A;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
      }
      .card {
        max-width: 560px;
        width: 100%;
        background: #FFFFFF;
        border-radius: 20px;
        padding: 2.5rem;
        box-shadow: 0 30px 60px rgba(47,58,58,0.12);
        text-align: center;
      }
      picture {
        display: inline-block;
        margin-bottom: 1.5rem;
      }
      picture img {
        max-width: 260px;
        width: 100%;
        height: auto;
      }
      .eyebrow {
        letter-spacing: 0.25em;
        text-transform: uppercase;
        font-size: 0.85rem;
        color: #8FB6B1;
        margin-bottom: 0.5rem;
      }
      h1 {
        margin: 0;
        font-size: 2.4rem;
        color: #2F3A3A;
      }
      .intro {
        font-size: 1.1rem;
        color: #5F6F6F;
        margin-top: 0.75rem;
      }
      .highlights {
        list-style: none;
        padding: 0;
        margin: 1.5rem 0 0;
        text-align: left;
      }
      .highlights li {
        background: #E9E4F2;
        border-radius: 999px;
        padding: 0.5rem 1rem;
        margin-bottom: 0.5rem;
        font-size: 0.95rem;
      }
      .contact {
        margin-top: 1.5rem;
        line-height: 1.6;
      }
      .contact div {
        color: #2F3A3A;
        font-weight: 500;
      }
      footer {
        margin-top: 2rem;
        font-size: 0.95rem;
      }
      footer a {
        color: #8FB6B1;
        text-decoration: none;
        margin: 0 0.5rem;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <picture>
        <source srcset="/placeholder/assets/logo-primary.webp" type="image/webp">
        <img src="/placeholder/assets/logo-primary.png" alt="<?php echo $business; ?>">
      </picture>
      <?php if ($servingArea): ?>
        <p class="eyebrow"><?php echo $servingArea; ?></p>
      <?php endif; ?>
      <h1><?php echo $business; ?></h1>
      <p class="intro"><?php echo $tagline; ?></p>
      <p class="intro"><?php echo $intro; ?></p>
      <?php if (!empty($details['highlights'])): ?>
        <ul class="highlights">
          <?php foreach ($details['highlights'] as $highlight): ?>
            <li><?php echo htmlspecialchars($highlight); ?></li>
          <?php endforeach; ?>
        </ul>
      <?php endif; ?>
      <?php if ($contactBlocks): ?>
        <div class="contact">
          <?php foreach ($contactBlocks as $block): ?>
            <div><?php echo $block; ?></div>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
      <footer>
        <a href="/privacy">Privacy</a> ·
        <a href="/terms">Terms</a> ·
        <a href="/admin/login">Admin Login</a>
      </footer>
    </div>
  </body>
</html>
    <?php
}

function resolveBackendDir(): string
{
    $paths = [
        __DIR__ . '/backend',
        __DIR__ . '/api',
    ];

    foreach ($paths as $path) {
        if (is_dir($path)) {
            return $path;
        }
    }

    return __DIR__ . '/backend';
}

function renderPreviewGate(PreviewGateService $gate): void
{
    if (!$gate->isEnabled()) {
        header('Location: /current', true, 302);
        exit;
    }

    $error = null;
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $submitted = trim((string) ($_POST['preview_password'] ?? ''));
        if ($gate->passwordMatches($submitted)) {
            $gate->grantAccess();
            header('Location: /current', true, 302);
            exit;
        }
        $error = 'Incorrect password. Please try again.';
    }
    ?>
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>Client Preview</title>
    <style>
      :root { font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #1f1d20; color: white; }
      body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; }
      form { width: 100%; max-width: 400px; background: rgba(255,255,255,0.05); border-radius: 16px; padding: 2rem; box-shadow: 0 30px 60px rgba(0,0,0,0.35); }
      h1 { margin-top: 0; font-size: 1.8rem; }
      label { display: block; margin-top: 1rem; }
      input[type="password"] { width: 100%; padding: 0.75rem; border-radius: 10px; border: none; margin-top: 0.5rem; }
      button { margin-top: 1.5rem; width: 100%; padding: 0.85rem; border-radius: 10px; border: none; background: #f46b45; color: white; font-weight: 600; cursor: pointer; }
      .error { margin-top: 1rem; color: #ffb4b4; }
      a { color: #f4c7a4; text-decoration: none; font-size: 0.9rem; }
    </style>
  </head>
  <body>
    <form method="post">
      <h1>Preview Access</h1>
      <p>Enter the preview password to open the in-progress build.</p>
      <label>
        Preview Password
        <input type="password" name="preview_password" autocomplete="off" required>
      </label>
      <button type="submit">Unlock Preview</button>
      <?php if ($error): ?>
        <div class="error"><?php echo htmlspecialchars($error); ?></div>
      <?php endif; ?>
      <p style="margin-top: 1.5rem;"><a href="/">← Back to placeholder</a></p>
    </form>
  </body>
</html>
    <?php
}
