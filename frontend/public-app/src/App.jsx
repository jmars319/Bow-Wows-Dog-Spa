import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import logoPrimaryPng from './assets/logos/logo-primary.png';
import logoPrimaryWebp from './assets/logos/logo-primary.webp';

const SiteContentContext = createContext({ data: null, loading: true, error: null });
const CANONICAL_ORIGIN = 'https://bowwowsdogspa.com';
const DEFAULT_SEO_TITLE = "Bow Wow's Dog Spa | Calm Dog Grooming in Greater Winston-Salem & the Triad";
const DEFAULT_SEO_DESCRIPTION =
  'Calm, comfort-first dog grooming and spa care serving Greater Winston-Salem and nearby Triad families.';
const DEFAULT_OG_IMAGE = `${CANONICAL_ORIGIN}/share-logo.png`;
const LOGO_WIDTH = 1536;
const LOGO_HEIGHT = 1024;

const SECTION_LINKS = [
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

const STATUS_PAGE_CONTENT = {
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

function SiteContentProvider({ children }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get('/api/public/site');
        const payload = response?.data;
        if (!payload || typeof payload !== 'object' || !payload.data || typeof payload.data !== 'object') {
          throw new Error(
            import.meta.env.DEV
              ? 'Public site data did not return valid JSON. Check /api/public/site and the backend connection.'
              : 'We could not load the site content right now.',
          );
        }

        if (!ignore) {
          setData(payload.data);
        }
      } catch (err) {
        if (!ignore) {
          setData(null);
          setError(err?.response?.data?.error?.message || err?.message || 'Unable to load site content.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, []);

  return <SiteContentContext.Provider value={{ data, loading, error }}>{children}</SiteContentContext.Provider>;
}

function useSiteContent() {
  return useContext(SiteContentContext);
}

function SiteContentRoute({ children }) {
  return <SiteContentProvider>{children}</SiteContentProvider>;
}

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<SiteContentRoute><PublicPage /></SiteContentRoute>} />
        <Route path="/preview" element={<Navigate to="/" replace />} />
        <Route path="/preview/*" element={<Navigate to="/" replace />} />
        <Route path="/current" element={<Navigate to="/" replace />} />
        <Route path="/current/*" element={<Navigate to="/" replace />} />
        <Route path="/privacy" element={<SiteContentRoute><SimplePage fallbackTitle="Privacy Policy" blockKey="privacy" /></SiteContentRoute>} />
        <Route path="/terms" element={<SiteContentRoute><SimplePage fallbackTitle="Terms & Conditions" blockKey="terms" /></SiteContentRoute>} />
        <Route path="/status/access-denied" element={<StatusPage pageKey="accessDenied" />} />
        <Route path="/status/not-found" element={<StatusPage pageKey="notFound" />} />
        <Route path="/status/server-error" element={<StatusPage pageKey="serverError" />} />
        <Route path="/status/maintenance" element={<StatusPage pageKey="maintenance" />} />
        <Route path="*" element={<StatusPage pageKey="notFound" />} />
      </Routes>
    </BrowserRouter>
  );
}

function PublicPage() {
  const { data, loading, error } = useSiteContent();
  const location = useLocation();
  const [showNav, setShowNav] = useState(false);
  const [showMobileActionBar, setShowMobileActionBar] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY;

      setShowNav((current) => {
        const next = scrollY > 24;
        return current === next ? current : next;
      });

      setShowMobileActionBar((current) => {
        const next = scrollY > 280;
        return current === next ? current : next;
      });
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (loading || error || !data) {
      return;
    }

    const sections = data.sections || {};
    const settings = data.settings || {};
    const galleryItems = Array.isArray(data.gallery_items) ? data.gallery_items : [];

    applySeo(buildHomeSeo(settings, sections, galleryItems));
    applyStructuredData(buildLocalBusinessSchema(settings, galleryItems));
  }, [data, loading, error]);

  useEffect(() => {
    if (loading || error || !data || !location.hash) {
      return;
    }

    const targetId = decodeURIComponent(location.hash.slice(1));
    const target = document.getElementById(targetId);
    if (!target) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'start' });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [data, loading, error, location.hash]);

  if (loading) {
    return (
      <div className="site-shell">
        <section className="section">
          <div className="container centered-block">
            <BrandLockup />
            <p>Loading Bow Wow’s Dog Spa…</p>
          </div>
        </section>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="site-shell">
        <section className="section">
          <div className="container centered-block">
            <BrandLockup />
            <p className="status-text status-text--error">{error || 'Unable to load the site right now.'}</p>
            {import.meta.env.DEV && (
              <p className="muted-text">
                In local dev, verify the backend is returning valid JSON from <code>/api/public/site</code>.
              </p>
            )}
          </div>
        </section>
      </div>
    );
  }

  const sections = data.sections || {};
  const settings = data.settings || {};
  const services = Array.isArray(data.services) ? data.services : [];
  const galleryItems = Array.isArray(data.gallery_items) ? data.gallery_items : [];
  const featuredReviews = Array.isArray(data.featured_reviews) ? data.featured_reviews : [];
  const retailCategories = Array.isArray(data.retail_categories) ? data.retail_categories : [];
  const visibleSections = computeVisibleSections(sections, services, galleryItems, featuredReviews, retailCategories, settings);
  const legalSections = computeLegalSections(sections);
  const navSections = SECTION_LINKS.filter((item) => visibleSections[item.id]);
  const primaryCta = resolvePrimaryCta(visibleSections, settings);
  const secondaryCta = resolveSecondaryCta(visibleSections, settings, primaryCta);
  const brandHref = visibleSections.hero ? '#hero' : navSections[0] ? `#${navSections[0].id}` : '/';
  const showFooter = isSectionEnabled(sections.footer);

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Header
        settings={settings}
        sections={navSections}
        legalSections={legalSections}
        compact={showNav}
        primaryCta={primaryCta}
        brandHref={brandHref}
      />
      <main id="main-content">
        {visibleSections.hero && (
          <HeroSection settings={settings} content={sections.hero || {}} primaryCta={primaryCta} secondaryCta={secondaryCta} />
        )}
        {visibleSections.trust && <TrustStrip settings={settings} content={sections.trust || {}} />}
        {visibleSections.services && (
          <ServicesSection content={sections.services || {}} services={services} settings={settings} primaryCta={primaryCta} />
        )}
        {visibleSections.booking && <BookingSection settings={settings} content={sections.booking || {}} services={services} />}
        {visibleSections.gallery && <GallerySection content={sections.gallery || {}} items={galleryItems} />}
        {visibleSections.retail && <RetailSection content={sections.retail || {}} categories={retailCategories} settings={settings} />}
        {visibleSections.reviews && (
          <ReviewsSection settings={settings} content={sections.reviews || {}} items={featuredReviews} primaryCta={primaryCta} />
        )}
        {visibleSections.about && <AboutSection content={sections.about || {}} settings={settings} />}
        {visibleSections.contact && <ContactSection content={sections.contact || {}} location={sections.location || {}} settings={settings} />}
        {visibleSections.faq && <FaqSection content={sections.faq || {}} items={sections.faq?.items || []} />}
        {visibleSections.policies && <PoliciesSection content={sections.policies || {}} items={sections.policies?.items || []} />}
      </main>
      {showFooter && (
        <Footer sections={navSections} legalSections={legalSections} settings={settings} content={sections.footer || {}} primaryCta={primaryCta} />
      )}
      <MobileActionBar settings={settings} primaryCta={primaryCta} visible={showMobileActionBar} />
    </div>
  );
}

