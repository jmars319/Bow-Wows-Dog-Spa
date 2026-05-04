<?php

declare(strict_types=1);

header('X-Robots-Tag: noindex, nofollow', true);
header('Cache-Control: no-store, max-age=0', true);
header('X-Content-Type-Options: nosniff', true);
header('X-Frame-Options: SAMEORIGIN', true);
header('Referrer-Policy: strict-origin-when-cross-origin', true);
header('Permissions-Policy: geolocation=(), microphone=(), camera=()', true);
header('Strict-Transport-Security: max-age=31536000; includeSubDomains', true);

$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$isRootSurface = rtrim($requestPath, '/') === '';

$business = "Bow Wow's Dog Spa";
$phone = '(336) 842-3723';
$phoneHref = 'tel:+13368423723';
$email = 'bowwowsdogspa@gmail.com';
$address = '11141 Old U.S. Hwy 52 #4, Winston-Salem, NC 27107';
$servingArea = 'Serving Greater Winston-Salem and the Triad area';
$tagline = 'Comfort-first dog grooming care';
$canonicalUrl = $isRootSurface ? 'https://bowwowsdogspa.com/' : 'https://bowwowsdogspa.com/placeholder/';
$assetBase = '/placeholder/assets';
$logoPng = 'https://bowwowsdogspa.com/placeholder/assets/logo-primary.png';
$intro = $isRootSurface
    ? "The full Bow Wow's Dog Spa website is being finalized. For now, this temporary page gives customers the essentials while booking and service content gets final approval."
    : "This placeholder is ready to deploy as the temporary public surface while the full Bow Wow's Dog Spa website waits for final approval.";
$highlights = [
    'Appointment-based grooming and spa care',
    'Neighborhood service for Midway, Winston-Salem, and nearby Triad families',
    'Full booking, gallery, and service details coming with the approved site',
];

