import { useEffect, useMemo, useState } from 'react';
import { LocalDraftStatus, PublicPreviewLink, RichPreview, useLocalDraft } from '@jamarq/cpanel-admin-kit/convenience';
import { useAdminConfirm } from '../ConfirmProvider';
import { api, useAdminDirtyState } from '../AdminShell';
import { EditorSection, ListEditor, RichTextEditor, SectionEnabledToggle } from '../ContentEditorControls';
import { MediaPicker } from '../MediaPicker';

const HOMEPAGE_ORDER = ['trust', 'services', 'booking', 'gallery', 'retail', 'reviews', 'about', 'contact', 'faq', 'policies'];
const HOMEPAGE_SECTION_LABELS = {
  trust: 'Trust signals',
  services: 'Services',
  booking: 'Booking request',
  gallery: 'Gallery / Happy Customers',
  retail: 'Retail products',
  reviews: 'Reviews',
  about: 'About',
  contact: 'Contact and location',
  faq: 'FAQ',
  policies: 'Policies',
};

export function ContentPage() {
  const { setDirtyState, clearDirty } = useAdminDirtyState();
  const confirm = useAdminConfirm();
  const [settings, setSettings] = useState(null);
  const [sections, setSections] = useState(null);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const currentSnapshot = useMemo(() => {
    if (!settings || !sections) {
      return '';
    }

    return JSON.stringify({ settings, sections });
  }, [sections, settings]);

  const isDirty = Boolean(savedSnapshot && currentSnapshot && currentSnapshot !== savedSnapshot);
  const browserDraft = useLocalDraft({
    key: 'bowwow-site-content-draft',
    value: { settings, sections },
    enabled: Boolean(isDirty && settings && sections),
  });

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      try {
        const response = await api.get('/content/site');
        if (ignore) {
          return;
        }

        const nextSettings = response.data.data.settings || {};
        const nextSections = response.data.data.sections || {};
        const snapshot = JSON.stringify({ settings: nextSettings, sections: nextSections });

        setSettings(nextSettings);
        setSections(nextSections);
        setSavedSnapshot(snapshot);
        setStatus(null);
      } catch (err) {
        if (!ignore) {
          setStatus({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to load site content.' });
        }
      }
    };

    load();

    return () => {
      ignore = true;
      clearDirty();
    };
  }, [clearDirty]);

  useEffect(() => {
    setDirtyState({
      isDirty,
      message: 'You have unsaved text and site info changes. Leave without saving?',
    });
  }, [isDirty, setDirtyState]);

  useEffect(() => {
    if (isDirty && status?.tone === 'success') {
      setStatus(null);
    }
  }, [isDirty, status]);

  const updateSection = (key, updates) => {
    setStatus(null);
    setSections((prev) => ({
      ...prev,
      [key]: { ...(prev?.[key] || {}), ...updates },
    }));
  };

  const updateList = (key, items) => {
    updateSection(key, { items });
  };

  const homepageOrder = useMemo(() => {
    const saved = Array.isArray(sections?.homepage_order?.items) ? sections.homepage_order.items : [];
    return [
      ...saved.filter((item) => HOMEPAGE_ORDER.includes(item)),
      ...HOMEPAGE_ORDER.filter((item) => !saved.includes(item)),
    ];
  }, [sections]);

  const moveHomepageSection = (sectionId, direction) => {
    const currentIndex = homepageOrder.indexOf(sectionId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= homepageOrder.length) {
      return;
    }

    const nextOrder = [...homepageOrder];
    const [item] = nextOrder.splice(currentIndex, 1);
    nextOrder.splice(nextIndex, 0, item);
    updateSection('homepage_order', { items: nextOrder, enabled: true });
    setStatus({ tone: 'success', message: 'Homepage section order updated. Save content to publish this order.' });
  };

  const restoreLastSaved = async () => {
    if (!savedSnapshot) {
      return;
    }

    if (!(await confirm({
      message: 'Discard unsaved changes and restore the last saved version?',
      confirmLabel: 'Discard changes',
      tone: 'danger',
    }))) {
      return;
    }

    const parsed = JSON.parse(savedSnapshot);
    setSettings(parsed.settings || {});
    setSections(parsed.sections || {});
    clearDirty();
    setStatus({ tone: 'success', message: 'Unsaved changes discarded.' });
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatus(null);

    try {
      await api.post('/content/site', { settings, sections });
      setSavedSnapshot(currentSnapshot);
      browserDraft.clearDraft();
      clearDirty();
      setStatus({ tone: 'success', message: 'Site content saved.' });
    } catch (err) {
      setStatus({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to save content.' });
    } finally {
      setSaving(false);
    }
  };

  if (!settings || !sections) {
    return <div className="card">{status?.message || 'Loading site content…'}</div>;
  }

  const restoreBrowserDraft = async () => {
    const draft = browserDraft.readDraft();
    if (!draft?.value?.settings || !draft?.value?.sections) {
      setStatus({ tone: 'error', message: 'No browser draft was found.' });
      return;
    }

    if (isDirty && !(await confirm({
      message: 'Restore the browser draft and replace the current unsaved changes on this page?',
      confirmLabel: 'Restore draft',
      tone: 'warning',
    }))) {
      return;
    }

    setSettings(draft.value.settings);
    setSections(draft.value.sections);
    setStatus({ tone: 'success', message: 'Browser draft restored. Review it, then save to update the public site.' });
  };

  const discardBrowserDraft = () => {
    browserDraft.clearDraft();
    setStatus({ tone: 'success', message: 'Browser draft discarded.' });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Text & Site Info</h1>
          <p className="muted">Manage public-site copy, contact details, and section messaging without changing the site structure.</p>
        </div>
        <div className="page-toolbar">
          <PublicPreviewLink href="/" label="View public site" />
          <button type="button" className="btn btn-tertiary" onClick={() => setPreviewOpen((value) => !value)}>
            {previewOpen ? 'Hide preview' : 'Preview current copy'}
          </button>
        </div>
      </div>

      <form className="stack gap-md" onSubmit={save}>
        <div className="editor-savebar card">
          <div>
            <strong>{isDirty ? 'Unsaved changes' : 'All changes saved'}</strong>
            <p className="muted small-text">This page controls live public-site text and settings.</p>
            <LocalDraftStatus
              hasDraft={browserDraft.hasDraft}
              isDirty={isDirty}
              onRestore={restoreBrowserDraft}
              onDiscard={discardBrowserDraft}
            />
          </div>
          <div className="editor-savebar__actions">
            {status && <p className={`save-feedback ${status.tone === 'error' ? 'is-error' : 'is-success'}`}>{status.message}</p>}
            {isDirty && (
              <button type="button" className="btn btn-tertiary" onClick={restoreLastSaved}>
                Discard unsaved changes
              </button>
            )}
            <button className="btn" disabled={saving}>
              {saving ? 'Saving…' : 'Save Content'}
            </button>
          </div>
        </div>

        {previewOpen && (
          <div className="card admin-preview-panel">
            <div className="booking-card__header">
              <h3>Current Copy Preview</h3>
              <span className="small-text muted">{isDirty ? 'Unsaved draft' : 'Saved copy'}</span>
            </div>
            <div className="preview-grid">
              <div className="preview-card">
                <p className="small-text muted">Hero</p>
                <h2>{sections.hero?.headline || 'Hero headline'}</h2>
                <RichPreview html={sections.hero?.subheading || ''} />
              </div>
              <div className="preview-card">
                <p className="small-text muted">Services</p>
                <h2>{sections.services?.title || 'Services title'}</h2>
                <RichPreview html={sections.services?.intro || ''} />
              </div>
              <div className="preview-card">
                <p className="small-text muted">Gallery</p>
                <h2>{sections.gallery?.title || 'Gallery title'}</h2>
                <RichPreview html={sections.gallery?.intro || ''} />
              </div>
              <div className="preview-card">
                <p className="small-text muted">Contact</p>
                <h2>{sections.contact?.title || 'Contact title'}</h2>
                <RichPreview html={sections.contact?.note || ''} />
              </div>
            </div>
          </div>
        )}

        <EditorSection title="Business Details" description="Phone, hours, address, map links, and public trust profile settings." initiallyOpen>
          <div className="grid two-col gap-sm">
            <label className="field-block">
              <span className="field-label">Business name</span>
              <input value={settings.business_name} onChange={(e) => setSettings((prev) => ({ ...prev, business_name: e.target.value }))} />
            </label>
            <label className="field-block">
              <span className="field-label">Serving area tagline</span>
              <input value={settings.serving_area} onChange={(e) => setSettings((prev) => ({ ...prev, serving_area: e.target.value }))} />
            </label>
            <label className="field-block">
              <span className="field-label">Phone</span>
              <input value={settings.phone} onChange={(e) => setSettings((prev) => ({ ...prev, phone: e.target.value }))} />
            </label>
            <label className="field-block">
              <span className="field-label">Email</span>
              <input value={settings.email} onChange={(e) => setSettings((prev) => ({ ...prev, email: e.target.value }))} />
            </label>
            <label className="field-block">
              <span className="field-label">Address</span>
              <input value={settings.address} onChange={(e) => setSettings((prev) => ({ ...prev, address: e.target.value }))} />
            </label>
            <label className="field-block">
              <span className="field-label">Business hours</span>
              <input value={settings.hours} onChange={(e) => setSettings((prev) => ({ ...prev, hours: e.target.value }))} />
            </label>
            <label className="field-block">
              <span className="field-label">Maps URL</span>
              <input value={settings.maps_url || ''} onChange={(e) => setSettings((prev) => ({ ...prev, maps_url: e.target.value }))} />
            </label>
            <label className="field-block">
              <span className="field-label">Google reviews URL</span>
              <input value={settings.google_reviews_url || ''} onChange={(e) => setSettings((prev) => ({ ...prev, google_reviews_url: e.target.value }))} />
            </label>
            <label className="field-block">
              <span className="field-label">Google rating</span>
              <input value={settings.google_review_rating || ''} onChange={(e) => setSettings((prev) => ({ ...prev, google_review_rating: e.target.value }))} />
            </label>
            <label className="field-block">
              <span className="field-label">Google review count</span>
              <input value={settings.google_review_count || ''} onChange={(e) => setSettings((prev) => ({ ...prev, google_review_count: e.target.value }))} />
            </label>
            <label className="field-block">
              <span className="field-label">Facebook handle</span>
              <input value={settings.social_facebook || ''} onChange={(e) => setSettings((prev) => ({ ...prev, social_facebook: e.target.value }))} />
            </label>
            <label className="field-block">
              <span className="field-label">Instagram handle</span>
              <input value={settings.social_instagram || ''} onChange={(e) => setSettings((prev) => ({ ...prev, social_instagram: e.target.value }))} />
            </label>
          </div>
        </EditorSection>

        <EditorSection title="Homepage Section Order" description="Hero always stays first and the footer always stays last. Reorder the middle homepage sections here.">
          <div className="homepage-order-list">
            {homepageOrder.map((sectionId, index) => (
              <div key={sectionId} className="homepage-order-row">
                <div>
                  <strong>{HOMEPAGE_SECTION_LABELS[sectionId] || sectionId}</strong>
                  <p className="muted small-text">
                    Position {index + 1} after the hero
                    {sections[sectionId]?.enabled === false ? ' · hidden from website' : ''}
                  </p>
                </div>
                <div className="inline-actions">
                  <PublicPreviewLink href={`/#${sectionId}`} label="Preview" />
                  <button type="button" className="btn btn-tertiary" onClick={() => moveHomepageSection(sectionId, -1)} disabled={index === 0}>
                    Move up
                  </button>
                  <button type="button" className="btn btn-tertiary" onClick={() => moveHomepageSection(sectionId, 1)} disabled={index === homepageOrder.length - 1}>
                    Move down
                  </button>
                </div>
              </div>
            ))}
          </div>
        </EditorSection>

        <EditorSection title="Hero" description="First-screen headline, supporting copy, CTA labels, and the main hero image." initiallyOpen>
          <SectionEnabledToggle
            label="Show hero section"
            value={sections.hero?.enabled !== false}
            onChange={(enabled) => updateSection('hero', { enabled })}
          />
          <label className="field-block">
            <span className="field-label">Hero eyebrow</span>
            <input value={sections.hero?.eyebrow || ''} onChange={(e) => updateSection('hero', { eyebrow: e.target.value })} />
          </label>
          <label className="field-block">
            <span className="field-label">Hero headline</span>
            <input value={sections.hero?.headline || ''} onChange={(e) => updateSection('hero', { headline: e.target.value })} />
          </label>
          <div className="field-block">
            <span className="field-label">Hero subheading</span>
            <RichTextEditor value={sections.hero?.subheading || ''} onChange={(value) => updateSection('hero', { subheading: value })} />
          </div>
          <div className="field-block">
            <p className="muted small-text">Pick one strong photo from the shared media library. This keeps hero and gallery images in the same system instead of creating separate upload paths.</p>
            <MediaPicker
              label="Hero image"
              media={sections.hero?.media || null}
              onChange={(media) => updateSection('hero', { media_id: media?.id ?? null, media: media || null })}
              uploadCategory="hero"
            />
          </div>
          <div className="grid two-col gap-sm">
            <label className="field-block">
              <span className="field-label">Primary CTA label</span>
              <input value={sections.hero?.cta_text || ''} onChange={(e) => updateSection('hero', { cta_text: e.target.value })} />
            </label>
            <label className="field-block">
              <span className="field-label">Secondary CTA label</span>
              <input value={sections.hero?.cta_secondary || ''} onChange={(e) => updateSection('hero', { cta_secondary: e.target.value })} />
            </label>
          </div>
        </EditorSection>

        <EditorSection title="Trust & Booking Messaging" description="Trust strip copy, booking intro text, and request-state messaging." initiallyOpen>
          <SectionEnabledToggle
            label="Show trust strip"
            value={sections.trust?.enabled !== false}
            onChange={(enabled) => updateSection('trust', { enabled })}
          />
          <label className="field-block">
            <span className="field-label">Trust section title</span>
            <input value={sections.trust?.title || ''} onChange={(e) => updateSection('trust', { title: e.target.value })} />
          </label>
          <div className="field-block">
            <span className="field-label">Trust intro</span>
            <RichTextEditor value={sections.trust?.intro || ''} onChange={(value) => updateSection('trust', { intro: value })} />
          </div>
          <ListEditor
            items={sections.trust?.points || []}
            onChange={(points) => updateSection('trust', { points })}
            fields={[
              { name: 'title', label: 'Point title' },
              { name: 'text', label: 'Point text' },
            ]}
          />
          <SectionEnabledToggle
            label="Show booking section"
            value={sections.booking?.enabled !== false}
            onChange={(enabled) => updateSection('booking', { enabled })}
          />
          <div className="field-block">
            <span className="field-label">Booking section title</span>
            <input value={sections.booking?.title || ''} onChange={(e) => updateSection('booking', { title: e.target.value })} />
          </div>
          <div className="field-block">
            <span className="field-label">Booking intro text</span>
            <RichTextEditor value={sections.booking?.intro || ''} onChange={(value) => updateSection('booking', { intro: value })} />
          </div>
          <div className="field-block">
            <span className="field-label">Booking notice</span>
            <RichTextEditor value={sections.booking?.notice || ''} onChange={(value) => updateSection('booking', { notice: value })} />
          </div>
          <div className="field-block">
            <span className="field-label">Availability helper</span>
            <RichTextEditor value={sections.booking?.availability_note || ''} onChange={(value) => updateSection('booking', { availability_note: value })} />
          </div>
        </EditorSection>

        <EditorSection title="Services" description="Service section intro and pricing/disclaimer copy.">
          <SectionEnabledToggle
            label="Show services section"
            value={sections.services?.enabled !== false}
            onChange={(enabled) => updateSection('services', { enabled })}
          />
          <div className="field-block">
            <span className="field-label">Section title</span>
            <input value={sections.services?.title || ''} onChange={(e) => updateSection('services', { title: e.target.value })} />
          </div>
          <div className="field-block">
            <span className="field-label">Intro copy</span>
            <RichTextEditor value={sections.services?.intro || ''} onChange={(value) => updateSection('services', { intro: value })} />
          </div>
          <div className="field-block">
            <span className="field-label">Pricing disclaimer</span>
            <RichTextEditor value={sections.services?.disclaimer || ''} onChange={(value) => updateSection('services', { disclaimer: value })} />
          </div>
        </EditorSection>

        <EditorSection title="Gallery & Reviews" description="Section headings and support copy for photo and trust modules.">
          <SectionEnabledToggle
            label="Show gallery section"
            value={sections.gallery?.enabled !== false}
            onChange={(enabled) => updateSection('gallery', { enabled })}
          />
          <label className="field-block">
            <span className="field-label">Gallery title</span>
            <input value={sections.gallery?.title || ''} onChange={(e) => updateSection('gallery', { title: e.target.value })} />
          </label>
          <div className="field-block">
            <span className="field-label">Gallery intro</span>
            <RichTextEditor value={sections.gallery?.intro || ''} onChange={(value) => updateSection('gallery', { intro: value })} />
          </div>
          <SectionEnabledToggle
            label="Show reviews section"
            value={sections.reviews?.enabled !== false}
            onChange={(enabled) => updateSection('reviews', { enabled })}
          />
          <label className="field-block">
            <span className="field-label">Reviews section title</span>
            <input value={sections.reviews?.title || ''} onChange={(e) => updateSection('reviews', { title: e.target.value })} />
          </label>
          <div className="field-block">
            <span className="field-label">Reviews intro</span>
            <RichTextEditor value={sections.reviews?.intro || ''} onChange={(value) => updateSection('reviews', { intro: value })} />
          </div>
          <label className="field-block">
            <span className="field-label">Reviews CTA label</span>
            <input value={sections.reviews?.cta_text || ''} onChange={(e) => updateSection('reviews', { cta_text: e.target.value })} />
          </label>
        </EditorSection>

        <EditorSection title="About" description="Care philosophy and reassuring neighborhood-boutique messaging.">
          <SectionEnabledToggle
            label="Show about section"
            value={sections.about?.enabled !== false}
            onChange={(enabled) => updateSection('about', { enabled })}
          />
          <label className="field-block">
            <span className="field-label">Section title</span>
            <input value={sections.about?.title || ''} onChange={(e) => updateSection('about', { title: e.target.value })} />
          </label>
          <div className="field-block">
            <span className="field-label">Body copy</span>
            <RichTextEditor value={sections.about?.body || ''} onChange={(value) => updateSection('about', { body: value })} />
          </div>
        </EditorSection>

        <EditorSection title="FAQ" description="Scannable answers shown on the public FAQ section.">
          <SectionEnabledToggle
            label="Show FAQ section"
            value={sections.faq?.enabled !== false}
            onChange={(enabled) => updateSection('faq', { enabled })}
          />
          <label className="field-block">
            <span className="field-label">Section title</span>
            <input value={sections.faq?.title || ''} onChange={(e) => updateSection('faq', { title: e.target.value })} />
          </label>
          <ListEditor
            items={sections.faq?.items || []}
            onChange={(items) => updateList('faq', items)}
            fields={[
              { name: 'question', label: 'Question' },
              { name: 'answer', label: 'Answer', rich: true },
            ]}
          />
        </EditorSection>

        <EditorSection title="Policies" description="Service policies, expectations, and care notes.">
          <SectionEnabledToggle
            label="Show policies section"
            value={sections.policies?.enabled !== false}
            onChange={(enabled) => updateSection('policies', { enabled })}
          />
          <label className="field-block">
            <span className="field-label">Section title</span>
            <input value={sections.policies?.title || ''} onChange={(e) => updateSection('policies', { title: e.target.value })} />
          </label>
          <ListEditor
            items={sections.policies?.items || []}
            onChange={(items) => updateList('policies', items)}
            fields={[
              { name: 'title', label: 'Policy Title' },
              { name: 'body', label: 'Policy Body', rich: true },
            ]}
          />
        </EditorSection>

        <EditorSection title="Location & Contact" description="Contact section labels, helpful notes, and local guidance.">
          <SectionEnabledToggle
            label="Show location note"
            value={sections.location?.enabled !== false}
            onChange={(enabled) => updateSection('location', { enabled })}
          />
          <label className="field-block">
            <span className="field-label">Location title</span>
            <input value={sections.location?.title || ''} onChange={(e) => updateSection('location', { title: e.target.value })} />
          </label>
          <div className="field-block">
            <span className="field-label">Location description</span>
            <RichTextEditor value={sections.location?.note || ''} onChange={(value) => updateSection('location', { note: value })} />
          </div>
          <SectionEnabledToggle
            label="Show contact section"
            value={sections.contact?.enabled !== false}
            onChange={(enabled) => updateSection('contact', { enabled })}
          />
          <label className="field-block">
            <span className="field-label">Contact title</span>
            <input value={sections.contact?.title || ''} onChange={(e) => updateSection('contact', { title: e.target.value })} />
          </label>
          <div className="field-block">
            <span className="field-label">Contact helper text</span>
            <RichTextEditor value={sections.contact?.note || ''} onChange={(value) => updateSection('contact', { note: value })} />
          </div>
        </EditorSection>

        <EditorSection title="Products Section" description="Public heading and intro copy shown above the live product categories.">
          <SectionEnabledToggle
            label="Show products section"
            value={sections.retail?.enabled !== false}
            onChange={(enabled) => updateSection('retail', { enabled })}
          />
          <label className="field-block">
            <span className="field-label">Section title</span>
            <input value={sections.retail?.title || ''} onChange={(e) => updateSection('retail', { title: e.target.value })} />
          </label>
          <div className="field-block">
            <span className="field-label">Section intro</span>
            <RichTextEditor value={sections.retail?.body || ''} onChange={(value) => updateSection('retail', { body: value })} />
          </div>
        </EditorSection>

        <EditorSection title="Footer" description="Short footer tagline shown alongside the site quick links.">
          <SectionEnabledToggle
            label="Show footer"
            value={sections.footer?.enabled !== false}
            onChange={(enabled) => updateSection('footer', { enabled })}
          />
          <label className="field-block">
            <span className="field-label">Footer tagline</span>
            <input value={sections.footer?.tagline || ''} onChange={(e) => updateSection('footer', { tagline: e.target.value })} />
          </label>
        </EditorSection>

        <EditorSection title="Legal Pages" description="Manage privacy and terms content plus whether those links appear publicly.">
          <SectionEnabledToggle
            label="Show privacy page"
            value={sections.privacy?.enabled !== false}
            onChange={(enabled) => updateSection('privacy', { enabled })}
          />
          <label className="field-block">
            <span className="field-label">Privacy page title</span>
            <input value={sections.privacy?.title || ''} onChange={(e) => updateSection('privacy', { title: e.target.value })} />
          </label>
          <ListEditor
            items={sections.privacy?.items || []}
            onChange={(items) => updateList('privacy', items)}
            fields={[
              { name: 'title', label: 'Privacy heading' },
              { name: 'body', label: 'Privacy body', rich: true },
            ]}
          />

          <SectionEnabledToggle
            label="Show terms page"
            value={sections.terms?.enabled !== false}
            onChange={(enabled) => updateSection('terms', { enabled })}
          />
          <label className="field-block">
            <span className="field-label">Terms page title</span>
            <input value={sections.terms?.title || ''} onChange={(e) => updateSection('terms', { title: e.target.value })} />
          </label>
          <ListEditor
            items={sections.terms?.items || []}
            onChange={(items) => updateList('terms', items)}
            fields={[
              { name: 'title', label: 'Terms heading' },
              { name: 'body', label: 'Terms body', rich: true },
            ]}
          />
        </EditorSection>
      </form>
    </div>
  );
}