function Header({ settings, sections, legalSections, compact, primaryCta, brandHref }) {
  const [open, setOpen] = useState(false);
  const headerRef = useRef(null);
  const location = useLocation();
  const phoneHref = settings.phone ? toPhoneHref(settings.phone) : null;

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    const closeOnOutsidePress = (event) => {
      if (headerRef.current?.contains(event.target)) {
        return;
      }

      setOpen(false);
    };

    document.body.classList.add('has-site-nav-open');
    window.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOnOutsidePress);

    return () => {
      document.body.classList.remove('has-site-nav-open');
      window.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOnOutsidePress);
    };
  }, [open]);

  return (
    <header ref={headerRef} className={`site-header ${compact ? 'site-header--compact' : ''}`}>
      <div className="container site-header__inner">
        <a href={brandHref} className="brand-link" onClick={() => setOpen(false)}>
          <BrandLockup compact={compact} />
        </a>

        <nav className="site-nav">
          <button
            type="button"
            className="menu-toggle"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="site-nav-drawer"
            aria-label={open ? 'Close site navigation' : 'Open site navigation'}
          >
            Menu
          </button>
          <div className="site-nav__desktop">
            {sections.map((section) => (
              <a key={section.id} href={`#${section.id}`}>
                {section.label}
              </a>
            ))}
          </div>
        </nav>

        <div className="header-actions">
          {phoneHref && (
            <a className="btn btn-outline" href={phoneHref}>
              Call
            </a>
          )}
          {primaryCta && primaryCta.kind !== 'phone' && (
            <a className="btn btn-primary" href={primaryCta.href}>
              {primaryCta.label}
            </a>
          )}
        </div>
      </div>

      {open && (
        <div className="site-nav__drawer-shell">
          <div className="container">
            <div id="site-nav-drawer" className="site-nav__drawer" aria-label="Site navigation">
              {sections.map((section) => (
                <a key={section.id} href={`#${section.id}`} onClick={() => setOpen(false)}>
                  {section.label}
                </a>
              ))}
              {legalSections?.privacy && (
                <Link to="/privacy" onClick={() => setOpen(false)}>
                  Privacy
                </Link>
              )}
              {legalSections?.terms && (
                <Link to="/terms" onClick={() => setOpen(false)}>
                  Terms
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function HeroSection({ settings, content, primaryCta, secondaryCta }) {
  const phoneHref = settings.phone ? toPhoneHref(settings.phone) : null;
  const servingAreaLabel = escapeHtml(settings.serving_area || 'Greater Winston-Salem and the Triad area');
  const heroSubheading =
    content.subheading ||
    `<p>Gentle grooming, spa baths, and comfort-focused care for dogs in ${servingAreaLabel}.</p><p>Request an appointment online and hear back within 24 hours.</p>`;
  const valuePoints = [
    settings.serving_area,
    'Appointment-based care',
    'Comfort-focused grooming',
  ].filter(Boolean);

  return (
    <section id="hero" className="hero-section">
      <div className="container hero-grid">
        <div className="hero-copy">
          {textHasContent(content.eyebrow) && <p className="eyebrow">{content.eyebrow}</p>}
          <h1>{content.headline || 'Calm grooming care and a boutique dog spa experience.'}</h1>
          <div className="hero-subheading" dangerouslySetInnerHTML={{ __html: heroSubheading }} />
          <div className="hero-actions">
            {primaryCta && (
              <a className="btn btn-primary" href={primaryCta.href}>
                {primaryCta.kind === 'booking' ? content.cta_text || primaryCta.label : primaryCta.label}
              </a>
            )}
            {secondaryCta && (
              <a className="btn btn-outline" href={secondaryCta.href}>
                {textHasContent(content.cta_secondary) ? content.cta_secondary : secondaryCta.label}
              </a>
            )}
            {!secondaryCta && phoneHref && (
              <a className="btn btn-outline" href={phoneHref}>
                Call {settings.phone}
              </a>
            )}
          </div>
          {textHasContent(content.cta_secondary) && phoneHref && (
            <a className="text-link hero-support-link" href={phoneHref}>
              Call {settings.phone}
            </a>
          )}
          <div className="pill-row">
            {valuePoints.map((point) => (
              <span key={point} className="pill">
                {point}
              </span>
            ))}
          </div>
        </div>

        <div className="hero-card">
          <div className="hero-card__label">Why families book here</div>
          <ul className="feature-list">
            <li>Clear services and starting prices</li>
            <li>Easy mobile-first appointment requests</li>
            <li>Thoughtful handling for first-timers and sensitive dogs</li>
          </ul>
          <div className="hero-contact-card">
            <span>Need help first?</span>
            {settings.phone && <a href={phoneHref}>Call {settings.phone}</a>}
            {settings.hours && <p>{settings.hours}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustStrip({ settings, content }) {
  const points = Array.isArray(content.points) ? content.points : [];
  const hasGoogleSummary = textHasContent(settings.google_review_rating) && textHasContent(settings.google_review_count);

  return (
    <section id="trust" className="section section--soft">
      <div className="container">
        <div className="section-heading section-heading--tight">
          <p className="eyebrow">Trust signals</p>
          <h2>{content.title || 'Why local families choose Bow Wow’s'}</h2>
          {textHasContent(content.intro) && <div className="section-intro" dangerouslySetInnerHTML={{ __html: content.intro }} />}
        </div>

        <div className="trust-grid">
          <div className="trust-summary-card">
            <div className="stars">★★★★★</div>
            {hasGoogleSummary ? (
              <>
                <strong>{settings.google_review_rating} / 5 on Google</strong>
                <p>{settings.google_review_count} reviews</p>
              </>
            ) : (
              <>
                <strong>Thoughtful neighborhood grooming</strong>
                <p>Honest scheduling, gentle handling, and boutique-level attention.</p>
              </>
            )}
            {textHasContent(settings.google_reviews_url) && (
              <a className="text-link" href={settings.google_reviews_url} target="_blank" rel="noopener noreferrer">
                View the full Google profile
              </a>
            )}
          </div>

          <div className="proof-strip">
            {points.map((point, index) => (
              <article key={point.title || index} className="proof-card">
                <h3>{point.title}</h3>
                <p>{point.text}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ServicesSection({ content, services, settings, primaryCta }) {
  return (
    <section id="services" className="section">
      <div className="container">
        <div className="section-heading">
          <p className="eyebrow">Services & pricing</p>
          <h2>{content.title || 'Clear service options with transparent starting prices'}</h2>
          {textHasContent(content.intro) && <div className="section-intro" dangerouslySetInnerHTML={{ __html: content.intro }} />}
        </div>

        <div className="accordion-list">
          {services.map((service) => (
            <details key={service.id} className="accordion-card">
              <summary>
                <div>
                  <h3>{service.name}</h3>
                  <p>{service.short_summary}</p>
                </div>
                <div className="service-meta">
                  {service.price_label && <span>{service.price_label}</span>}
                  <span>{formatDuration(service.duration_minutes)}</span>
                </div>
              </summary>
              <div className="accordion-body">
                {textHasContent(service.description) && <div dangerouslySetInnerHTML={{ __html: service.description }} />}
                {textHasContent(service.breed_weight_note) && <p className="muted-text">{service.breed_weight_note}</p>}
                {primaryCta && (
                  <a className="btn btn-outline" href={primaryCta.href}>
                    {primaryCta.kind === 'booking' ? 'Request This Service' : primaryCta.label}
                  </a>
                )}
              </div>
            </details>
          ))}
        </div>

        {textHasContent(content.disclaimer) && (
          <div className="section-note" dangerouslySetInnerHTML={{ __html: content.disclaimer }} />
        )}

        <div className="section-cta">
          <div>
            <strong>Ready to request a time?</strong>
            <p>Pick the services first and we’ll show only appointment windows that fit your dog count and visit length.</p>
          </div>
          <div className="section-cta__actions">
            {primaryCta && primaryCta.kind !== 'phone' && (
              <a className="btn btn-primary" href={primaryCta.href}>
                {primaryCta.label}
              </a>
            )}
            {settings.phone && (
              <a className="btn btn-outline" href={toPhoneHref(settings.phone)}>
                Call {settings.phone}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function BookingSection({ settings, content, services }) {
  const [step, setStep] = useState(1);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [dogCount, setDogCount] = useState(1);
  const [bookingDate, setBookingDate] = useState(todayString());
  const [availability, setAvailability] = useState([]);
  const [availabilityMeta, setAvailabilityMeta] = useState({ duration_minutes: 0 });
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [holdToken, setHoldToken] = useState(null);
  const [nextAvailableSuggestion, setNextAvailableSuggestion] = useState(null);
  const [slotError, setSlotError] = useState(null);
  const [flowStatus, setFlowStatus] = useState(null);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    owner_name: '',
    phone: '',
    email: '',
    vet_name: '',
    vet_phone: '',
    notes: '',
    paperwork_notes: '',
    paperwork_upload: null,
    dogs: [createDog()],
  });

  const selectedServices = services.filter((service) => selectedServiceIds.includes(service.id));
  const durationSummary = selectedServices.reduce((sum, service) => sum + Number(service.duration_minutes || 0), 0) * dogCount;
  const appointmentNotice = content.notice || 'Our team will review it and confirm within 24 hours.';
  const availabilityMessage = content.availability_note || 'Available times update based on selected services and number of dogs.';
  const selectedServicesLabel = selectedServices.map((service) => service.name).join(', ');
  const maxReachableStep = selectedSlot ? (canIntakeContinue(form) ? 4 : 3) : (selectedServiceIds.length > 0 ? 2 : 1);

  useEffect(() => {
    setForm((current) => {
      const nextDogs = [...current.dogs];
      while (nextDogs.length < dogCount) {
        nextDogs.push(createDog());
      }
      while (nextDogs.length > dogCount) {
        nextDogs.pop();
      }
      return { ...current, dogs: nextDogs };
    });
  }, [dogCount]);

  useEffect(() => {
    if (selectedServiceIds.length === 0) {
      setAvailability([]);
      setAvailabilityMeta({ duration_minutes: 0 });
      setSelectedSlot(null);
      setHoldToken(null);
      setNextAvailableSuggestion(null);
      setSlotError(null);
      return;
    }

    let ignore = false;

    const loadAvailability = async () => {
      setLoadingAvailability(true);
      setSlotError(null);
      try {
        const response = await axios.get('/api/public/schedule', {
          params: {
            date: bookingDate,
            service_ids: selectedServiceIds,
            pet_count: dogCount,
            hold_token: holdToken || undefined,
          },
        });

        if (!ignore) {
          setAvailability(response.data.data.availability || []);
          setAvailabilityMeta({
            duration_minutes: response.data.data.duration_minutes || durationSummary || 0,
          });
          setNextAvailableSuggestion(response.data.data.next_available || null);
        }
      } catch (error) {
        if (!ignore) {
          setAvailability([]);
          setNextAvailableSuggestion(null);
          setSlotError(error.response?.data?.error?.message || 'Unable to load availability right now.');
        }
      } finally {
        if (!ignore) {
          setLoadingAvailability(false);
        }
      }
    };

    loadAvailability();
    return () => {
      ignore = true;
    };
  }, [bookingDate, dogCount, durationSummary, holdToken, selectedServiceIds]);

  useEffect(() => {
    if (!selectedSlot || loadingAvailability) {
      return;
    }

    const slotStillVisible = availability.some((slot) => slot.time === selectedSlot.time);
    if (!slotStillVisible) {
      setSelectedSlot(null);
      setHoldToken(null);
      setSlotError('Available times updated. Please choose a new time that matches the current services and dog count.');
      setStep(2);
    }
  }, [availability, loadingAvailability, selectedSlot]);

  const toggleService = (serviceId) => {
    setFlowStatus(null);
    setSubmitStatus(null);
    setSelectedSlot(null);
    setHoldToken(null);
    setNextAvailableSuggestion(null);
    setSelectedServiceIds((current) =>
      current.includes(serviceId) ? current.filter((id) => id !== serviceId) : [...current, serviceId],
    );
  };

  const formatSuggestionSummary = (suggestion) => {
    if (!suggestion) {
      return '';
    }

    const dateLabel = suggestion.date_label || formatDateLong(suggestion.date);
    return `${dateLabel} at ${suggestion.label}`;
  };

  const jumpToNextAvailable = async () => {
    if (!nextAvailableSuggestion) {
      return;
    }

    setFlowStatus(null);
    setSubmitStatus(null);
    setSelectedSlot(null);
    setHoldToken(null);

    if (nextAvailableSuggestion.date && nextAvailableSuggestion.date !== bookingDate) {
      setBookingDate(nextAvailableSuggestion.date);
      setSlotError(`Showing the nearest available opening: ${formatSuggestionSummary(nextAvailableSuggestion)}.`);
      return;
    }

    await chooseSlot(nextAvailableSuggestion);
  };

  const chooseSlot = async (slot) => {
    setSlotError(null);
    setFlowStatus(null);
    setSubmitStatus(null);
    try {
      const response = await axios.post('/api/public/booking-hold', {
        date: bookingDate,
        time: slot.time,
        selected_services: selectedServiceIds,
        pet_count: dogCount,
        previous_hold_token: holdToken,
      });

      setSelectedSlot(slot);
      setHoldToken(response.data.data.hold_token);
      setNextAvailableSuggestion(null);
      setStep(3);
    } catch (error) {
      const message = error.response?.data?.error?.message || 'That time is no longer available.';
      const nextAvailable = error.response?.data?.error?.next_available || null;
      setNextAvailableSuggestion(nextAvailable);
      if (nextAvailable?.date && nextAvailable.date !== bookingDate) {
        setBookingDate(nextAvailable.date);
      }
      setSlotError(nextAvailable ? `${message} Nearest available: ${formatSuggestionSummary(nextAvailable)}.` : message);
    }
  };

  const updateDog = (index, key, value) => {
    setFlowStatus(null);
    setForm((current) => ({
      ...current,
      dogs: current.dogs.map((dog, dogIndex) => (dogIndex === index ? { ...dog, [key]: value } : dog)),
    }));
  };

  const addAnotherDog = () => {
    setDogCount((count) => count + 1);
    setSelectedSlot(null);
    setHoldToken(null);
    setNextAvailableSuggestion(null);
    setFlowStatus(null);
    setSubmitStatus(null);
    setSlotError('Dog count changed. Please choose a new time so availability matches the total appointment length.');
    setStep(2);
  };

  const changeStep = (nextStep) => {
    setFlowStatus(null);
    setSubmitStatus(null);

    if (nextStep <= step) {
      setStep(nextStep);
      return;
    }

    if (nextStep >= 2 && selectedServiceIds.length === 0) {
      setStep(1);
      setFlowStatus({ tone: 'error', message: 'Select at least one service before continuing.' });
      return;
    }

    if (nextStep >= 3 && !selectedSlot) {
      setStep(2);
      setFlowStatus({ tone: 'error', message: 'Choose an available time before moving to intake details.' });
      return;
    }

    if (nextStep >= 4 && !canIntakeContinue(form)) {
      setStep(3);
      setFlowStatus({ tone: 'error', message: 'Complete the owner details plus each dog’s name and approximate weight before reviewing.' });
      return;
    }

    setStep(nextStep);
  };

  const submitBooking = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFlowStatus(null);
    setSubmitStatus(null);

    try {
      const payload = new FormData();
      payload.append('owner_name', form.owner_name);
      payload.append('phone', form.phone);
      payload.append('email', form.email);
      payload.append('vet_name', form.vet_name);
      payload.append('vet_phone', form.vet_phone);
      payload.append('notes', form.notes);
      payload.append('paperwork_notes', form.paperwork_notes);
      payload.append('date', bookingDate);
      payload.append('time', selectedSlot?.time || '');
      payload.append('hold_token', holdToken || '');
      payload.append('pet_count', String(dogCount));
      payload.append('selected_services', JSON.stringify(selectedServiceIds));
      payload.append('dogs', JSON.stringify(form.dogs));
      if (form.paperwork_upload) {
        payload.append('paperwork_upload', form.paperwork_upload);
      }

      await axios.post('/api/public/booking-request', payload, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSubmitStatus({
        tone: 'success',
        message: 'Request submitted. Our team will review it and confirm within 24 hours.',
      });
      setStep(1);
      setSelectedServiceIds([]);
      setDogCount(1);
      setBookingDate(todayString());
      setAvailability([]);
      setSelectedSlot(null);
      setHoldToken(null);
      setNextAvailableSuggestion(null);
      setForm({
        owner_name: '',
        phone: '',
        email: '',
        vet_name: '',
        vet_phone: '',
        notes: '',
        paperwork_notes: '',
        paperwork_upload: null,
        dogs: [createDog()],
      });
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Unable to submit your request right now.';
      const nextAvailable = error.response?.data?.error?.next_available || null;
      if (requiresNewSlot(message)) {
        setSelectedSlot(null);
        setHoldToken(null);
        setNextAvailableSuggestion(nextAvailable);
        if (nextAvailable?.date && nextAvailable.date !== bookingDate) {
          setBookingDate(nextAvailable.date);
        }
        setStep(2);
      }
      setSubmitStatus({
        tone: 'error',
        message: nextAvailable ? `${message} Nearest available: ${formatSuggestionSummary(nextAvailable)}.` : message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const canContinueToSlots = selectedServiceIds.length > 0;
  const canContinueToReview = canIntakeContinue(form);

  return (
    <section id="booking" className="section section--booking">
      <div className="container">
        <div className="section-heading">
          <p className="eyebrow">Request appointment</p>
          <h2>{content.title || 'Simple, service-aware booking built for phones'}</h2>
          {textHasContent(content.intro) && <div className="section-intro" dangerouslySetInnerHTML={{ __html: content.intro }} />}
        </div>

        <div className="booking-layout">
          <div className="booking-card">
            <BookingSteps step={step} onStepChange={changeStep} maxStep={maxReachableStep} />

            <div className="booking-stage">
              {flowStatus && (
                <p
                  role={flowStatus.tone === 'error' ? 'alert' : 'status'}
                  aria-live={flowStatus.tone === 'error' ? 'assertive' : 'polite'}
                  aria-atomic="true"
                  className={`status-text ${flowStatus.tone === 'error' ? 'status-text--error' : 'status-text--success'}`}
                >
                  {flowStatus.message}
                </p>
              )}

              {step === 1 && (
                <>
                  <div className="booking-stage__header">
                    <h3>Step 1: Select services</h3>
                    <p>Choose one or more services, then tell us how many dogs you’re bringing.</p>
                  </div>

                  <div className="service-selector-grid">
                    {services.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        className={`service-chip-card ${selectedServiceIds.includes(service.id) ? 'is-active' : ''}`}
                        onClick={() => toggleService(service.id)}
                        aria-pressed={selectedServiceIds.includes(service.id)}
                      >
                        <span>{service.name}</span>
                        <strong>{service.price_label || formatDuration(service.duration_minutes)}</strong>
                        <small>{formatDuration(service.duration_minutes)}</small>
                      </button>
                    ))}
                  </div>

                  <div className="dog-count-card">
                    <div>
                      <strong>How many dogs are in this request?</strong>
                      <p>We use this to calculate the right appointment length before you pick a time.</p>
                    </div>
                    <div className="dog-count-controls">
                      <button
                        type="button"
                        aria-label="Remove one dog from this request"
                        onClick={() => {
                          setDogCount((count) => Math.max(1, count - 1));
                          setSelectedSlot(null);
                          setHoldToken(null);
                          setNextAvailableSuggestion(null);
                          setFlowStatus(null);
                          setSubmitStatus(null);
                        }}
                      >
                        −
                      </button>
                      <span>{dogCount}</span>
                      <button
                        type="button"
                        aria-label="Add one dog to this request"
                        onClick={() => {
                          setDogCount((count) => count + 1);
                          setSelectedSlot(null);
                          setHoldToken(null);
                          setNextAvailableSuggestion(null);
                          setFlowStatus(null);
                          setSubmitStatus(null);
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="booking-summary-banner">
                    <strong>Estimated appointment length:</strong> {formatDuration(availabilityMeta.duration_minutes || durationSummary || 30)}
                  </div>

                  {!canContinueToSlots && (
                    <p className="muted-text">Select at least one service to unlock available times.</p>
                  )}

                  <div className="step-actions">
                    <button className="btn btn-primary" type="button" onClick={() => changeStep(2)}>
                      Continue to available times
                    </button>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="booking-stage__header">
                    <h3>Step 2: Select date & time</h3>
                    <p>{availabilityMessage}</p>
                  </div>

                  <div className="booking-summary-banner booking-summary-banner--notice">
                    <strong>This is a request, not an instant booking.</strong> {appointmentNotice}
                  </div>

                  <div className="date-picker-card">
                    <label htmlFor="booking-date">Preferred date</label>
                    <input
                      id="booking-date"
                      type="date"
                      value={bookingDate}
                      min={todayString()}
                      onChange={(event) => {
                        setBookingDate(event.target.value);
                        setSelectedSlot(null);
                        setHoldToken(null);
                        setNextAvailableSuggestion(null);
                        setSubmitStatus(null);
                        setFlowStatus(null);
                      }}
                    />
                  </div>

                  <div className="booking-summary-banner">
                    <strong>Total duration:</strong> {formatDuration(availabilityMeta.duration_minutes || durationSummary || 30)} for {dogCount} dog{dogCount === 1 ? '' : 's'}
                    {selectedServicesLabel && <span className="summary-inline-copy"> · {selectedServicesLabel}</span>}
                  </div>

                  {loadingAvailability ? (
                    <p className="muted-text" role="status" aria-live="polite">
                      Loading available times…
                    </p>
                  ) : (
                    <div className="slot-grid">
                      {availability.map((slot) => (
                        <button
                          key={slot.time}
                          type="button"
                          className={`slot-button ${selectedSlot?.time === slot.time ? 'is-active' : ''}`}
                          data-slot-time={slot.time}
                          onClick={() => chooseSlot(slot)}
                          aria-pressed={selectedSlot?.time === slot.time}
                        >
                          <span>{slot.label}</span>
                          <small>{slot.range_label}</small>
                        </button>
                      ))}
                    </div>
                  )}

                  {!loadingAvailability && availability.length === 0 && (
                    <div className="empty-state">
                      <p>No appointment times are currently open for those services on that date.</p>
                      {nextAvailableSuggestion && (
                        <div className="next-available-card">
                          <strong>Nearest available opening</strong>
                          <p>{formatSuggestionSummary(nextAvailableSuggestion)}</p>
                          <button className="btn btn-primary" type="button" onClick={jumpToNextAvailable}>
                            {nextAvailableSuggestion.date === bookingDate ? `Use ${nextAvailableSuggestion.label}` : `Jump to ${nextAvailableSuggestion.date_label || formatDateLong(nextAvailableSuggestion.date)}`}
                          </button>
                        </div>
                      )}
                      {settings.phone && (
                        <a className="text-link" href={toPhoneHref(settings.phone)}>
                          Call for help finding the best next opening
                        </a>
                      )}
                    </div>
                  )}

                  {slotError && (
                    <p role="alert" aria-live="assertive" aria-atomic="true" className="status-text status-text--error">
                      {slotError}
                    </p>
                  )}

                  <div className="step-actions">
                    <button className="btn btn-outline" type="button" onClick={() => changeStep(1)}>
                      Back
                    </button>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div className="booking-stage__header">
                    <h3>Step 3: Intake details</h3>
                    <p>Share owner, dog, vet, and paperwork details. We keep the form focused and easy on mobile.</p>
                  </div>

                  <div className="booking-summary-banner">
                    <strong>Selected appointment:</strong> {formatDateLong(bookingDate)} · {selectedSlot?.range_label || selectedSlot?.label}
                  </div>

                  <form className="booking-form-grid" onSubmit={(event) => event.preventDefault()}>
                    <div className="field-group">
                      <label htmlFor="booking-owner-name">Owner name</label>
                      <input
                        id="booking-owner-name"
                        name="ownerName"
                        autoComplete="name"
                        value={form.owner_name}
                        onChange={(event) => setForm((current) => ({ ...current, owner_name: event.target.value }))}
                        required
                      />
                    </div>
                    <div className="field-group">
                      <label htmlFor="booking-owner-phone">Phone</label>
                      <input
                        id="booking-owner-phone"
                        name="ownerPhone"
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        value={form.phone}
                        onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                        required
                      />
                    </div>
                    <div className="field-group">
                      <label htmlFor="booking-owner-email">Email</label>
                      <input
                        id="booking-owner-email"
                        name="ownerEmail"
                        type="email"
                        autoComplete="email"
                        spellCheck={false}
                        autoCapitalize="none"
                        value={form.email}
                        onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                        required
                      />
                    </div>
                    <div className="field-group">
                      <label htmlFor="booking-vet-name">Vet name</label>
                      <input
                        id="booking-vet-name"
                        name="vetName"
                        autoComplete="organization"
                        value={form.vet_name}
                        onChange={(event) => setForm((current) => ({ ...current, vet_name: event.target.value }))}
                      />
                    </div>
                    <div className="field-group">
                      <label htmlFor="booking-vet-phone">Vet phone</label>
                      <input
                        id="booking-vet-phone"
                        name="vetPhone"
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        value={form.vet_phone}
                        onChange={(event) => setForm((current) => ({ ...current, vet_phone: event.target.value }))}
                      />
                    </div>
                  </form>

                  <div className="dog-intake-list">
                    {form.dogs.map((dog, index) => (
                      <article key={`dog-${index}`} className="dog-intake-card">
                        <div className="booking-card__header">
                          <h4>Dog {index + 1}</h4>
                        </div>
                        <div className="booking-form-grid">
                          <div className="field-group">
                            <label htmlFor={`booking-dog-name-${index}`}>Name</label>
                            <input
                              id={`booking-dog-name-${index}`}
                              name={`dogName${index}`}
                              autoComplete="off"
                              value={dog.pet_name}
                              onChange={(event) => updateDog(index, 'pet_name', event.target.value)}
                              required
                            />
                          </div>
                          <div className="field-group">
                            <label htmlFor={`booking-dog-breed-${index}`}>Breed</label>
                            <input
                              id={`booking-dog-breed-${index}`}
                              name={`dogBreed${index}`}
                              autoComplete="off"
                              value={dog.breed}
                              onChange={(event) => updateDog(index, 'breed', event.target.value)}
                            />
                          </div>
                          <div className="field-group">
                            <label htmlFor={`booking-dog-weight-${index}`}>Approximate weight</label>
                            <input
                              id={`booking-dog-weight-${index}`}
                              name={`dogWeight${index}`}
                              autoComplete="off"
                              value={dog.approximate_weight}
                              onChange={(event) => updateDog(index, 'approximate_weight', event.target.value)}
                              required
                            />
                          </div>
                          <div className="field-group field-group--wide">
                            <label htmlFor={`booking-dog-temperament-${index}`}>Temperament notes</label>
                            <textarea
                              id={`booking-dog-temperament-${index}`}
                              name={`dogTemperament${index}`}
                              autoComplete="off"
                              placeholder="Handling notes, first-visit nerves, or anything that helps…"
                              value={dog.temperament_notes}
                              onChange={(event) => updateDog(index, 'temperament_notes', event.target.value)}
                            />
                          </div>
                          <div className="field-group field-group--wide">
                            <label htmlFor={`booking-dog-medical-${index}`}>Medical or grooming notes</label>
                            <textarea
                              id={`booking-dog-medical-${index}`}
                              name={`dogMedicalNotes${index}`}
                              autoComplete="off"
                              placeholder="Allergies, medications, mobility notes, or recent changes…"
                              value={dog.medical_or_grooming_notes}
                              onChange={(event) => updateDog(index, 'medical_or_grooming_notes', event.target.value)}
                            />
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>

                  <button type="button" className="btn btn-outline add-dog-button" onClick={addAnotherDog}>
                    Add another dog
                  </button>

                  <div className="booking-form-grid">
                    <div className="field-group field-group--wide">
                      <label htmlFor="booking-request-notes">Additional request notes</label>
                      <textarea
                        id="booking-request-notes"
                        name="requestNotes"
                        autoComplete="off"
                        placeholder="Preferred timing, grooming goals, or anything else to know…"
                        value={form.notes}
                        onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                      />
                    </div>
                    <div className="field-group field-group--wide upload-card">
                      <label htmlFor="booking-paperwork-upload">Upload paperwork (PDF, JPG, PNG)</label>
                      <input
                        id="booking-paperwork-upload"
                        name="paperworkUpload"
                        type="file"
                        accept=".pdf,image/jpeg,image/png"
                        aria-describedby="booking-paperwork-help"
                        onChange={(event) => {
                          setFlowStatus(null);
                          setSubmitStatus(null);
                          setForm((current) => ({ ...current, paperwork_upload: event.target.files?.[0] || null }));
                        }}
                      />
                      <small id="booking-paperwork-help">Accepted file types: PDF, JPG, PNG. If you do not upload a file, you can summarize the paperwork below.</small>
                      {form.paperwork_upload && (
                        <div className="file-chip-row">
                          <span className="file-chip">{form.paperwork_upload.name}</span>
                          <button
                            type="button"
                            className="text-link"
                            onClick={() => setForm((current) => ({ ...current, paperwork_upload: null }))}
                          >
                            Remove file
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="field-group field-group--wide">
                      <label htmlFor="booking-paperwork-summary">Paperwork summary</label>
                      <textarea
                        id="booking-paperwork-summary"
                        name="paperworkSummary"
                        autoComplete="off"
                        placeholder="Vaccines on file, paperwork details, or follow-up notes…"
                        value={form.paperwork_notes}
                        onChange={(event) => setForm((current) => ({ ...current, paperwork_notes: event.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="step-actions">
                    <button className="btn btn-outline" type="button" onClick={() => changeStep(2)}>
                      Back
                    </button>
                    <button className="btn btn-primary" type="button" onClick={() => changeStep(4)}>
                      Review request
                    </button>
                  </div>
                </>
              )}

              {step === 4 && (
                <form onSubmit={submitBooking}>
                  <div className="booking-stage__header">
                    <h3>Step 4: Review & submit</h3>
                    <p>This is a request. {appointmentNotice}</p>
                  </div>

                  <div className="booking-summary-banner booking-summary-banner--notice">
                    <strong>Request review window:</strong> Our team reviews requests and confirms within 24 hours.
                  </div>

                  <div className="review-grid">
                    <article className="review-card">
                      <h4>Selected services</h4>
                      <ul>
                        {selectedServices.map((service) => (
                          <li key={service.id}>
                            {service.name} · {formatDuration(service.duration_minutes)}
                          </li>
                        ))}
                      </ul>
                    </article>
                    <article className="review-card">
                      <h4>Requested time</h4>
                      <p>{formatDateLong(bookingDate)}</p>
                      <p>{selectedSlot?.range_label || selectedSlot?.label}</p>
                      <p className="muted-text">
                        {formatDuration(availabilityMeta.duration_minutes || durationSummary || 30)} total for {dogCount} dog{dogCount === 1 ? '' : 's'}
                      </p>
                    </article>
                    <article className="review-card">
                      <h4>Owner details</h4>
                      <p>{form.owner_name}</p>
                      <p>{form.phone}</p>
                      <p>{form.email}</p>
                    </article>
                    <article className="review-card">
                      <h4>Dogs</h4>
                      <ul>
                        {form.dogs.map((dog, index) => (
                          <li key={`${dog.pet_name}-${index}`}>
                            {dog.pet_name} {dog.breed ? `· ${dog.breed}` : ''} {dog.approximate_weight ? `· ${dog.approximate_weight}` : ''}
                          </li>
                        ))}
                      </ul>
                    </article>
                    <article className="review-card">
                      <h4>Paperwork</h4>
                      <p>{form.paperwork_upload?.name || 'No file uploaded'}</p>
                      <p className="muted-text">{form.paperwork_notes || 'No paperwork summary added.'}</p>
                    </article>
                  </div>

                  <div className="step-actions">
                    <button className="btn btn-outline" type="button" onClick={() => changeStep(3)}>
                      Back
                    </button>
                    <button className="btn btn-primary" type="submit" disabled={submitting}>
                      {submitting ? 'Submitting…' : 'Submit appointment request'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {submitStatus && (
              <p
                role={submitStatus.tone === 'error' ? 'alert' : 'status'}
                aria-live={submitStatus.tone === 'error' ? 'assertive' : 'polite'}
                aria-atomic="true"
                className={`status-text ${submitStatus.tone === 'error' ? 'status-text--error' : 'status-text--success'}`}
              >
                {submitStatus.message}
              </p>
            )}
          </div>

          <aside className="booking-sidebar">
            <div className="sidebar-card">
              <h3>What to expect</h3>
              <ul className="feature-list">
                <li>Choose services first so only valid time buttons appear.</li>
                <li>Requests are reviewed by staff before they are confirmed.</li>
                <li>We’ll follow up within 24 hours by email or phone.</li>
              </ul>
            </div>
            <div className="sidebar-card sidebar-card--accent">
              <h3>Need immediate help?</h3>
              {settings.phone ? (
                <a className="text-link" href={toPhoneHref(settings.phone)}>
                  Call {settings.phone}
                </a>
              ) : (
                <p>Use the contact form below and we’ll help you choose the right visit.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function GallerySection({ content, items }) {
  return (
    <section id="gallery" className="section">
      <div className="container">
        <div className="section-heading">
          <p className="eyebrow">Visual trust</p>
          <h2>{content.title || 'Fresh from the spa'}</h2>
          {textHasContent(content.intro) && <div className="section-intro" dangerouslySetInnerHTML={{ __html: content.intro }} />}
        </div>

        <div className="gallery-grid">
          {items.map((item) => (
            <article key={item.id} className={`gallery-card gallery-card--${item.item_type || 'groomed_pet'}`}>
              {item.item_type === 'before_after' && item.primary_media && item.secondary_media ? (
                <div className="before-after-grid">
                  <figure>
                    <ResponsivePicture media={item.primary_media} alt={`${item.title} before`} />
                    <figcaption>Before</figcaption>
                  </figure>
                  <figure>
                    <ResponsivePicture media={item.secondary_media} alt={`${item.title} after`} />
                    <figcaption>After</figcaption>
                  </figure>
                </div>
              ) : (
                <ResponsivePicture media={item.primary_media || item.secondary_media} alt={item.title} />
              )}
              <div className="gallery-card__body">
                <h3>{item.title}</h3>
                {item.caption && <p>{item.caption}</p>}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function RetailSection({ content, categories, settings }) {
  const phoneHref = settings.phone ? toPhoneHref(settings.phone) : null;
  const emailHref = settings.email ? `mailto:${settings.email}` : null;
  const showCategoryLinks = categories.length > 1;

  return (
    <section id="retail" className="section section--soft">
      <div className="container">
        <div className="section-heading">
          <p className="eyebrow">In-spa products</p>
          <h2>{content.title || 'Boutique Products'}</h2>
          {textHasContent(content.body) && <div className="section-intro" dangerouslySetInnerHTML={{ __html: content.body }} />}
        </div>

        {showCategoryLinks && (
          <div className="retail-category-nav">
            {categories.map((category) => (
              <a key={category.id} className="link-chip" href={`#retail-${category.slug || category.id}`}>
                {category.name}
              </a>
            ))}
          </div>
        )}

        <div className="retail-category-groups">
          {categories.map((category) => (
            <div key={category.id} id={`retail-${category.slug || category.id}`} className="retail-category-block">
              <div className="retail-category-heading">
                <div>
                  <h3>{category.name}</h3>
                  <p>{category.items.length} item{category.items.length === 1 ? '' : 's'}</p>
                </div>
              </div>

              <div className="retail-product-grid">
                {category.items.map((item) => (
                  <article key={item.id} className="retail-card">
                    <div className="retail-card__media">
                      {item.media ? (
                        <ResponsivePicture media={item.media} alt={item.name} />
                      ) : (
                        <div className="retail-card__placeholder" aria-hidden="true">
                          {item.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="retail-card__body">
                      <div className="retail-card__meta">
                        <h4>{item.name}</h4>
                        <strong>{item.price_label || 'Ask in spa'}</strong>
                      </div>
                      {item.description && <p>{item.description}</p>}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>

        {(phoneHref || emailHref) && (
          <div className="section-cta section-cta--soft">
            <div>
              <strong>Need help choosing the right product?</strong>
              <p>Ask the team about availability, coat type recommendations, or what to pick up during your next visit.</p>
            </div>
            <div className="section-cta__actions">
              {phoneHref && (
                <a className="btn btn-outline" href={phoneHref}>
                  Call {settings.phone}
                </a>
              )}
              {emailHref && (
                <a className="btn btn-primary" href={emailHref}>
                  Email the spa
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ReviewsSection({ settings, content, items, primaryCta }) {
  const reviewUrl = settings.google_reviews_url;

  return (
    <section id="reviews" className="section section--soft">
      <div className="container">
        <div className="section-heading">
          <p className="eyebrow">Reviews & trust</p>
          <h2>{content.title || 'Google reviews and neighborhood trust'}</h2>
          {textHasContent(content.intro) && <div className="section-intro" dangerouslySetInnerHTML={{ __html: content.intro }} />}
        </div>

        <div className="reviews-shell">
          <div className="reviews-summary">
            {textHasContent(settings.google_review_rating) && textHasContent(settings.google_review_count) ? (
              <>
                <div className="stars">★★★★★</div>
                <strong>
                  {settings.google_review_rating} / 5 from {settings.google_review_count} Google reviews
                </strong>
              </>
            ) : (
              <strong>Featured excerpts from real customer feedback</strong>
            )}
            <p>
              We do not host an open on-site review form. Featured quotes here are sourced from real reviews, and the full review history lives on Google.
            </p>
            {reviewUrl && (
              <a className="btn btn-outline" href={reviewUrl} target="_blank" rel="noopener noreferrer">
                {content.cta_text || 'See All Google Reviews'}
              </a>
            )}
          </div>

          <div className="review-cards">
            {items.map((item) => (
              <article key={item.id} className="review-card">
                <div className="review-card__meta">
                  <strong>{item.reviewer_name}</strong>
                  <span>{'★'.repeat(item.star_rating)}</span>
                </div>
                <p>{item.review_text}</p>
                <small>
                  {item.source_label}
                  {item.source_url && (
                    <>
                      {' '}
                      ·{' '}
                      <a href={item.source_url} target="_blank" rel="noopener noreferrer">
                        Source
                      </a>
                    </>
                  )}
                </small>
              </article>
            ))}

            {items.length === 0 && (
              <article className="review-card">
                <p>More customer feedback is available on our Google profile.</p>
              </article>
            )}
          </div>
        </div>

        <div className="section-cta section-cta--soft">
          <div>
            <strong>Ready when you are.</strong>
            <p>See a service you need? Send a request now and we’ll confirm the right appointment window within 24 hours.</p>
          </div>
          <div className="section-cta__actions">
            {primaryCta && primaryCta.kind !== 'phone' && (
              <a className="btn btn-primary" href={primaryCta.href}>
                {primaryCta.label}
              </a>
            )}
            {settings.phone && (
              <a className="btn btn-outline" href={toPhoneHref(settings.phone)}>
                Call {settings.phone}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function AboutSection({ content, settings }) {
  return (
    <section id="about" className="section">
      <div className="container about-grid">
        <div className="section-heading section-heading--tight">
          <p className="eyebrow">Care philosophy</p>
          <h2>{content.title || 'Comfort-first care'}</h2>
          <div className="section-intro" dangerouslySetInnerHTML={{ __html: content.body || '' }} />
        </div>
        <div className="about-aside">
          <div className="sidebar-card">
            <h3>Quick highlights</h3>
            <ul className="feature-list">
              <li>Calm, appointment-based scheduling</li>
              <li>Clear intake notes and service planning</li>
              <li>Helpful follow-up by phone or email</li>
            </ul>
          </div>
          {settings.hours && (
            <div className="sidebar-card sidebar-card--accent">
              <h3>Hours</h3>
              <p>{settings.hours}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ContactSection({ content, location, settings }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const phoneHref = settings.phone ? toPhoneHref(settings.phone) : null;

  const submitContact = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);

    try {
      await axios.post('/api/public/contact', form);
      setStatus({ tone: 'success', message: 'Message received. We’ll reply soon.' });
      setForm({ name: '', email: '', phone: '', message: '' });
    } catch (error) {
      setStatus({ tone: 'error', message: error.response?.data?.error?.message || 'Unable to send your message right now.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="contact" className="section section--contact">
      <div className="container">
        <div className="section-heading">
          <p className="eyebrow">Contact & location</p>
          <h2>{content.title || 'Contact Bow Wow’s'}</h2>
          {textHasContent(content.note) && <div className="section-intro" dangerouslySetInnerHTML={{ __html: content.note }} />}
        </div>

        <div className="contact-grid">
          <div className="contact-card-list">
            {settings.phone && (
              <a className="contact-card" href={phoneHref}>
                <span>Phone</span>
                <strong>{settings.phone}</strong>
              </a>
            )}
            {settings.email && (
              <a className="contact-card" href={`mailto:${settings.email}`}>
                <span>Email</span>
                <strong>{settings.email}</strong>
              </a>
            )}
            {settings.address && (
              <a
                className="contact-card"
                href={settings.maps_url || '#contact'}
                target={settings.maps_url ? '_blank' : undefined}
                rel={settings.maps_url ? 'noopener noreferrer' : undefined}
              >
                <span>Location</span>
                <strong>{settings.address}</strong>
              </a>
            )}
            {settings.hours && (
              <div className="contact-card">
                <span>Hours</span>
                <strong>{settings.hours}</strong>
              </div>
            )}
            {textHasContent(location.note) && (
              <div className="contact-card contact-card--note">
                <span>{location.title || 'Location & hours'}</span>
                <div dangerouslySetInnerHTML={{ __html: location.note }} />
              </div>
            )}
          </div>

          <form className="contact-form-card" onSubmit={submitContact}>
            <div className="field-group">
              <label htmlFor="contact-name">Name</label>
              <input
                id="contact-name"
                name="contactName"
                autoComplete="name"
                required
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div className="field-group">
              <label htmlFor="contact-email">Email</label>
              <input
                id="contact-email"
                name="contactEmail"
                type="email"
                autoComplete="email"
                spellCheck={false}
                autoCapitalize="none"
                required
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              />
            </div>
            <div className="field-group">
              <label htmlFor="contact-phone">Phone</label>
              <input
                id="contact-phone"
                name="contactPhone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              />
            </div>
            <div className="field-group">
              <label htmlFor="contact-message">Message</label>
              <textarea
                id="contact-message"
                name="contactMessage"
                autoComplete="off"
                placeholder="Tell us what you need, your dog’s size, or your ideal visit day…"
                required
                value={form.message}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting} aria-busy={submitting}>
              {submitting ? 'Sending…' : 'Send Message'}
            </button>
            {status && (
              <p
                role={status.tone === 'error' ? 'alert' : 'status'}
                aria-live={status.tone === 'error' ? 'assertive' : 'polite'}
                aria-atomic="true"
                className={`status-text ${status.tone === 'error' ? 'status-text--error' : 'status-text--success'}`}
              >
                {status.message}
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}

function FaqSection({ content, items }) {
  return (
    <section id="faq" className="section">
      <div className="container">
        <div className="section-heading section-heading--tight">
          <p className="eyebrow">FAQ</p>
          <h2>{content.title || 'Helpful answers before you book'}</h2>
        </div>

        <div className="accordion-list">
          {items.map((item, index) => (
            <details key={index} className="accordion-card">
              <summary>
                <div>
                  <h3>{item.question}</h3>
                </div>
              </summary>
              <div className="accordion-body" dangerouslySetInnerHTML={{ __html: item.answer || '' }} />
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function PoliciesSection({ content, items }) {
  return (
    <section id="policies" className="section section--soft">
      <div className="container">
        <div className="section-heading section-heading--tight">
          <p className="eyebrow">Policies</p>
          <h2>{content.title || 'Simple expectations and care notes'}</h2>
        </div>

        <div className="policy-grid">
          {items.map((item, index) => (
            <article key={index} className="policy-card">
              <h3>{item.title}</h3>
              <div dangerouslySetInnerHTML={{ __html: item.body || '' }} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer({ sections, legalSections, settings, content, primaryCta }) {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <BrandLockup compact />
          {textHasContent(content.tagline) && <p className="footer-tagline">{content.tagline}</p>}
          {settings.address && <p>{settings.address}</p>}
          {settings.phone && (
            <p>
              <a href={toPhoneHref(settings.phone)}>{settings.phone}</a>
            </p>
          )}
          {settings.hours && <p>{settings.hours}</p>}
          {primaryCta && primaryCta.kind !== 'phone' && (
            <a className="btn btn-primary footer-cta" href={primaryCta.href}>
              {primaryCta.label}
            </a>
          )}
        </div>

        <div>
          <h4>Quick links</h4>
          {sections.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {section.label}
            </a>
          ))}
        </div>

        <div>
          <h4>Resources</h4>
          {legalSections?.privacy && <Link to="/privacy">Privacy Policy</Link>}
          {legalSections?.terms && <Link to="/terms">Terms & Conditions</Link>}
          <a href="/admin/login">Admin Login</a>
        </div>
      </div>
      <div className="container footer-credit">
        Website by <a href="https://jamarq.digital" target="_blank" rel="noopener noreferrer">JAMARQ Digital</a>
      </div>
    </footer>
  );
}

function MobileActionBar({ settings, primaryCta, visible = false }) {
  const phoneHref = settings.phone ? toPhoneHref(settings.phone) : null;

  if (!visible || (!phoneHref && (!primaryCta || primaryCta.kind === 'phone'))) {
    return null;
  }

  return (
    <div className="mobile-action-bar">
      {phoneHref && (
        <a className="btn btn-outline" href={phoneHref}>
          Call
        </a>
      )}
      {primaryCta && primaryCta.kind !== 'phone' && (
        <a className="btn btn-primary" href={primaryCta.href}>
          {primaryCta.label}
        </a>
      )}
    </div>
  );
}

function SimplePage({ fallbackTitle, blockKey }) {
  const { data, loading, error } = useSiteContent();
  const section = data?.sections?.[blockKey] || {};
  const items = section.items || [];
  const title = section.title || fallbackTitle;
  const legalSections = computeLegalSections(data?.sections || {});
  const settings = data?.settings || {};
  const galleryItems = Array.isArray(data?.gallery_items) ? data.gallery_items : [];
  const showFooter = isSectionEnabled(data?.sections?.footer || {});

  useEffect(() => {
    if (loading || error || !data) {
      return;
    }

    applySeo(buildSimpleSeo(blockKey, title, items, section.enabled !== false, settings));
    applyStructuredData(buildLocalBusinessSchema(settings, galleryItems));
  }, [blockKey, title, items, section.enabled, settings, galleryItems, loading, error, data]);

  if (loading) {
    return (
      <div className="section">
        <div className="container">
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="section">
        <div className="container">
          <p className="status-text status-text--error">{error || 'Unable to load this page right now.'}</p>
        </div>
      </div>
    );
  }

  if (section.enabled === false) {
    return (
      <>
        <section className="section">
          <div className="container simple-page">
            <Link to="/">Back to site</Link>
            <h1>{title}</h1>
            <p className="muted-text">This page is currently unavailable.</p>
          </div>
        </section>
        {showFooter && <Footer sections={[]} legalSections={legalSections} settings={settings} content={data.sections?.footer || {}} />}
      </>
    );
  }

  return (
    <>
      <section className="section">
        <div className="container simple-page">
          <Link to="/">Back to site</Link>
          <h1>{title}</h1>
          {items.map((item, index) => (
            <article key={index} className="simple-page__item">
              {item.title && <h3>{item.title}</h3>}
              <div dangerouslySetInnerHTML={{ __html: item.body || item.text || '' }} />
            </article>
          ))}
        </div>
      </section>
      {showFooter && <Footer sections={[]} legalSections={legalSections} settings={settings} content={data.sections?.footer || {}} />}
    </>
  );
}

function StatusPage({ pageKey }) {
  const navigate = useNavigate();
  const location = useLocation();
  const page = STATUS_PAGE_CONTENT[pageKey] || STATUS_PAGE_CONTENT.notFound;
  const showRequestedPath = page.status === 404 && location.pathname !== page.path;

  useEffect(() => {
    applySeo(buildStatusSeo(page));
    applyStructuredData(null);
  }, [page]);

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/', { replace: true });
  };

  return (
    <div className="site-shell">
      <main>
        <section className="section status-section">
          <div className="container status-page">
            <article className="status-panel">
              <BrandLockup />
              <p className="eyebrow">{page.eyebrow}</p>
              <h1>{page.title}</h1>
              <p className="section-intro">{page.body}</p>
              {showRequestedPath && (
                <p className="status-path">
                  Requested path: <code>{location.pathname}</code>
                </p>
              )}
              <div className="status-actions">
                <button type="button" className="btn btn-outline" onClick={goBack}>
                  Back
                </button>
                <Link className="btn btn-primary" to="/">
                  Home
                </Link>
              </div>
            </article>
          </div>
        </section>
      </main>
      <StatusFooter />
    </div>
  );
}

function StatusFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <BrandLockup compact />
          <p className="footer-tagline">Official Bow Wow’s Dog Spa website</p>
        </div>

        <div>
          <h4>Quick links</h4>
          <Link to="/">Home</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms & Conditions</Link>
        </div>

        <div>
          <h4>Resources</h4>
          <a href="/admin/login">Admin Login</a>
        </div>
      </div>
      <div className="container footer-credit">
        Website by <a href="https://jamarq.digital" target="_blank" rel="noopener noreferrer">JAMARQ Digital</a>
      </div>
    </footer>
  );
}

function BookingSteps({ step, onStepChange, maxStep = 1 }) {
  const steps = [
    { id: 1, label: 'Services' },
    { id: 2, label: 'Time' },
    { id: 3, label: 'Intake' },
    { id: 4, label: 'Review' },
  ];

  return (
    <div className="booking-steps">
      {steps.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className={`booking-step ${step === entry.id ? 'is-active' : ''} ${step > entry.id ? 'is-complete' : ''} ${entry.id > maxStep ? 'is-locked' : ''}`}
          onClick={() => onStepChange(entry.id)}
          aria-current={step === entry.id ? 'step' : undefined}
          aria-disabled={entry.id > maxStep}
        >
          <span>{entry.id}</span>
          <strong>{entry.label}</strong>
        </button>
      ))}
    </div>
  );
}

function BrandLockup({ compact = false }) {
  return (
    <div className={`brand-lockup ${compact ? 'brand-lockup--compact' : ''}`}>
      <picture className="brand-logo">
        <source srcSet={logoPrimaryWebp} type="image/webp" />
        <img
          src={logoPrimaryPng}
          alt="Bow Wow's Dog Spa logo"
          width={LOGO_WIDTH}
          height={LOGO_HEIGHT}
          fetchpriority="high"
        />
      </picture>
      <div>
        <strong>Bow Wow’s Dog Spa</strong>
        <span>Trusted neighborhood boutique</span>
      </div>
    </div>
  );
}

function ResponsivePicture({ media, alt }) {
  if (!media) {
    return null;
  }

  return (
    <picture className="responsive-picture">
      {media.webp_srcset && <source type="image/webp" srcSet={media.webp_srcset} />}
      {media.optimized_srcset && <source srcSet={media.optimized_srcset} />}
      <img
        src={media.fallback_url || media.original_url}
        alt={alt || media.alt_text || media.title || "Bow Wow's Dog Spa gallery image"}
        width={media.intrinsic_width || undefined}
        height={media.intrinsic_height || undefined}
        loading="lazy"
      />
    </picture>
  );
}

function computeVisibleSections(content, services, galleryItems, featuredReviews, retailCategories, settings = {}) {
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

function computeLegalSections(content) {
  return {
    privacy: isSectionEnabled(content.privacy) && Array.isArray(content.privacy?.items) && content.privacy.items.length > 0,
    terms: isSectionEnabled(content.terms) && Array.isArray(content.terms?.items) && content.terms.items.length > 0,
  };
}

function resolvePrimaryCta(visibleSections, settings) {
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

function resolveSecondaryCta(visibleSections, settings, primaryCta) {
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

function buildHomeSeo(settings, sections, galleryItems) {
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
    image: pickSeoImage(galleryItems),
    siteName: businessName,
    robots: 'index,follow,max-image-preview:large',
  };
}

function buildSimpleSeo(blockKey, title, items, enabled, settings) {
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

function buildStatusSeo(page) {
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

function applySeo({ title, description, path, image, robots, siteName }) {
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

function applyStructuredData(schema) {
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

function buildLocalBusinessSchema(settings, galleryItems) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
  };

  const name = textHasContent(settings.business_name) ? settings.business_name : "Bow Wow's Dog Spa";
  schema.name = name;
  schema.url = toCanonicalUrl('/');

  const image = pickSeoImage(galleryItems);
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

function pickSeoImage(galleryItems) {
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

function createDog() {
  return {
    pet_name: '',
    breed: '',
    approximate_weight: '',
    temperament_notes: '',
    medical_or_grooming_notes: '',
  };
}

function textHasContent(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSectionEnabled(section) {
  return section?.enabled !== false;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function canIntakeContinue(form) {
  return Boolean(
    form.owner_name &&
      form.phone &&
      form.email &&
      Array.isArray(form.dogs) &&
      form.dogs.length > 0 &&
      form.dogs.every((dog) => dog.pet_name.trim() && dog.approximate_weight.trim()),
  );
}

function toPhoneHref(value) {
  return `tel:${String(value).replace(/[^\d+]/g, '')}`;
}

function requiresNewSlot(message) {
  const normalized = String(message || '').toLowerCase();
  return [
    'no longer reserved',
    'no longer available',
    'selected time',
    'choose another time',
    'currently being requested',
  ].some((needle) => normalized.includes(needle));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDuration(minutes) {
  const total = Number(minutes) || 0;
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  if (hours === 0) {
    return `${remainder} min`;
  }
  if (remainder === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${remainder} min`;
}

function formatDateLong(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default App;
