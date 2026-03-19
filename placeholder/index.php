<?php

declare(strict_types=1);

header('X-Robots-Tag: noindex, nofollow', true);
header('Cache-Control: no-store, max-age=0', true);

$business = "Bow Wow's Dog Spa";
$servingArea = 'Serving Midway, Winston-Salem, and nearby Triad families';
$tagline = 'Trusted neighborhood boutique grooming';
$intro = 'This archived placeholder stays separate from the live site and is retained only as an internal reference surface.';
$highlights = [
    'The live public site now runs at the main root URL.',
    'Booking, reviews, gallery, and contact live in the main build.',
    'This placeholder remains isolated and is not part of the live experience.',
];
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
    <link rel="canonical" href="https://bowwowsdogspa.com/placeholder/">
    <meta name="description" content="<?php echo htmlspecialchars($intro, ENT_QUOTES, 'UTF-8'); ?>">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="<?php echo htmlspecialchars($business, ENT_QUOTES, 'UTF-8'); ?>">
    <meta property="og:title" content="<?php echo htmlspecialchars($business, ENT_QUOTES, 'UTF-8'); ?> — Placeholder">
    <meta property="og:description" content="<?php echo htmlspecialchars($intro, ENT_QUOTES, 'UTF-8'); ?>">
    <meta property="og:url" content="https://bowwowsdogspa.com/placeholder/">
    <meta property="og:image" content="https://bowwowsdogspa.com/placeholder/assets/logo-primary.png">
    <meta property="og:image:alt" content="<?php echo htmlspecialchars($business, ENT_QUOTES, 'UTF-8'); ?> logo">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="<?php echo htmlspecialchars($business, ENT_QUOTES, 'UTF-8'); ?>">
    <meta name="twitter:description" content="<?php echo htmlspecialchars($intro, ENT_QUOTES, 'UTF-8'); ?>">
    <meta name="twitter:image" content="https://bowwowsdogspa.com/placeholder/assets/logo-primary.png">
    <title><?php echo htmlspecialchars($business, ENT_QUOTES, 'UTF-8'); ?> — Placeholder</title>
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
        <img src="/placeholder/assets/logo-primary.png" alt="<?php echo htmlspecialchars($business, ENT_QUOTES, 'UTF-8'); ?>">
      </picture>
      <p class="eyebrow"><?php echo htmlspecialchars($servingArea, ENT_QUOTES, 'UTF-8'); ?></p>
      <h1><?php echo htmlspecialchars($business, ENT_QUOTES, 'UTF-8'); ?></h1>
      <p class="intro"><?php echo htmlspecialchars($tagline, ENT_QUOTES, 'UTF-8'); ?></p>
      <p class="intro"><?php echo htmlspecialchars($intro, ENT_QUOTES, 'UTF-8'); ?></p>
      <ul class="highlights">
        <?php foreach ($highlights as $highlight): ?>
          <li><?php echo htmlspecialchars($highlight, ENT_QUOTES, 'UTF-8'); ?></li>
        <?php endforeach; ?>
      </ul>
      <footer>Archived reference surface only.</footer>
    </div>
  </body>
</html>
