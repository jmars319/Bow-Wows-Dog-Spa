import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { PublicPreviewLink, PublishState, SortOrderTools, reorderedItems } from '@jamarq/cpanel-admin-kit/convenience';
import { useAdminConfirm } from '../ConfirmProvider';
import { api, useAuth } from '../AdminShell';
import { BOOKING_STAT_LABELS, BOOKING_STAT_ORDER, StatusBadge, getBookingActions, parseServices, summarizePets, summarizeServices } from '../bookingDisplay';
import { EditorSection, ListEditor, RichTextEditor, SectionEnabledToggle } from '../ContentEditorControls';
import { ManualBookingLauncher } from '../ManualBooking';
import { MediaPicker, MediaPicture } from '../MediaPicker';
import { formatDateLabel, formatDateTime, formatMetadata, formatTimeAgo, formatTimeLabel, formatTimeRange, renderHoldExpiry, truncateText, getHoldInfo } from '../formatters';
import { createRetailCategoryForm, createRetailProductForm } from '../retailDefaults';
import { buildScheduleTimeOptions, formatScheduleTime, minutesToScheduleValue, normalizeAdminTimeInput, sortScheduleTimes, timeValueToMinutes, toggleScheduleTime } from '../scheduleTime';

export function ServicesPage() {
  const confirm = useAdminConfirm();
  const defaultForm = {
    id: null,
    name: '',
    short_summary: '',
    description: '',
    duration_minutes: 60,
    price_label: '',
    breed_weight_note: '',
    sort_order: 0,
    is_active: true,
  };

  const [items, setItems] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [feedback, setFeedback] = useState(null);
  const [reviewSearch, setReviewSearch] = useState('');
  const [draggedService, setDraggedService] = useState(null);
  const [serviceSearch, setServiceSearch] = useState('');

  const load = useCallback(async () => {
    const response = await api.get('/services');
    setItems(response.data.data.items || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (event) => {
    event.preventDefault();
    try {
      await api.post('/services', {
        ...form,
        duration_minutes: Number(form.duration_minutes) || 30,
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active ? 1 : 0,
      });
      setForm(defaultForm);
      setFeedback({ tone: 'success', message: 'Service saved.' });
      load();
    } catch (err) {
      setFeedback({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to save service.' });
    }
  };

  const edit = (item) => {
    setFeedback(null);
    setForm({
      id: item.id,
      name: item.name,
      short_summary: item.short_summary || '',
      description: item.description || '',
      duration_minutes: item.duration_minutes || 60,
      price_label: item.price_label || '',
      breed_weight_note: item.breed_weight_note || '',
      sort_order: item.sort_order || 0,
      is_active: Boolean(item.is_active),
    });
  };

  const duplicateReview = (item) => {
    setFeedback({ tone: 'success', message: 'Review copied into the editor. Review it, then save.' });
    setForm({
      id: null,
      reviewer_name: `${item.reviewer_name} copy`,
      review_text: item.review_text || '',
      star_rating: item.star_rating || 5,
      source_label: item.source_label || 'Google',
      source_url: item.source_url || '',
      display_order: Number(item.display_order || 0) + 10,
      is_featured: Boolean(item.is_featured),
    });
  };

  const filteredReviews = useMemo(() => {
    const query = reviewSearch.trim().toLowerCase();
    if (!query) {
      return items;
    }
    return items.filter((item) => [item.reviewer_name, item.review_text, item.source_label]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query));
  }, [items, reviewSearch]);

  const duplicateService = (item) => {
    setFeedback({ tone: 'success', message: 'Service copied into the editor. Review it, then save.' });
    setForm({
      id: null,
      name: `${item.name} copy`,
      short_summary: item.short_summary || '',
      description: item.description || '',
      duration_minutes: item.duration_minutes || 60,
      price_label: item.price_label || '',
      breed_weight_note: item.breed_weight_note || '',
      sort_order: Number(item.sort_order || 0) + 10,
      is_active: Boolean(item.is_active),
    });
  };

  const setServiceActive = async (item, nextActive) => {
    setFeedback(null);
    try {
      await api.post(`/services/${item.id}/active`, { is_active: nextActive ? 1 : 0 });
      setFeedback({ tone: 'success', message: nextActive ? 'Service is visible again.' : 'Service hidden from the public site and booking form.' });
      load();
    } catch (err) {
      setFeedback({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to update service visibility.' });
    }
  };

  const removeService = async (item) => {
    if (!(await confirm({
      title: 'Remove service?',
      message: `Remove “${item.name}” from the service list? Past booking records keep their saved service names.`,
      confirmLabel: 'Remove service',
      tone: 'danger',
    }))) {
      return;
    }

    setFeedback(null);
    try {
      await api.delete(`/services/${item.id}`);
      if (form.id === item.id) {
        setForm(defaultForm);
      }
      setFeedback({ tone: 'success', message: 'Service removed.' });
      load();
    } catch (err) {
      setFeedback({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to remove service.' });
    }
  };

  const reorderServices = async (nextItems) => {
    setItems(nextItems);
    try {
      await Promise.all(nextItems.map((item) => api.post('/services', {
        id: item.id,
        name: item.name,
        short_summary: item.short_summary || '',
        description: item.description || '',
        duration_minutes: Number(item.duration_minutes) || 30,
        price_label: item.price_label || '',
        breed_weight_note: item.breed_weight_note || '',
        sort_order: Number(item.sort_order) || 0,
        is_active: item.is_active ? 1 : 0,
      })));
      setFeedback({ tone: 'success', message: 'Service order saved.' });
      load();
    } catch (err) {
      setFeedback({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to save service order.' });
      load();
    }
  };

  const moveService = (item, offset) => {
    reorderServices(reorderedItems(items, item.id, { offset }));
  };

  const dropService = (target) => {
    if (!draggedService || draggedService.id === target.id) {
      return;
    }
    reorderServices(reorderedItems(items, draggedService.id, { targetId: target.id }));
    setDraggedService(null);
  };

  const filteredServices = useMemo(() => {
    const query = serviceSearch.trim().toLowerCase();
    if (!query) {
      return items;
    }
    return items.filter((item) => [item.name, item.short_summary, item.description, item.price_label, item.breed_weight_note]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query));
  }, [items, serviceSearch]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Services</h1>
          <p className="muted">Manage the live services used on the public site and in booking duration calculations.</p>
        </div>
        <PublicPreviewLink href="/#services" label="View services" />
      </div>
      <form className="card stack gap-sm" onSubmit={save}>
        <div className="grid two-col gap-sm">
          <label className="field-block">
            <span className="field-label">Service name</span>
            <input id="service-name" placeholder="Full service name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
          </label>
          <label className="field-block">
            <span className="field-label">Duration in minutes</span>
            <input
              id="service-duration"
              type="number"
              min="15"
              step="15"
              placeholder="60"
              value={form.duration_minutes}
              onChange={(e) => setForm((prev) => ({ ...prev, duration_minutes: e.target.value }))}
            />
          </label>
        </div>
        <label className="field-block">
          <span className="field-label">Short summary</span>
          <textarea
            id="service-summary"
            placeholder="Short summary for accordions and cards"
            value={form.short_summary}
            onChange={(e) => setForm((prev) => ({ ...prev, short_summary: e.target.value }))}
          />
        </label>
        <div className="field-block">
          <span className="field-label">Expanded description</span>
          <RichTextEditor value={form.description} onChange={(value) => setForm((prev) => ({ ...prev, description: value }))} />
        </div>
        <div className="grid two-col gap-sm">
          <label className="field-block">
            <span className="field-label">Pricing label</span>
            <input id="service-price-label" placeholder="Starts at $65" value={form.price_label} onChange={(e) => setForm((prev) => ({ ...prev, price_label: e.target.value }))} />
          </label>
          <label className="field-block">
            <span className="field-label">Breed or weight note</span>
            <input
              id="service-breed-note"
              placeholder="Optional note for sizing or coat needs"
              value={form.breed_weight_note}
              onChange={(e) => setForm((prev) => ({ ...prev, breed_weight_note: e.target.value }))}
            />
          </label>
        </div>
        <div className="grid two-col gap-sm">
          <label className="field-block">
            <span className="field-label">Display order</span>
            <input
              id="service-sort-order"
              type="number"
              placeholder="0"
              value={form.sort_order}
              onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))}
            />
          </label>
          <label className="toggle">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))} /> {form.is_active ? 'Visible on website' : 'Hidden from website'}
          </label>
        </div>
        <div className="form-actions">
          <button className="btn">{form.id ? 'Update Service' : 'Save Service'}</button>
          {form.id && (
            <button type="button" className="btn btn-link" onClick={() => setForm(defaultForm)}>
              Cancel edit
            </button>
          )}
          {feedback && <p role={feedback.tone === 'error' ? 'alert' : 'status'} className={`save-feedback ${feedback.tone === 'error' ? 'is-error' : 'is-success'}`}>{feedback.message}</p>}
        </div>
      </form>

      <div className="card section-search-card">
        <label className="field-block">
          <span className="field-label">Find a service</span>
          <input value={serviceSearch} placeholder="Search by name, note, or price..." onChange={(event) => setServiceSearch(event.target.value)} />
        </label>
      </div>

      <div className="card-grid">
        {filteredServices.map((item, index) => (
          <div key={item.id} className="card">
            <div className="booking-card__header">
              <strong>{item.name}</strong>
              <PublishState isPublished={item.is_active} publishedLabel="Visible on website" hiddenLabel="Hidden from website" />
            </div>
            {!serviceSearch.trim() && (
              <SortOrderTools
                item={item}
                index={index}
                total={items.length}
                onMove={moveService}
                onDragStart={setDraggedService}
                onDrop={dropService}
              />
            )}
            <p className="muted">{item.short_summary}</p>
            <p className="small-text">
              {item.duration_minutes} min · {item.price_label || 'Pricing note not set'}
            </p>
            <p className="small-text muted">{item.breed_weight_note || 'No breed/weight note'}</p>
            <p className="small-text muted">Display order: {item.sort_order ?? 0}</p>
            <div className="inline-actions">
              <button type="button" className="btn btn-tertiary" onClick={() => edit(item)}>
                Edit service
              </button>
              <button type="button" className="btn btn-tertiary" onClick={() => duplicateService(item)}>
                Duplicate
              </button>
              <button type="button" className="btn btn-tertiary" onClick={() => setServiceActive(item, !item.is_active)}>
                {item.is_active ? 'Hide service' : 'Show service'}
              </button>
              <button type="button" className="btn btn-warn" onClick={() => removeService(item)}>
                Remove
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="card">No services configured yet. Add a service here to make it available on the site and in booking requests.</div>}
        {items.length > 0 && filteredServices.length === 0 && <div className="card">No services match that search.</div>}
      </div>
    </div>
  );
}


export function FeaturedReviewsPage() {
  const defaultForm = {
    id: null,
    reviewer_name: '',
    review_text: '',
    star_rating: 5,
    source_label: 'Google',
    source_url: '',
    display_order: 0,
    is_featured: true,
  };

  const [items, setItems] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [feedback, setFeedback] = useState(null);

  const load = useCallback(async () => {
    const response = await api.get('/reviews');
    setItems(response.data.data.items || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (event) => {
    event.preventDefault();
    try {
      await api.post('/reviews', {
        ...form,
        star_rating: Number(form.star_rating) || 5,
        display_order: Number(form.display_order) || 0,
        is_featured: form.is_featured ? 1 : 0,
      });
      setForm(defaultForm);
      setFeedback({ tone: 'success', message: 'Featured review saved.' });
      load();
    } catch (err) {
      setFeedback({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to save featured review.' });
    }
  };

  const edit = (item) => {
    setFeedback(null);
    setForm({
      id: item.id,
      reviewer_name: item.reviewer_name,
      review_text: item.review_text,
      star_rating: item.star_rating || 5,
      source_label: item.source_label || 'Google',
      source_url: item.source_url || '',
      display_order: item.display_order || 0,
      is_featured: Boolean(item.is_featured),
    });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Featured Reviews</h1>
          <p className="muted">Feature real review excerpts here. This does not create a public review submission form.</p>
        </div>
        <PublicPreviewLink href="/#reviews" label="View reviews" />
      </div>
      <form className="card stack gap-sm" onSubmit={save}>
        <div className="grid two-col gap-sm">
          <label className="field-block">
            <span className="field-label">Reviewer name</span>
            <input
              id="reviewer-name"
              placeholder="Name shown publicly"
              value={form.reviewer_name}
              onChange={(e) => setForm((prev) => ({ ...prev, reviewer_name: e.target.value }))}
              required
            />
          </label>
          <label className="field-block">
            <span className="field-label">Star rating</span>
            <select id="review-star-rating" value={form.star_rating} onChange={(e) => setForm((prev) => ({ ...prev, star_rating: e.target.value }))}>
              {[5, 4, 3, 2, 1].map((rating) => (
                <option key={rating} value={rating}>
                  {rating} stars
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field-block">
          <span className="field-label">Review excerpt</span>
          <textarea
            id="review-excerpt"
            placeholder="Short excerpt approved for the public site"
            value={form.review_text}
            onChange={(e) => setForm((prev) => ({ ...prev, review_text: e.target.value }))}
            required
          />
        </label>
        <div className="grid two-col gap-sm">
          <label className="field-block">
            <span className="field-label">Source label</span>
            <input id="review-source-label" placeholder="Google" value={form.source_label} onChange={(e) => setForm((prev) => ({ ...prev, source_label: e.target.value }))} />
          </label>
          <label className="field-block">
            <span className="field-label">Source URL</span>
            <input id="review-source-url" placeholder="Optional review link" value={form.source_url} onChange={(e) => setForm((prev) => ({ ...prev, source_url: e.target.value }))} />
          </label>
        </div>
        <div className="grid two-col gap-sm">
          <label className="field-block">
            <span className="field-label">Display order</span>
            <input
              id="review-display-order"
              type="number"
              placeholder="0"
              value={form.display_order}
              onChange={(e) => setForm((prev) => ({ ...prev, display_order: e.target.value }))}
            />
          </label>
          <label className="toggle">
            <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm((prev) => ({ ...prev, is_featured: e.target.checked }))} /> {form.is_featured ? 'Visible on website' : 'Hidden from website'}
          </label>
        </div>
        <div className="form-actions">
          <button className="btn">{form.id ? 'Update Review' : 'Save Review'}</button>
          {form.id && (
            <button type="button" className="btn btn-link" onClick={() => setForm(defaultForm)}>
              Cancel edit
            </button>
          )}
          {feedback && <p role={feedback.tone === 'error' ? 'alert' : 'status'} className={`save-feedback ${feedback.tone === 'error' ? 'is-error' : 'is-success'}`}>{feedback.message}</p>}
        </div>
      </form>

      <div className="card section-search-card">
        <label className="field-block">
          <span className="field-label">Find a review</span>
          <input value={reviewSearch} placeholder="Search by name, source, or text..." onChange={(event) => setReviewSearch(event.target.value)} />
        </label>
      </div>

      <div className="card-grid">
        {filteredReviews.map((item) => (
          <div key={item.id} className="card">
            <div className="booking-card__header">
              <strong>{item.reviewer_name}</strong>
              <span className="small-text">{'★'.repeat(item.star_rating)}</span>
            </div>
            <p>{item.review_text}</p>
            <p className="small-text muted">
              {item.source_label}
              {item.source_url ? ' · Linked' : ''}
            </p>
            <p className="small-text muted">
              Display order: {item.display_order ?? 0} · {item.is_featured ? 'Visible' : 'Hidden'}
            </p>
            <button type="button" className="btn btn-tertiary" onClick={() => edit(item)}>
              Edit review
            </button>
            <button type="button" className="btn btn-tertiary" onClick={() => duplicateReview(item)}>
              Duplicate
            </button>
          </div>
        ))}
        {items.length === 0 && <div className="card">No featured reviews added yet. Add real review excerpts here when you are ready to feature them.</div>}
        {items.length > 0 && filteredReviews.length === 0 && <div className="card">No reviews match that search.</div>}
      </div>
    </div>
  );
}


export function GalleryPage() {
  const defaultForm = {
    id: null,
    title: '',
    caption: '',
    item_type: 'groomed_pet',
    primary_media: null,
    secondary_media: null,
    sort_order: 0,
    is_published: true,
  };

  const [items, setItems] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [feedback, setFeedback] = useState(null);
  const [draggedGalleryItem, setDraggedGalleryItem] = useState(null);
  const [gallerySearch, setGallerySearch] = useState('');

  const load = useCallback(async () => {
    const response = await api.get('/gallery-items');
    setItems(response.data.data.items || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (event) => {
    event.preventDefault();
    try {
      await api.post('/gallery-items', {
        id: form.id || undefined,
        title: form.title,
        caption: form.caption,
        item_type: form.item_type,
        primary_media_id: form.primary_media?.id ?? null,
        secondary_media_id: form.secondary_media?.id ?? null,
        sort_order: Number(form.sort_order) || 0,
        is_published: form.is_published ? 1 : 0,
      });
      setForm(defaultForm);
      setFeedback({ tone: 'success', message: 'Gallery item saved.' });
      load();
    } catch (err) {
      setFeedback({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to save gallery item.' });
    }
  };

  const edit = (item) => {
    setFeedback(null);
    setForm({
      id: item.id,
      title: item.title,
      caption: item.caption || '',
      item_type: item.item_type || 'groomed_pet',
      primary_media: item.primary_media || null,
      secondary_media: item.secondary_media || null,
      sort_order: item.sort_order || 0,
      is_published: Boolean(item.is_published),
    });
  };

  const duplicateGalleryItem = (item) => {
    setFeedback({ tone: 'success', message: 'Gallery item copied into the editor. Review it, then save.' });
    setForm({
      id: null,
      title: `${item.title} copy`,
      caption: item.caption || '',
      item_type: item.item_type || 'groomed_pet',
      primary_media: item.primary_media || null,
      secondary_media: item.secondary_media || null,
      sort_order: Number(item.sort_order || 0) + 10,
      is_published: Boolean(item.is_published),
    });
  };

  const featureGalleryItem = async (item) => {
    try {
      await api.post('/gallery-items', {
        id: item.id,
        title: item.title,
        caption: item.caption || '',
        item_type: item.item_type || 'groomed_pet',
        primary_media_id: item.primary_media_id,
        secondary_media_id: item.secondary_media_id,
        sort_order: Number(item.sort_order) || 0,
        is_published: 1,
      });
      setFeedback({ tone: 'success', message: 'Gallery item is now visible on the website.' });
      load();
    } catch (err) {
      setFeedback({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to feature this gallery item.' });
    }
  };

  const reorderGalleryItems = async (nextItems) => {
    setItems(nextItems);
    try {
      await Promise.all(nextItems.map((item) => api.post('/gallery-items', {
        id: item.id,
        title: item.title,
        caption: item.caption || '',
        item_type: item.item_type || 'groomed_pet',
        primary_media_id: item.primary_media_id,
        secondary_media_id: item.secondary_media_id,
        sort_order: Number(item.sort_order) || 0,
        is_published: item.is_published ? 1 : 0,
      })));
      setFeedback({ tone: 'success', message: 'Gallery order saved.' });
      load();
    } catch (err) {
      setFeedback({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to save gallery order.' });
      load();
    }
  };

  const moveGalleryItem = (item, offset) => {
    reorderGalleryItems(reorderedItems(items, item.id, { offset }));
  };

  const dropGalleryItem = (target) => {
    if (!draggedGalleryItem || draggedGalleryItem.id === target.id) {
      return;
    }
    reorderGalleryItems(reorderedItems(items, draggedGalleryItem.id, { targetId: target.id }));
    setDraggedGalleryItem(null);
  };

  const filteredGalleryItems = useMemo(() => {
    const query = gallerySearch.trim().toLowerCase();
    if (!query) {
      return items;
    }
    return items.filter((item) => [item.title, item.caption, item.item_type]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query));
  }, [gallerySearch, items]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Gallery</h1>
          <p className="muted">Choose the media shown in the public gallery, before/after blocks, and trust-building photo sections. Upload once in the media library, then reuse the same photo here or in the hero.</p>
        </div>
        <PublicPreviewLink href="/#gallery" label="View gallery" />
      </div>
      <div className="inline-note">
        <strong>Keep it simple</strong>
        <p className="muted small-text">Use this page to decide what appears publicly. Use the media library only for uploading and managing the source images.</p>
      </div>
      <form className="card stack gap-sm" onSubmit={save}>
        <div className="grid two-col gap-sm">
          <label className="field-block">
            <span className="field-label">Title</span>
            <input id="gallery-title" placeholder="Public title for this item" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} required />
          </label>
          <label className="field-block">
            <span className="field-label">Item type</span>
            <select id="gallery-item-type" value={form.item_type} onChange={(e) => setForm((prev) => ({ ...prev, item_type: e.target.value }))}>
              <option value="groomed_pet">Groomed Pet</option>
              <option value="before_after">Before / After</option>
              <option value="facility">Facility</option>
              <option value="boutique">Boutique</option>
            </select>
          </label>
        </div>
        <label className="field-block">
          <span className="field-label">Caption</span>
          <textarea id="gallery-caption" placeholder="Optional supporting caption" value={form.caption} onChange={(e) => setForm((prev) => ({ ...prev, caption: e.target.value }))} />
        </label>
        <MediaPicker label="Primary image" media={form.primary_media} onChange={(media) => setForm((prev) => ({ ...prev, primary_media: media }))} libraryCategory="gallery" uploadCategory="gallery" />
        <MediaPicker label="Secondary image (optional)" media={form.secondary_media} onChange={(media) => setForm((prev) => ({ ...prev, secondary_media: media }))} libraryCategory="gallery" uploadCategory="gallery" />
        <div className="grid two-col gap-sm">
          <label className="field-block">
            <span className="field-label">Display order</span>
            <input
              id="gallery-sort-order"
              type="number"
              placeholder="0"
              value={form.sort_order}
              onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))}
            />
          </label>
          <label className="toggle">
            <input type="checkbox" checked={form.is_published} onChange={(e) => setForm((prev) => ({ ...prev, is_published: e.target.checked }))} /> {form.is_published ? 'Visible on website' : 'Hidden from website'}
          </label>
        </div>
        <div className="form-actions">
          <button className="btn">{form.id ? 'Update Item' : 'Save Item'}</button>
          {form.id && (
            <button type="button" className="btn btn-link" onClick={() => setForm(defaultForm)}>
              Cancel edit
            </button>
          )}
          {feedback && <p role={feedback.tone === 'error' ? 'alert' : 'status'} className={`save-feedback ${feedback.tone === 'error' ? 'is-error' : 'is-success'}`}>{feedback.message}</p>}
        </div>
      </form>

      <div className="card section-search-card">
        <label className="field-block">
          <span className="field-label">Find a gallery item</span>
          <input value={gallerySearch} placeholder="Search by title, caption, or type..." onChange={(event) => setGallerySearch(event.target.value)} />
        </label>
      </div>

      <div className="card-grid">
        {filteredGalleryItems.map((item, index) => (
          <div key={item.id} className="card">
            <div className="happy-preview">
              {item.primary_media && (
                <img
                  src={item.primary_media.fallback_url || item.primary_media.original_url}
                  alt={item.primary_media.alt_text || item.title}
                  style={item.primary_media.object_position ? { objectPosition: item.primary_media.object_position } : undefined}
                />
              )}
              {item.secondary_media && (
                <img
                  src={item.secondary_media.fallback_url || item.secondary_media.original_url}
                  alt={item.secondary_media.alt_text || item.title}
                  style={item.secondary_media.object_position ? { objectPosition: item.secondary_media.object_position } : undefined}
                />
              )}
            </div>
            <strong>{item.title}</strong>
            <p className="muted">{item.caption}</p>
            <p className="small-text">
              {item.item_type} · {item.is_published ? 'Visible on website' : 'Hidden from website'}
            </p>
            <PublishState isPublished={item.is_published} publishedLabel="Visible on website" hiddenLabel="Hidden from website" />
            {!gallerySearch.trim() && (
              <SortOrderTools
                item={item}
                index={index}
                total={items.length}
                onMove={moveGalleryItem}
                onDragStart={setDraggedGalleryItem}
                onDrop={dropGalleryItem}
              />
            )}
            <p className="small-text muted">Display order: {item.sort_order ?? 0}</p>
            <div className="inline-actions">
              <button type="button" className="btn btn-tertiary" onClick={() => edit(item)}>
                Edit item
              </button>
              <button type="button" className="btn btn-tertiary" onClick={() => duplicateGalleryItem(item)}>
                Duplicate
              </button>
              {!item.is_published && (
                <button type="button" className="btn btn-tertiary" onClick={() => featureGalleryItem(item)}>
                  Feature this
                </button>
              )}
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="card">No gallery items yet. Add published media items to show photos on the public site.</div>}
        {items.length > 0 && filteredGalleryItems.length === 0 && <div className="card">No gallery items match that search.</div>}
      </div>
    </div>
  );
}


export function ContactMessagesPage() {
  const [items, setItems] = useState([]);
  const [messageSearch, setMessageSearch] = useState('');

  const load = useCallback(async () => {
    const response = await api.get('/contact-messages');
    setItems(response.data.data.items || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredMessages = useMemo(() => {
    const query = messageSearch.trim().toLowerCase();
    if (!query) {
      return items;
    }
    return items.filter((item) => [item.name, item.email, item.phone, item.message]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query));
  }, [items, messageSearch]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Contact Inbox</h1>
          <p className="muted">General contact messages live here only. Booking requests stay in the booking queue.</p>
        </div>
        <div className="page-toolbar">
          <PublicPreviewLink href="/#contact" label="View contact form" />
          <button className="btn btn-tertiary" onClick={load}>
            Refresh
          </button>
        </div>
      </div>
      <div className="card section-search-card">
        <label className="field-block">
          <span className="field-label">Find a message</span>
          <input value={messageSearch} placeholder="Search name, email, phone, or message..." onChange={(event) => setMessageSearch(event.target.value)} />
        </label>
      </div>
      <div className="booking-list">
        {filteredMessages.map((item) => (
          <div key={item.id} className="card">
            <div className="booking-card__header">
              <strong>{item.name}</strong>
              <span className="small-text muted">{formatDateTime(item.created_at)}</span>
            </div>
            <p className="small-text">{item.email}</p>
            {item.phone && <p className="small-text">{item.phone}</p>}
            <p>{item.message}</p>
          </div>
        ))}
        {items.length === 0 && <div className="card">No contact messages yet. Messages from the public contact form will appear here.</div>}
        {items.length > 0 && filteredMessages.length === 0 && <div className="card">No contact messages match that search.</div>}
      </div>
    </div>
  );
}
