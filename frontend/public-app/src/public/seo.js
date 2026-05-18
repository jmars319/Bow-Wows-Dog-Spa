import { textHasContent } from './siteConfig';

const CANONICAL_ORIGIN = 'https://bowwowsdogspa.com';
const DEFAULT_SEO_TITLE = "Bow Wow's Dog Spa | Calm Dog Grooming in Greater Winston-Salem & the Triad";
const DEFAULT_SEO_DESCRIPTION =
  'Calm, comfort-first dog grooming and spa care serving Greater Winston-Salem and nearby Triad families.';
const DEFAULT_OG_IMAGE = `${CANONICAL_ORIGIN}/share-logo.png`;

export function buildHomeSeo(settings, sections, galleryItems) {
  const businessName = textHasContent(settings.business_name) ? settings.business_name : "Bow Wow's Dog Spa";
  const title = textHasContent(sections.hero?.headline)
    ? `${stripHtml(sections.hero.headline)} | ${businessName}`
    : `${businessName} | Calm Dog Grooming in Greater Winston-Salem & the Triad`;
  const descriptionSource = sections.hero?.subheading || sections.services?.intro || sections.about?.body || '';
  const description = truncateText(stripHtml(descriptionSource), 180) || DEFAULT_SEO_DESCRIPTION;

  return {
    title,
    description,
    path: '/',
    image: pickSeoImage(sections.hero?.media, galleryItems),
    siteName: businessName,
    robots: 'index,follow,max-image-preview:large',
  };
}

export function buildSimpleSeo(blockKey, title, items, enabled, settings) {
  const businessName = textHasContent(settings.business_name) ? settings.business_name : "Bow Wow's Dog Spa";
  const itemText = Array.isArray(items)
    ? items
        .map((item) => `${item?.title || ''} ${item?.body || item?.text || ''}`.trim())
        .join(' ')
    : '';
  const description = enabled
    ? truncateText(stripHtml(itemText), 180) || DEFAULT_SEO_DESCRIPTION
    : `${title} is currently unavailable.`;

  return {
    title: `${title} | ${businessName}`,
    description,
    path: blockKey === 'privacy' ? '/privacy' : '/terms',
    image: DEFAULT_OG_IMAGE,
    siteName: businessName,
    robots: enabled ? 'index,follow,max-image-preview:large' : 'noindex,nofollow',
  };
}

export function buildStatusSeo(page) {
  const businessName = "Bow Wow's Dog Spa";

  return {
    title: `${page.title} | ${businessName}`,
    description: page.body,
    path: page.path,
    image: DEFAULT_OG_IMAGE,
    siteName: businessName,
    robots: 'noindex,nofollow',
  };
}

export function applySeo({ title, description, path, image, robots, siteName }) {
  const url = toCanonicalUrl(path || '/');
  const resolvedTitle = title || DEFAULT_SEO_TITLE;
  const resolvedDescription = description || DEFAULT_SEO_DESCRIPTION;
  const resolvedImage = image || DEFAULT_OG_IMAGE;

  document.title = resolvedTitle;
  setMetaTag('name', 'description', resolvedDescription);
  setMetaTag('name', 'robots', robots || 'index,follow,max-image-preview:large');
  setMetaTag('property', 'og:type', 'website');
  setMetaTag('property', 'og:title', resolvedTitle);
  setMetaTag('property', 'og:description', resolvedDescription);
  setMetaTag('property', 'og:url', url);
  setMetaTag('property', 'og:image', resolvedImage);
  setMetaTag('property', 'og:site_name', siteName || "Bow Wow's Dog Spa");
  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', resolvedTitle);
  setMetaTag('name', 'twitter:description', resolvedDescription);
  setMetaTag('name', 'twitter:image', resolvedImage);
  setCanonicalLink(url);
}

export function applyStructuredData(schema) {
  const script = ensureHeadNode('script', {
    id: 'site-structured-data',
    type: 'application/ld+json',
  });

  if (!schema) {
    script.textContent = '';
    return;
  }

  script.textContent = JSON.stringify(schema);
}

export function buildLocalBusinessSchema(settings, heroMedia, galleryItems) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
  };

  const name = textHasContent(settings.business_name) ? settings.business_name : "Bow Wow's Dog Spa";
  schema.name = name;
  schema.url = toCanonicalUrl('/');

  const image = pickSeoImage(heroMedia, galleryItems);
  if (textHasContent(image)) {
    schema.image = image;
  }

  if (textHasContent(settings.phone)) {
    schema.telephone = settings.phone;
  }

  if (textHasContent(settings.address)) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: settings.address,
    };
  }

  const normalizedHours = normalizeOpeningHours(settings.hours);
  if (normalizedHours.length > 0) {
    schema.openingHours = normalizedHours;
  }

  return schema;
}

function normalizeOpeningHours(value) {
  if (!textHasContent(value)) {
    return [];
  }

  return String(value)
    .split(/\r?\n+/)
    .map((entry) => entry.trim())
    .filter((entry) => /^[A-Z][a-z](?:-[A-Z][a-z])?\s+\d/.test(entry));
}

function pickSeoImage(heroMedia, galleryItems) {
  const heroPath = heroMedia?.fallback_url || heroMedia?.original_url || '';
  if (textHasContent(heroPath)) {
    return toAbsoluteUrl(heroPath);
  }

  if (Array.isArray(galleryItems)) {
    for (const item of galleryItems) {
      const media = item?.primary_media || item?.secondary_media;
      const path = media?.fallback_url || media?.original_url || '';
      if (textHasContent(path)) {
        return toAbsoluteUrl(path);
      }
    }
  }

  return DEFAULT_OG_IMAGE;
}

function setCanonicalLink(href) {
  const link = ensureHeadNode('link', { rel: 'canonical' });
  link.setAttribute('href', href);
}

function setMetaTag(attribute, key, content) {
  const tag = ensureHeadNode('meta', { [attribute]: key });
  tag.setAttribute('content', content);
}

function ensureHeadNode(tagName, attributes) {
  const selector = `${tagName}${Object.entries(attributes)
    .map(([key, value]) => `[${key}="${escapeAttribute(value)}"]`)
    .join('')}`;
  let node = document.head.querySelector(selector);

  if (!node) {
    node = document.createElement(tagName);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    document.head.appendChild(node);
  }

  return node;
}

function escapeAttribute(value) {
  return String(value).replaceAll('"', '\\"');
}

function toCanonicalUrl(path) {
  const normalizedPath = path === '/' ? '/' : `/${String(path || '').replace(/^\/+/, '')}`;
  return `${CANONICAL_ORIGIN}${normalizedPath}`;
}

function toAbsoluteUrl(path) {
  if (!textHasContent(path)) {
    return '';
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${CANONICAL_ORIGIN}${String(path).startsWith('/') ? path : `/${path}`}`;
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(value, maxLength = 180) {
  if (!textHasContent(value)) {
    return '';
  }

  const normalized = String(value).trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}
