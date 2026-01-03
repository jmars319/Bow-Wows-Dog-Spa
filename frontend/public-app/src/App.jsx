import { useCallback, useEffect, useMemo, useState, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import logoPrimaryPng from './assets/logos/logo-primary.png';
import logoPrimaryWebp from './assets/logos/logo-primary.webp';

const SiteContentContext = createContext({ data: null, loading: true });

const SECTION_LINKS = [
  { id: 'hero', label: 'Home' },
  { id: 'services', label: 'Services' },
  { id: 'booking', label: 'Booking' },
  { id: 'gallery', label: 'Happy Clients' },
  { id: 'retail', label: 'Retail' },
  { id: 'about', label: 'About' },
  { id: 'faq', label: 'FAQ' },
  { id: 'policies', label: 'Policies' },
  { id: 'location', label: 'Location' },
  { id: 'contact', label: 'Contact' },
];

function SiteContentProvider({ children }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await axios.get('/api/public/site');
    setData(response.data.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SiteContentContext.Provider value={{ data, loading, reload: load }}>
      {children}
    </SiteContentContext.Provider>
  );
}

function useSiteContent() {
  return useContext(SiteContentContext);
}

function App() {
  return (
    <BrowserRouter>
      <SiteContentProvider>
        <Routes>
          <Route path="/" element={<PublicPage />} />
          <Route path="/privacy" element={<SimplePage title="Privacy Policy" blockKey="privacy" />} />
          <Route path="/terms" element={<SimplePage title="Terms &amp; Conditions" blockKey="terms" />} />
        </Routes>
      </SiteContentProvider>
    </BrowserRouter>
  );
}

function PublicPage() {
  const { data, loading } = useSiteContent();
  const [bookingDate, setBookingDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [availability, setAvailability] = useState([]);
  const [selectedTime, setSelectedTime] = useState(null);
  const [holdToken, setHoldToken] = useState(null);
  const [bookingForm, setBookingForm] = useState({
    customer_name: '',
    email: '',
    phone: '',
    dog_name: '',
    dog_notes: '',
    services: [],
  });
  const [bookingStatus, setBookingStatus] = useState(null);
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [contactStatus, setContactStatus] = useState(null);
  const [holdState, setHoldState] = useState({ loading: false, error: null });
  const [showTop, setShowTop] = useState(false);

  const derivedContent = useMemo(() => {
    const content = data?.sections ?? {};
    const settings = data?.settings ?? {};
    const happyClients = data?.happy_clients ?? [];
    const retailItems = data?.retail ?? [];
    const sectionVisibility = computeSectionVisibility(content, settings, happyClients, retailItems);
    const navSections = SECTION_LINKS.filter((section) => sectionVisibility[section.id]);

    return {
      content,
      settings,
      happyClients,
      retailItems,
      sectionVisibility,
      navSections,
    };
  }, [data]);

  useEffect(() => {
    const handler = () => setShowTop(window.scrollY > 400);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    const fetchAvailability = async () => {
      const response = await axios.get('/api/public/schedule', { params: { date: bookingDate } });
      setAvailability(response.data.data.availability);
    };
    fetchAvailability().catch(() => setAvailability([]));
  }, [bookingDate]);

  if (loading || !data) {
    return (
      <div className="section" style={{ textAlign: 'center' }}>
        <p>Loading Bow Wow’s Dog Spa...</p>
      </div>
    );
  }

  const { content, settings, happyClients, retailItems, sectionVisibility, navSections } = derivedContent;

  const beginHold = async (time) => {
    setHoldState({ loading: true, error: null });
    try {
      const response = await axios.post('/api/public/booking-hold', { date: bookingDate, time });
      setHoldToken(response.data.data.hold_token);
      setSelectedTime(time);
    } catch (err) {
      setHoldState({ loading: false, error: err.response?.data?.error?.message ?? 'Unable to reserve slot.' });
      return;
    }
    setHoldState({ loading: false, error: null });
  };

  const submitBooking = async (event) => {
    event.preventDefault();
    try {
      const payload = {
        ...bookingForm,
        date: bookingDate,
        time: selectedTime,
        hold_token: holdToken,
      };
      await axios.post('/api/public/booking-request', payload);
      setBookingStatus('Thanks! Our team will confirm shortly.');
      setBookingForm({ customer_name: '', email: '', phone: '', dog_name: '', dog_notes: '', services: [] });
      setSelectedTime(null);
      setHoldToken(null);
    } catch (err) {
      setBookingStatus(err.response?.data?.error?.message ?? 'Unable to submit request.');
    }
  };

  const submitContact = async (event) => {
    event.preventDefault();
    try {
      await axios.post('/api/public/contact', contactForm);
      setContactStatus('Message received! We’ll reply soon.');
      setContactForm({ name: '', email: '', phone: '', message: '' });
    } catch (err) {
      setContactStatus(err.response?.data?.error?.message ?? 'Unable to send message.');
    }
  };

  return (
    <>
      <Navbar sections={navSections} businessName={settings.business_name} />
      <main>
        {sectionVisibility.hero && (
          <HeroSection
            content={content.hero}
            settings={settings}
            hasBooking={sectionVisibility.booking}
            showServices={sectionVisibility.services}
          />
        )}
        {sectionVisibility.services && <ServicesSection content={content.services} />}
        {sectionVisibility.booking && (
          <BookingSection
            content={content.booking}
            bookingDate={bookingDate}
            setBookingDate={setBookingDate}
            availability={availability}
            selectedTime={selectedTime}
            beginHold={beginHold}
            holdState={holdState}
            bookingForm={bookingForm}
            setBookingForm={setBookingForm}
            submitBooking={submitBooking}
            bookingStatus={bookingStatus}
          />
        )}
        {sectionVisibility.gallery && <GallerySection items={happyClients} content={content.gallery} />}
        {sectionVisibility.retail && <RetailSection items={retailItems} content={content.retail} />}
        {sectionVisibility.about && <AboutSection content={content.about} />}
        {sectionVisibility.faq && <FaqSection items={content.faq?.items || []} />}
        {sectionVisibility.policies && <PoliciesSection items={content.policies?.items || []} />}
        {sectionVisibility.location && <LocationSection content={content.location} settings={settings} />}
        {sectionVisibility.contact && (
          <ContactSection
            settings={settings}
            content={content.contact}
            contactForm={contactForm}
            setContactForm={setContactForm}
            submitContact={submitContact}
            contactStatus={contactStatus}
          />
        )}
      </main>
      <Footer sections={navSections} settings={settings} />
      {showTop && (
        <button className="btn btn-primary" style={backToTopStyles} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          ↑ Top
        </button>
      )}
    </>
  );
}

const backToTopStyles = {
  position: 'fixed',
  bottom: '1.5rem',
  right: '1.5rem',
  zIndex: 50,
};

function SimplePage({ title, blockKey }) {
  const { data, loading } = useSiteContent();

  if (loading || !data) {
    return (
      <div className="section">
        <p>Loading...</p>
      </div>
    );
  }

  const block = data.sections[blockKey];
  const items = Array.isArray(block?.items) ? block.items : Array.isArray(block) ? block : [];

  return (
    <>
      <div className="section">
        <div className="container">
          <Link to="/">← Back to site</Link>
          <h1>{title}</h1>
          {items.map((entry, index) => (
            <article key={index} style={{ marginBottom: '1rem' }}>
              {entry.title && <h3>{entry.title}</h3>}
              <p>{entry.body || entry.text || ''}</p>
            </article>
          ))}
        </div>
      </div>
      <Footer sections={[]} settings={data.settings} />
    </>
  );
}

function Navbar({ sections, businessName }) {
  const [open, setOpen] = useState(false);
  return (
    <header style={navStyles}>
      <div className="container" style={navContainer}>
        <div className="nav-brand">
          <a href="#hero" className="brand-link">
            <BrandLogo />
            <span>{businessName}</span>
          </a>
        </div>
        <nav className="nav-links">
          <button onClick={() => setOpen(!open)} style={menuButton}>
            Menu
          </button>
          <div style={{ display: open ? 'block' : 'none' }} className="nav-drawer">
            {sections.map((section) => (
              <a key={section.id} href={`#${section.id}`} onClick={() => setOpen(false)} style={navLink}>
                {section.label}
              </a>
            ))}
            <Link to="/privacy" style={navLink}>
              Privacy
            </Link>
            <Link to="/terms" style={navLink}>
              Terms
            </Link>
          </div>
          <div className="nav-desktop" style={{ display: 'none' }}>
            {sections.map((section) => (
              <a key={section.id} href={`#${section.id}`} style={navLink}>
                {section.label}
              </a>
            ))}
          </div>
        </nav>
      </div>
    </header>
  );
}

const navStyles = {
  position: 'sticky',
  top: 0,
  zIndex: 20,
  background: 'var(--color-background-primary)',
  borderBottom: '1px solid var(--color-border-subtle)',
  padding: '0.75rem 0',
  overflow: 'visible',
};

const navContainer = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const menuButton = {
  border: '1px solid var(--color-accent-primary)',
  borderRadius: '999px',
  padding: '0.35rem 0.85rem',
  background: 'transparent',
  color: 'var(--color-accent-primary)',
};

const navLink = {
  marginRight: '1rem',
  display: 'inline-block',
  padding: '0.35rem 0',
};

function HeroSection({ content, settings, hasBooking, showServices }) {
  const primaryHref = hasBooking ? '#booking' : '#contact';
  return (
    <section id="hero" className="section" style={{ paddingTop: '6rem', textAlign: 'center' }}>
      <div className="container">
        <p style={{ textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--color-accent-primary)' }}>{settings.serving_area}</p>
        <h1 style={{ fontSize: '3rem', margin: '0.5rem 0', color: 'var(--color-text-primary)' }}>{content?.headline}</h1>
        <div style={{ fontSize: '1.1rem', color: 'var(--color-text-secondary)', maxWidth: '640px', margin: '0 auto 1.5rem' }} dangerouslySetInnerHTML={{ __html: content?.subheading || '' }} />
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <a className="btn btn-primary" href={primaryHref}>
            {content?.cta_text || (hasBooking ? 'Request Appointment' : 'Contact Us')}
          </a>
          {showServices && (
            <a className="btn btn-outline" href="#services">
              {content?.cta_secondary || 'Explore Services'}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function ServicesSection({ content = {} }) {
  const cards = Array.isArray(content.cards) && content.cards.length > 0 ? content.cards : null;
  const fallback = [
    { title: 'Grooming', body: content?.grooming },
    { title: 'Spa Baths', body: content?.baths },
    { title: 'Play Styles', body: content?.play },
  ].filter((service) => textHasContent(service.body));

  const services = cards || fallback;

  if (!services || services.length === 0) {
    return null;
  }

  return (
    <section id="services" className="section">
      <div className="container">
        <h2>Services</h2>
        {textHasContent(content?.intro) && <div className="muted" dangerouslySetInnerHTML={{ __html: content?.intro }} />}
        <div className="card-grid">
          {services.map((service, index) => (
            <article key={service.title ?? index} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>{service.title}</h3>
                {service.price && <span style={{ fontWeight: 600 }}>{service.price}</span>}
              </div>
              {service.description ? (
                <div dangerouslySetInnerHTML={{ __html: service.description }} />
              ) : (
                <p>{service.body}</p>
              )}
              {Array.isArray(service.bullets) && service.bullets.length > 0 && (
                <ul>
                  {service.bullets.map((bullet, bulletIdx) => (
                    <li key={bulletIdx}>{bullet}</li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const cardStyle = {
  background: 'var(--color-surface-card)',
  borderRadius: '18px',
  padding: '1.5rem',
  boxShadow: '0 12px 30px rgba(47, 58, 58, 0.08)',
  border: '1px solid var(--color-border-subtle)',
};

function BookingSection({
  content,
  bookingDate,
  setBookingDate,
  availability,
  selectedTime,
  beginHold,
  holdState,
  bookingForm,
  setBookingForm,
  submitBooking,
  bookingStatus,
}) {
  return (
    <section id="booking" className="section" style={{ background: 'var(--color-accent-primary-soft)' }}>
      <div className="container">
        <h2>Request Appointment</h2>
        <div className="muted" dangerouslySetInnerHTML={{ __html: content?.intro || 'Choose a date & time. Booking requests are pending until our team confirms by email.' }} />
        <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <div>
            <label className="field">
              Date
              <input type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} />
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem' }}>
              {availability.map((slot) => (
                <button
                  key={slot.time}
                  className="btn btn-outline"
                  type="button"
                  disabled={holdState.loading && selectedTime === slot.time}
                  onClick={() => beginHold(slot.time)}
                  style={{
                    borderColor: selectedTime === slot.time ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)',
                    background: selectedTime === slot.time ? 'var(--color-accent-primary)' : 'transparent',
                    color: selectedTime === slot.time ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
                  }}
                >
                  {slot.label}
                </button>
              ))}
            </div>
            {holdState.error && <p style={{ color: 'var(--color-error)' }}>{holdState.error}</p>}
          </div>
          <form onSubmit={submitBooking} style={formCard}>
            <input
              required
              placeholder="Your name"
              value={bookingForm.customer_name}
              onChange={(e) => setBookingForm((prev) => ({ ...prev, customer_name: e.target.value }))}
            />
            <input required placeholder="Email" type="email" value={bookingForm.email} onChange={(e) => setBookingForm((prev) => ({ ...prev, email: e.target.value }))} />
            <input required placeholder="Phone" value={bookingForm.phone} onChange={(e) => setBookingForm((prev) => ({ ...prev, phone: e.target.value }))} />
            <input placeholder="Dog name" value={bookingForm.dog_name} onChange={(e) => setBookingForm((prev) => ({ ...prev, dog_name: e.target.value }))} />
            <textarea placeholder="Notes or preferences" value={bookingForm.dog_notes} onChange={(e) => setBookingForm((prev) => ({ ...prev, dog_notes: e.target.value }))} />
            <button className="btn btn-primary" disabled={!selectedTime}>
              Submit request
            </button>
            {bookingStatus && <p style={{ marginTop: '0.5rem' }}>{bookingStatus}</p>}
          </form>
        </div>
      </div>
    </section>
  );
}

const formCard = {
  background: 'var(--color-surface-card)',
  borderRadius: '16px',
  padding: '1.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  border: '1px solid var(--color-border-subtle)',
};

function GallerySection({ items = [], content = {} }) {
  if (!items.length) {
    return null;
  }

  return (
    <section id="gallery" className="section">
      <div className="container">
        <h2>{content?.title || 'Happy Clients'}</h2>
        <div className="card-grid">
          {items.map((item) => {
            const featured = item.before_media || item.after_media;
            return (
              <article key={item.id} style={cardStyle}>
                <ResponsivePicture media={featured} alt={item.title} className="media-thumb" />
                <h3>{item.title}</h3>
                <p>{item.blurb}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function RetailSection({ items = [], content = {} }) {
  if (!items.length) {
    return null;
  }

  return (
    <section id="retail" className="section" style={{ background: 'var(--color-background-secondary)' }}>
      <div className="container">
        <h2>{content?.title || 'Retail Boutique'}</h2>
        {textHasContent(content?.body) && <div className="muted" dangerouslySetInnerHTML={{ __html: content.body }} />}
        <div className="card-grid">
          {items.map((item) => (
            <article key={item.id} style={cardStyle}>
              <ResponsivePicture media={item.media} alt={item.name} className="media-thumb" />
              <h3>{item.name}</h3>
              <div dangerouslySetInnerHTML={{ __html: item.description || '' }} />
              {item.price_cents && <strong>${(item.price_cents / 100).toFixed(2)}</strong>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AboutSection({ content }) {
  return (
    <section id="about" className="section">
      <div className="container">
        <h2>{content?.title || 'About'}</h2>
        <div dangerouslySetInnerHTML={{ __html: content?.body || '' }} />
      </div>
    </section>
  );
}

function FaqSection({ items = [] }) {
  if (!items.length) {
    return null;
  }
  return (
    <section id="faq" className="section">
      <div className="container">
        <h2>FAQ</h2>
        {items.map((faq, index) => (
          <details key={index} style={{ marginBottom: '1rem', background: 'var(--color-surface-card)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--color-border-subtle)' }}>
            <summary style={{ fontWeight: 600 }}>{faq.question}</summary>
            <div dangerouslySetInnerHTML={{ __html: faq.answer || '' }} />
          </details>
        ))}
      </div>
    </section>
  );
}

function PoliciesSection({ items = [] }) {
  if (!items.length) {
    return null;
  }
  return (
    <section id="policies" className="section" style={{ background: 'var(--color-accent-secondary-soft)' }}>
      <div className="container">
        <h2>Policies</h2>
        <div className="card-grid">
          {items.map((policy, index) => (
            <article key={index} style={cardStyle}>
              <h3>{policy.title}</h3>
              <div dangerouslySetInnerHTML={{ __html: policy.body || '' }} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function LocationSection({ content = {}, settings }) {
  return (
    <section id="location" className="section">
      <div className="container">
        <h2>Location &amp; Hours</h2>
        <p>{settings.address}</p>
        <p>{settings.hours}</p>
        <div className="muted" dangerouslySetInnerHTML={{ __html: content?.note || settings.serving_area }} />
      </div>
    </section>
  );
}

function ContactSection({ settings, contactForm, setContactForm, submitContact, contactStatus, content = {} }) {
  return (
    <section id="contact" className="section">
      <div className="container">
        <h2>Contact</h2>
        <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <div>
            <p>Call us: {settings.phone}</p>
            <p>Email: {settings.email}</p>
            <p>Visit: {settings.address}</p>
            {textHasContent(content?.note) && <div className="muted" dangerouslySetInnerHTML={{ __html: content.note }} />}
          </div>
          <form onSubmit={submitContact} style={formCard}>
            <input required placeholder="Name" value={contactForm.name} onChange={(e) => setContactForm((prev) => ({ ...prev, name: e.target.value }))} />
            <input required placeholder="Email" type="email" value={contactForm.email} onChange={(e) => setContactForm((prev) => ({ ...prev, email: e.target.value }))} />
            <input placeholder="Phone" value={contactForm.phone} onChange={(e) => setContactForm((prev) => ({ ...prev, phone: e.target.value }))} />
            <textarea required placeholder="Message" value={contactForm.message} onChange={(e) => setContactForm((prev) => ({ ...prev, message: e.target.value }))} />
            <button className="btn btn-outline">Send</button>
            {contactStatus && <p>{contactStatus}</p>}
          </form>
        </div>
      </div>
    </section>
  );
}

function Footer({ sections, settings }) {
  return (
    <footer style={{ background: 'var(--color-text-primary)', color: 'var(--color-text-inverse)', padding: '3rem 1.5rem' }}>
      <div className="container" style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div>
          <div className="footer-brand">
            <BrandLogo className="brand-logo--small" />
            <h3>Bow Wow’s Dog Spa</h3>
          </div>
          <p>{settings.address}</p>
          <p>{settings.hours}</p>
          <p>{settings.phone}</p>
        </div>
        <div>
          <h4>Quick links</h4>
          {sections.map((section) => (
            <div key={section.id}>
              <a href={`#${section.id}`} style={{ color: 'var(--color-text-inverse)' }}>
                {section.label}
              </a>
            </div>
          ))}
        </div>
        <div>
          <h4>Resources</h4>
          <Link to="/privacy" style={{ color: 'var(--color-text-inverse)', display: 'block' }}>
            Privacy Policy
          </Link>
          <Link to="/terms" style={{ color: 'var(--color-text-inverse)', display: 'block' }}>
            Terms &amp; Conditions
          </Link>
          <a href="/admin/login" style={{ color: 'var(--color-text-inverse)', display: 'block', marginTop: '0.5rem' }}>
            Admin Login
          </a>
        </div>
      </div>
    </footer>
  );
}

function BrandLogo({ className = '' }) {
  return (
    <picture className={`brand-logo ${className}`.trim()}>
      <source srcSet={logoPrimaryWebp} type="image/webp" />
      <img src={logoPrimaryPng} alt="Bow Wow's Dog Spa logo" loading="lazy" />
    </picture>
  );
}

export default App;

function ResponsivePicture({ media, alt, className }) {
  if (!media || (!media.optimized_srcset && !media.webp_srcset)) {
    return null;
  }

  return (
    <picture className={className}>
      {media.webp_srcset && <source type="image/webp" srcSet={media.webp_srcset} />}
      {media.optimized_srcset && <source srcSet={media.optimized_srcset} />}
      <img src={media.fallback_url || media.original_url} alt={alt || media.alt_text || ''} loading="lazy" style={{ width: '100%', borderRadius: '12px' }} />
    </picture>
  );
}

function textHasContent(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function listHasRichContent(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return false;
  }

  return items.some((item) => {
    if (!item || typeof item !== 'object') {
      return false;
    }
    return Object.values(item).some((value) => textHasContent(value));
  });
}

function isEnabled(section) {
  if (!section || typeof section !== 'object') {
    return true;
  }
  return section.enabled !== false;
}

function computeSectionVisibility(content = {}, settings = {}, happyClients = [], retailItems = []) {
  const hero = isEnabled(content.hero) && (textHasContent(content.hero?.headline) || textHasContent(content.hero?.subheading));
  const services =
    isEnabled(content.services) &&
    ['grooming', 'baths', 'play'].some((key) => textHasContent(content.services?.[key]));
  const booking = isEnabled(content.booking);
  const gallery = isEnabled(content.gallery) && happyClients.length > 0;
  const retail = isEnabled(content.retail) && retailItems.length > 0;
  const about = isEnabled(content.about) && (textHasContent(content.about?.title) || textHasContent(content.about?.body));
  const faqItems = content.faq?.items ?? [];
  const faq = isEnabled(content.faq) && listHasRichContent(faqItems);
  const policyItems = content.policies?.items ?? [];
  const policies = isEnabled(content.policies) && listHasRichContent(policyItems);
  const location =
    isEnabled(content.location) &&
    (textHasContent(content.location?.note) || textHasContent(settings.address) || textHasContent(settings.hours));
  const contact =
    isEnabled(content.contact) &&
    (textHasContent(settings.phone) || textHasContent(settings.email) || textHasContent(settings.address));

  return { hero, services, booking, gallery, retail, about, faq, policies, location, contact };
}
