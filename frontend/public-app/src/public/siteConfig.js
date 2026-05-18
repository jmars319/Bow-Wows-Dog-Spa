export const SECTION_LINKS = [
  { id: 'hero', label: 'Home' },
  { id: 'services', label: 'Services' },
  { id: 'booking', label: 'Booking' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'retail', label: 'Products' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact' },
  { id: 'faq', label: 'FAQ' },
  { id: 'policies', label: 'Policies' },
];

export const STATUS_PAGE_CONTENT = {
  accessDenied: {
    status: 403,
    path: '/status/access-denied',
    eyebrow: '403 · Access denied',
    title: 'This page is not available from this link.',
    body: 'You may have followed an outdated private link or landed on an area that is not public.',
  },
  notFound: {
    status: 404,
    path: '/status/not-found',
    eyebrow: '404 · Page not found',
    title: 'We could not find that page.',
    body: 'The link may be outdated, typed incorrectly, or no longer part of the public site.',
  },
  serverError: {
    status: 500,
    path: '/status/server-error',
    eyebrow: '500 · Server error',
    title: 'Something went wrong on our side.',
    body: 'The site hit an unexpected issue while loading this page. Please head back or return home and try again.',
  },
  maintenance: {
    status: 503,
    path: '/status/maintenance',
    eyebrow: '503 · Temporary outage',
    title: 'We are temporarily offline for maintenance.',
    body: 'Bow Wow’s Dog Spa is doing a quick tune-up right now. Please check back shortly.',
  },
};

export function textHasContent(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isSectionEnabled(section) {
  return section?.enabled !== false;
}

export function computeVisibleSections(content, services, galleryItems, featuredReviews, retailCategories, settings = {}) {
  const hasReviewSignal =
    Array.isArray(featuredReviews) && featuredReviews.length > 0
      ? true
      : [settings.google_review_rating, settings.google_review_count, settings.google_reviews_url].some(textHasContent);

  return {
    hero: isSectionEnabled(content.hero),
    trust: isSectionEnabled(content.trust),
    services: isSectionEnabled(content.services) && Array.isArray(services) && services.length > 0,
    booking: isSectionEnabled(content.booking) && Array.isArray(services) && services.length > 0,
    gallery: isSectionEnabled(content.gallery) && Array.isArray(galleryItems) && galleryItems.length > 0,
    retail:
      isSectionEnabled(content.retail) &&
      Array.isArray(retailCategories) &&
      retailCategories.some((category) => Array.isArray(category.items) && category.items.length > 0),
    reviews: isSectionEnabled(content.reviews) && hasReviewSignal,
    about: isSectionEnabled(content.about) && textHasContent(content.about?.body),
    contact: isSectionEnabled(content.contact) || isSectionEnabled(content.location),
    faq: isSectionEnabled(content.faq) && Array.isArray(content.faq?.items) && content.faq.items.length > 0,
    policies: isSectionEnabled(content.policies) && Array.isArray(content.policies?.items) && content.policies.items.length > 0,
  };
}

export function computeLegalSections(content) {
  return {
    privacy: isSectionEnabled(content.privacy) && Array.isArray(content.privacy?.items) && content.privacy.items.length > 0,
    terms: isSectionEnabled(content.terms) && Array.isArray(content.terms?.items) && content.terms.items.length > 0,
  };
}

export function resolvePrimaryCta(visibleSections, settings) {
  if (visibleSections.booking) {
    return { kind: 'booking', href: '#booking', label: 'Request Appointment' };
  }

  if (visibleSections.contact) {
    return { kind: 'contact', href: '#contact', label: 'Contact Us' };
  }

  if (visibleSections.services) {
    return { kind: 'services', href: '#services', label: 'View Services' };
  }

  if (textHasContent(settings.phone)) {
    return { kind: 'phone', href: toPhoneHref(settings.phone), label: `Call ${settings.phone}` };
  }

  return null;
}

export function resolveSecondaryCta(visibleSections, settings, primaryCta) {
  if (visibleSections.services && primaryCta?.kind !== 'services') {
    return { kind: 'services', href: '#services', label: 'View Services' };
  }

  if (visibleSections.contact && primaryCta?.kind !== 'contact') {
    return { kind: 'contact', href: '#contact', label: 'Contact Us' };
  }

  if (textHasContent(settings.phone) && primaryCta?.kind !== 'phone') {
    return { kind: 'phone', href: toPhoneHref(settings.phone), label: `Call ${settings.phone}` };
  }

  return null;
}

function toPhoneHref(value) {
  return `tel:${String(value || '').replace(/[^+\d]/g, '')}`;
}
