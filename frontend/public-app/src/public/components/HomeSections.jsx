import { useState } from 'react';
import { ResponsivePicture } from '../Branding';
import { escapeHtml, formatDuration, toPhoneHref } from '../bookingUtils';
import { publicApi } from '../publicApi';
import { textHasContent } from '../siteConfig';

export function HeroSection({ settings, content, primaryCta, secondaryCta }) {
  const phoneHref = settings.phone ? toPhoneHref(settings.phone) : null;
  const servingAreaLabel = escapeHtml(settings.serving_area || 'Greater Winston-Salem and the Triad area');
  const heroSubheading =
    content.subheading ||
    `<p>Gentle grooming, spa baths, and comfort-focused care for dogs in ${servingAreaLabel}.</p><p>Request an appointment online and hear back within 24 hours.</p>`;
  const heroMedia = content.media || null;
  const valuePoints = [
    settings.serving_area,
    'Appointment-based care',
    'Comfort-focused grooming',
  ].filter(Boolean);

  return (
    <section id="hero" className={`hero-section ${heroMedia ? 'hero-section--with-media' : 'hero-section--without-media'}`}>
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

        <div className={`hero-visual ${heroMedia ? 'hero-visual--has-media' : 'hero-visual--placeholder'}`}>
          {heroMedia ? (
            <div className="hero-visual__media">
              <ResponsivePicture
                media={heroMedia}
                alt={heroMedia.alt_text || heroMedia.title || "Freshly groomed Bow Wow's Dog Spa client"}
                loading="eager"
                fetchPriority="high"
              />
            </div>
          ) : (
            <div className="hero-visual__placeholder" aria-hidden="true">
              <p>Comfort-first care</p>
              <strong>Colorful boutique results with a calm, neighborhood feel.</strong>
            </div>
          )}

          <div className="hero-card">
            <div className="hero-card__label">Why families book here</div>
            <ul className="feature-list">
              <li>Service-based time windows that fit the real visit length</li>
              <li>Real staff review before confirmation, not a black-box scheduler</li>
              <li>Thoughtful handling for seniors, first-timers, and sensitive dogs</li>
            </ul>
            <div className="hero-contact-card">
              <span>Need help first?</span>
              {settings.phone && <a href={phoneHref}>Call {settings.phone}</a>}
              {settings.hours && <p>{settings.hours}</p>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


export function TrustStrip({ settings, content }) {
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


export function ServicesSection({ content, services, settings, primaryCta }) {
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


export function GallerySection({ content, items }) {
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


export function RetailSection({ content, categories, settings }) {
  const phoneHref = settings.phone ? toPhoneHref(settings.phone) : null;
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
                          <span>Photo coming soon</span>
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

        {phoneHref && (
          <div className="section-cta section-cta--soft">
            <div>
              <strong>Need help choosing the right product?</strong>
              <p>Ask the team about availability, coat type recommendations, or what to pick up during your next visit.</p>
            </div>
            <div className="section-cta__actions">
              <a className="btn btn-outline" href={phoneHref}>
                Call {settings.phone}
              </a>
              <a className="btn btn-primary" href="#contact">
                Use the contact form
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}


export function ReviewsSection({ settings, content, items, primaryCta }) {
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


export function AboutSection({ content, settings }) {
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


export function ContactSection({ content, location, settings }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '', bowwow_hp: '' });
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const phoneHref = settings.phone ? toPhoneHref(settings.phone) : null;

  const focusContactForm = () => {
    const input = document.getElementById('contact-name');
    input?.focus();
  };

  const submitContact = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);

    try {
      await publicApi.post('/api/public/contact', form);
      setStatus({ tone: 'success', message: 'Message received. We’ll reply soon.' });
      setForm({ name: '', email: '', phone: '', message: '', bowwow_hp: '' });
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
              <button className="contact-card" type="button" onClick={focusContactForm}>
                <span>Message</span>
                <strong>Use the contact form</strong>
              </button>
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
            <div className="form-spam-trap" aria-hidden="true">
              <label htmlFor="contact-check">Leave this field blank</label>
              <input
                id="contact-check"
                name="bowwow_hp"
                tabIndex={-1}
                autoComplete="new-password"
                value={form.bowwow_hp}
                onChange={(event) => setForm((current) => ({ ...current, bowwow_hp: event.target.value }))}
              />
            </div>
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


export function FaqSection({ content, items }) {
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


export function PoliciesSection({ content, items }) {
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
