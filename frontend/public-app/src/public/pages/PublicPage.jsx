import { Fragment, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BrandLockup } from '../Branding';
import { SECTION_LINKS, computeLegalSections, computeVisibleSections, isSectionEnabled, resolvePrimaryCta, resolveSecondaryCta } from '../siteConfig';
import { applySeo, applyStructuredData, buildHomeSeo, buildLocalBusinessSchema } from '../seo';
import { useSiteContent } from '../SiteContentContext';
import { Header, Footer, MobileActionBar } from '../components/SiteLayout';
import { BookingSection } from '../components/BookingSection';
import { AboutSection, ContactSection, FaqSection, GallerySection, HeroSection, PoliciesSection, RetailSection, ReviewsSection, ServicesSection, TrustStrip } from '../components/HomeSections';

export function PublicPage({ routeSectionId = '' }) {
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
    applyStructuredData(buildLocalBusinessSchema(settings, sections.hero?.media, galleryItems));
  }, [data, loading, error]);

  useEffect(() => {
    if (loading || error || !data || (!location.hash && !routeSectionId)) {
      return;
    }

    const targetId = location.hash ? decodeURIComponent(location.hash.slice(1)) : routeSectionId;
    const target = document.getElementById(targetId);
    if (!target) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'start' });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [data, loading, error, location.hash, routeSectionId]);

  useEffect(() => {
    if (loading || error || !data || location.hash || routeSectionId) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [data, loading, error, location.hash, location.pathname, routeSectionId]);

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
  const defaultMiddleOrder = ['trust', 'services', 'booking', 'gallery', 'retail', 'reviews', 'about', 'contact', 'faq', 'policies'];
  const savedMiddleOrder = Array.isArray(sections.homepage_order?.items) ? sections.homepage_order.items : [];
  const middleOrder = [
    ...savedMiddleOrder.filter((id) => defaultMiddleOrder.includes(id)),
    ...defaultMiddleOrder.filter((id) => !savedMiddleOrder.includes(id)),
  ];
  const orderedSectionIds = ['hero', ...middleOrder];
  const navSections = orderedSectionIds
    .map((id) => SECTION_LINKS.find((item) => item.id === id))
    .filter((item) => item && visibleSections[item.id]);
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
        {middleOrder.map((sectionId) => {
          if (!visibleSections[sectionId]) {
            return null;
          }
          const renderers = {
            trust: <TrustStrip settings={settings} content={sections.trust || {}} />,
            services: <ServicesSection content={sections.services || {}} services={services} settings={settings} primaryCta={primaryCta} />,
            booking: <BookingSection settings={settings} content={sections.booking || {}} services={services} />,
            gallery: <GallerySection content={sections.gallery || {}} items={galleryItems} />,
            retail: <RetailSection content={sections.retail || {}} categories={retailCategories} settings={settings} />,
            reviews: <ReviewsSection settings={settings} content={sections.reviews || {}} items={featuredReviews} primaryCta={primaryCta} />,
            about: <AboutSection content={sections.about || {}} settings={settings} />,
            contact: <ContactSection content={sections.contact || {}} location={sections.location || {}} settings={settings} />,
            faq: <FaqSection content={sections.faq || {}} items={sections.faq?.items || []} />,
            policies: <PoliciesSection content={sections.policies || {}} items={sections.policies?.items || []} />,
          };
          return <Fragment key={sectionId}>{renderers[sectionId]}</Fragment>;
        })}
      </main>
      {showFooter && (
        <Footer sections={navSections} legalSections={legalSections} settings={settings} content={sections.footer || {}} primaryCta={primaryCta} />
      )}
      <MobileActionBar settings={settings} primaryCta={primaryCta} visible={showMobileActionBar} />
    </div>
  );
}
