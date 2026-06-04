import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BrandLockup, SiteSecuritySeal } from '../Branding';
import { toPhoneHref } from '../bookingUtils';
import { textHasContent } from '../siteConfig';

export function Header({ settings, sections, legalSections, compact, primaryCta, brandHref }) {
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


export function Footer({ sections, legalSections, settings, content, primaryCta }) {
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
          <SiteSecuritySeal />
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
          <a href="/#contact">Contact</a>
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


export function MobileActionBar({ settings, primaryCta, visible = false }) {
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


export function StatusFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <BrandLockup compact />
          <p className="footer-tagline">Official Bow Wow’s Dog Spa website</p>
          <SiteSecuritySeal />
        </div>

        <div>
          <h4>Quick links</h4>
          <Link to="/">Home</Link>
          <a href="/#contact">Contact</a>
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