$structuredData = [
    '@context' => 'https://schema.org',
    '@type' => 'LocalBusiness',
    '@id' => 'https://bowwowsdogspa.com/#business',
    'name' => $business,
    'url' => 'https://bowwowsdogspa.com/',
    'image' => $logoPng,
    'description' => 'Comfort-first dog grooming and spa care serving Greater Winston-Salem and the Triad area.',
    'telephone' => '+1-336-842-3723',
    'email' => $email,
    'address' => [
        '@type' => 'PostalAddress',
        'streetAddress' => '11141 Old U.S. Hwy 52 #4',
        'addressLocality' => 'Winston-Salem',
        'addressRegion' => 'NC',
        'postalCode' => '27107',
        'addressCountry' => 'US',
    ],
    'areaServed' => [
        'Greater Winston-Salem, NC',
        'Midway, NC',
        'Triad, NC',
    ],
];
?>
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <meta name="theme-color" content="#8FB6B1">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="shortcut icon" href="/favicon.ico">
    <link rel="manifest" href="/site.webmanifest">
    <link rel="canonical" href="<?php echo htmlspecialchars($canonicalUrl, ENT_QUOTES, 'UTF-8'); ?>">
    <meta name="description" content="<?php echo htmlspecialchars($intro, ENT_QUOTES, 'UTF-8'); ?>">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="<?php echo htmlspecialchars($business, ENT_QUOTES, 'UTF-8'); ?>">
    <meta property="og:title" content="<?php echo htmlspecialchars($business, ENT_QUOTES, 'UTF-8'); ?> | Website Coming Soon">
    <meta property="og:description" content="<?php echo htmlspecialchars($intro, ENT_QUOTES, 'UTF-8'); ?>">
    <meta property="og:url" content="<?php echo htmlspecialchars($canonicalUrl, ENT_QUOTES, 'UTF-8'); ?>">
    <meta property="og:image" content="<?php echo htmlspecialchars($logoPng, ENT_QUOTES, 'UTF-8'); ?>">
    <meta property="og:image:alt" content="<?php echo htmlspecialchars($business, ENT_QUOTES, 'UTF-8'); ?> logo">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="<?php echo htmlspecialchars($business, ENT_QUOTES, 'UTF-8'); ?> | Website Coming Soon">
    <meta name="twitter:description" content="<?php echo htmlspecialchars($intro, ENT_QUOTES, 'UTF-8'); ?>">
    <meta name="twitter:image" content="<?php echo htmlspecialchars($logoPng, ENT_QUOTES, 'UTF-8'); ?>">
    <script type="application/ld+json"><?php echo json_encode($structuredData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); ?></script>
    <title><?php echo htmlspecialchars($business, ENT_QUOTES, 'UTF-8'); ?> | Website Coming Soon</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #faf9f6;
        color: #2f3a3a;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: #faf9f6;
      }

      a {
        color: #4f7772;
        font-weight: 700;
      }

      .wrap {
        display: grid;
        min-height: 100vh;
        place-items: center;
        padding: 1rem;
      }

      main {
        background: #ffffff;
        border: 1px solid rgba(47, 58, 58, 0.12);
        border-radius: 18px;
        box-shadow: 0 24px 70px rgba(47, 58, 58, 0.14);
        max-width: 920px;
        overflow: hidden;
        width: 100%;
      }

      .hero {
        display: grid;
        gap: 2rem;
        padding: clamp(1.5rem, 5vw, 3rem);
      }

      .logo {
        max-width: min(320px, 82vw);
      }

      .eyebrow {
        color: #6c8f8a;
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.16em;
        margin: 0 0 0.75rem;
        text-transform: uppercase;
      }

      h1 {
        color: #2f3a3a;
        font-size: clamp(2.25rem, 11vw, 4.5rem);
        line-height: 0.98;
        margin: 0;
      }

      .intro {
        color: #5f6f6f;
        font-size: clamp(1rem, 3vw, 1.25rem);
        line-height: 1.65;
        margin: 1rem 0 0;
        max-width: 58ch;
      }

      .details {
        background: #f2f0ea;
        display: grid;
        gap: 1rem;
        padding: clamp(1.25rem, 4vw, 2rem);
      }

      .highlights {
        display: grid;
        gap: 0.75rem;
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .highlights li {
        background: #ffffff;
        border: 1px solid rgba(47, 58, 58, 0.1);
        border-radius: 999px;
        color: #3f5050;
        padding: 0.7rem 1rem;
      }

      .contact {
        display: grid;
        gap: 0.75rem;
      }

      .contact p,
      footer p {
        margin: 0;
      }

      footer {
        border-top: 1px solid rgba(47, 58, 58, 0.1);
        color: #6b7474;
        font-size: 0.95rem;
        padding-top: 1rem;
      }

      @media (min-width: 760px) {
        .hero {
          grid-template-columns: 0.8fr 1.2fr;
          align-items: center;
        }

        .details {
          grid-template-columns: 1.1fr 0.9fr;
        }

        footer {
          grid-column: 1 / -1;
        }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <main>
        <section class="hero" aria-labelledby="page-title">
          <picture>
            <source srcset="<?php echo htmlspecialchars($assetBase, ENT_QUOTES, 'UTF-8'); ?>/logo-primary.webp" type="image/webp">
            <img class="logo" src="<?php echo htmlspecialchars($assetBase, ENT_QUOTES, 'UTF-8'); ?>/logo-primary.png" alt="<?php echo htmlspecialchars($business, ENT_QUOTES, 'UTF-8'); ?>" width="1536" height="1024">
          </picture>
          <div>
            <p class="eyebrow"><?php echo htmlspecialchars($servingArea, ENT_QUOTES, 'UTF-8'); ?></p>
            <h1 id="page-title">Website coming soon</h1>
            <p class="intro"><?php echo htmlspecialchars($tagline, ENT_QUOTES, 'UTF-8'); ?> from <?php echo htmlspecialchars($business, ENT_QUOTES, 'UTF-8'); ?>.</p>
            <p class="intro"><?php echo htmlspecialchars($intro, ENT_QUOTES, 'UTF-8'); ?></p>
          </div>
        </section>
        <section class="details" aria-label="Business details">
          <ul class="highlights">
            <?php foreach ($highlights as $highlight): ?>
              <li><?php echo htmlspecialchars($highlight, ENT_QUOTES, 'UTF-8'); ?></li>
            <?php endforeach; ?>
          </ul>
          <div class="contact">
            <p><strong>Call:</strong> <a href="<?php echo htmlspecialchars($phoneHref, ENT_QUOTES, 'UTF-8'); ?>"><?php echo htmlspecialchars($phone, ENT_QUOTES, 'UTF-8'); ?></a></p>
            <p><strong>Email:</strong> <a href="mailto:<?php echo htmlspecialchars($email, ENT_QUOTES, 'UTF-8'); ?>"><?php echo htmlspecialchars($email, ENT_QUOTES, 'UTF-8'); ?></a></p>
            <p><strong>Visit:</strong> <?php echo htmlspecialchars($address, ENT_QUOTES, 'UTF-8'); ?></p>
          </div>
          <footer>
            <p>Website by <a href="https://jamarq.digital">JAMARQ Digital</a>. Temporary placeholder while the approved public site is finalized.</p>
          </footer>
        </section>
      </main>
    </div>
  </body>
</html>
