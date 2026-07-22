<?php

declare(strict_types=1);

header_remove('X-Powered-By');
header('X-Robots-Tag: noindex, nofollow', true);
header('Cache-Control: no-store, max-age=0', true);
header("Content-Security-Policy: base-uri 'self'; form-action 'self'; frame-ancestors 'self'; object-src 'none'", true);
header('X-Content-Type-Options: nosniff', true);
header('X-XSS-Protection: 0', true);
header('X-Frame-Options: SAMEORIGIN', true);
header('Referrer-Policy: strict-origin-when-cross-origin', true);
header('Permissions-Policy: geolocation=(), microphone=(), camera=()', true);
header('X-Permitted-Cross-Domain-Policies: none', true);
header('Origin-Agent-Cluster: ?1', true);
header('Strict-Transport-Security: max-age=31536000; includeSubDomains', true);
header('Set-Cookie: bowwow_admin=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax', false);

// Placeholder metadata contract
$business = "Bow Wow's Dog Spa";
$phone = '(336) 842-3723';
$phoneHref = 'tel:+13368423723';
$email = 'bowwowsdogspa@gmail.com';
$address = '11141 Old U.S. Hwy 52 #4, Winston-Salem, NC 27107';
$servingArea = 'Serving Greater Winston-Salem and the Triad area';
$tagline = 'Comfort-first dog grooming care';
$canonicalUrl = 'https://bowwowsdogspa.com/';
$assetBase = '/assets';
$logoPng = 'https://bowwowsdogspa.com/assets/logo-primary.png';
$compliAssureCode = '65,1A16737D200DD8330060FA24C50C3C48F287EC3C';
$compliAssureSealImage = 'https://www.rapidscansecure.com/siteseal/Seal.aspx?code=' . $compliAssureCode;
$compliAssureVerifyUrl = 'https://www.rapidscansecure.com/siteseal/Verify.aspx?code=' . $compliAssureCode;
$intro = "The full Bow Wow's Dog Spa website is being finalized. For now, this temporary page gives customers the essentials while booking and service content gets final approval.";
$highlights = [
    'Appointment-based grooming and spa care',
    'Neighborhood service for Midway, Winston-Salem, and nearby Triad families',
    'Full booking, gallery, and service details coming with the approved site',
];

// Structured data contract
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
      /* Placeholder layout boundary */
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
        padding: clamp(1rem, 3vw, 2rem);
        place-items: start center;
      }

      main {
        background: #ffffff;
        border: 1px solid rgba(47, 58, 58, 0.12);
        border-radius: 16px;
        box-shadow: 0 18px 50px rgba(47, 58, 58, 0.12);
        max-width: 1080px;
        overflow: hidden;
        width: 100%;
      }

      .hero {
        display: grid;
        gap: clamp(1.25rem, 3vw, 2.25rem);
        padding: clamp(1.5rem, 4vw, 3rem);
      }

      .logo-panel {
        align-items: center;
        background: linear-gradient(145deg, #f7f8f3, #edf3f1);
        border: 1px solid rgba(47, 58, 58, 0.08);
        border-radius: 14px;
        display: flex;
        justify-content: center;
        min-height: clamp(220px, 30vw, 320px);
        padding: clamp(1rem, 3vw, 1.75rem);
      }

      .logo-panel picture {
        display: block;
        width: 100%;
      }

      .logo {
        display: block;
        height: auto;
        margin: 0 auto;
        max-height: 280px;
        max-width: min(460px, 100%);
        object-fit: contain;
        width: 100%;
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
        font-size: clamp(2.5rem, 7vw, 4.5rem);
        line-height: 0.95;
        margin: 0;
        max-width: 10ch;
      }

      .intro {
        color: #5f6f6f;
        font-size: clamp(1rem, 2.4vw, 1.2rem);
        line-height: 1.55;
        margin: 1rem 0 0;
        max-width: 58ch;
      }

      /* Placeholder action surface */
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-top: 1.5rem;
      }

      .button {
        align-items: center;
        border: 1px solid #4f7772;
        border-radius: 999px;
        display: inline-flex;
        justify-content: center;
        min-height: 44px;
        padding: 0.75rem 1rem;
        text-decoration: none;
      }

      .button--primary {
        background: #4f7772;
        color: #ffffff;
      }

      .button--secondary {
        background: #ffffff;
        color: #4f7772;
      }

      /* Contact detail surface */
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

      .site-seal {
        margin-top: 1rem;
      }

      .site-seal__label {
        color: #4f5f5f;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .site-seal__link {
        align-items: center;
        background: #ffffff;
        border: 1px solid rgba(47, 58, 58, 0.1);
        border-radius: 8px;
        display: inline-flex;
        margin-top: 0.5rem;
        padding: 0.45rem;
      }

      .site-seal__link img {
        display: block;
        height: auto;
        max-width: min(160px, 100%);
        width: 160px;
      }

      /* Responsive layout constraints */
      @media (min-width: 760px) {
        .hero {
          grid-template-columns: minmax(280px, 0.95fr) minmax(0, 1.05fr);
          align-items: center;
        }

        .details {
          grid-template-columns: 1.1fr 0.9fr;
        }

        footer {
          grid-column: 1 / -1;
        }
      }

      @media (max-width: 759px) {
        .logo-panel {
          min-height: 190px;
        }

        .logo {
          max-height: 210px;
          max-width: 340px;
        }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <main>
        <!-- Placeholder hero surface -->
        <section class="hero" aria-labelledby="page-title">
          <div class="logo-panel">
            <picture>
              <source srcset="<?php echo htmlspecialchars($assetBase, ENT_QUOTES, 'UTF-8'); ?>/logo-primary.webp" type="image/webp">
              <img class="logo" src="<?php echo htmlspecialchars($assetBase, ENT_QUOTES, 'UTF-8'); ?>/logo-primary.png" alt="<?php echo htmlspecialchars($business, ENT_QUOTES, 'UTF-8'); ?>" width="1536" height="1024">
            </picture>
          </div>
          <div>
            <p class="eyebrow"><?php echo htmlspecialchars($servingArea, ENT_QUOTES, 'UTF-8'); ?></p>
            <h1 id="page-title">Website coming soon</h1>
            <p class="intro"><?php echo htmlspecialchars($tagline, ENT_QUOTES, 'UTF-8'); ?> from <?php echo htmlspecialchars($business, ENT_QUOTES, 'UTF-8'); ?>.</p>
            <p class="intro"><?php echo htmlspecialchars($intro, ENT_QUOTES, 'UTF-8'); ?></p>
            <div class="actions" aria-label="Contact options">
              <a class="button button--primary" href="<?php echo htmlspecialchars($phoneHref, ENT_QUOTES, 'UTF-8'); ?>">Call <?php echo htmlspecialchars($phone, ENT_QUOTES, 'UTF-8'); ?></a>
              <a class="button button--secondary" href="mailto:<?php echo htmlspecialchars($email, ENT_QUOTES, 'UTF-8'); ?>">Email Bow Wow's</a>
            </div>
          </div>
        </section>
        <!-- Business detail surface -->
        <section class="details" aria-label="Business details">
          <ul class="highlights">
            <?php foreach ($highlights as $highlight): ?>
              <li><?php echo htmlspecialchars($highlight, ENT_QUOTES, 'UTF-8'); ?></li>
            <?php endforeach; ?>
          </ul>
          <div class="contact">
            <p><strong>Call:</strong> <a href="<?php echo htmlspecialchars($phoneHref, ENT_QUOTES, 'UTF-8'); ?>"><?php echo htmlspecialchars($phone, ENT_QUOTES, 'UTF-8'); ?></a></p>
            <p><strong>Message:</strong> Use the contact form when the approved public site is live.</p>
            <p><strong>Visit:</strong> <?php echo htmlspecialchars($address, ENT_QUOTES, 'UTF-8'); ?></p>
          </div>
          <footer>
            <p>Website by <a href="https://jamarq.digital">JAMARQ Digital</a>. Temporary placeholder while the approved public site is finalized.</p>
            <div class="site-seal">
              <div class="site-seal__label">Site Security</div>
              <a class="site-seal__link" href="<?php echo htmlspecialchars($compliAssureVerifyUrl, ENT_QUOTES, 'UTF-8'); ?>" target="_blank" rel="noopener noreferrer" aria-label="Verify Bow Wow's Dog Spa site security">
                <img src="<?php echo htmlspecialchars($compliAssureSealImage, ENT_QUOTES, 'UTF-8'); ?>" alt="CompliAssure SiteSeal" width="160" height="69" loading="lazy" decoding="async">
              </a>
            </div>
          </footer>
        </section>
      </main>
    </div>
  </body>
</html>
