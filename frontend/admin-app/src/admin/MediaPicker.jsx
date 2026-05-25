import { useEffect, useId, useRef, useState } from 'react';
import { api } from './AdminShell';

export function MediaPicker({ label, media, onChange, libraryCategory = '', uploadCategory = '' }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const dialogId = useId();
  const dialogTitleId = useId();
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  useEffect(() => {
    setItems([]);
  }, [libraryCategory]);

  const loadMedia = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/media', {
        params: libraryCategory ? { category: libraryCategory } : undefined,
      });
      setItems((response.data.data.items || []).filter((item) => !item.asset_type || item.asset_type === 'image'));
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Unable to load images right now.');
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', uploadCategory || libraryCategory || 'default');

      const response = await api.post('/media', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const nextMedia = response.data.data.media;
      setItems((current) => [nextMedia, ...current.filter((item) => item.id !== nextMedia.id)]);
      onChange(nextMedia);
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Unable to upload image.');
    } finally {
      event.target.value = '';
      setUploading(false);
    }
  };

  const openModal = () => {
    setOpen(true);
    if (!items.length) {
      loadMedia();
    }
  };

  return (
    <div className="media-picker">
      <label className="field-label">{label}</label>
      {media ? (
        <div className="media-thumb">
          <img src={media.fallback_url || media.original_url} alt={media.alt_text || label} />
        </div>
      ) : (
        <p className="muted small-text">No image selected</p>
      )}
      <div className="media-picker__actions">
        <button
          type="button"
          className="btn btn-tertiary"
          onClick={openModal}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={dialogId}
        >
          Choose image
        </button>
        <button type="button" className="btn btn-tertiary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? 'Uploading…' : 'Upload image'}
        </button>
        {media && (
          <button type="button" className="btn btn-link" onClick={() => onChange(null)}>
            Clear
          </button>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={uploadImage} />
      {error && <p role="alert" className="save-feedback is-error">{error}</p>}
      {open && (
        <div className="media-modal" role="presentation">
          <div className="media-modal__backdrop" onClick={() => setOpen(false)} />
          <div className="media-modal__content" id={dialogId} role="dialog" aria-modal="true" aria-labelledby={dialogTitleId}>
            <div className="media-modal__header">
              <h3 id={dialogTitleId}>Select media</h3>
              <button type="button" className="btn btn-link" onClick={() => setOpen(false)} aria-label={`Close ${label.toLowerCase()} picker`}>
                Close
              </button>
            </div>
            <div className="media-modal__toolbar">
              <button type="button" className="btn btn-tertiary" onClick={loadMedia} disabled={loading}>
                Refresh
              </button>
              <button type="button" className="btn btn-tertiary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? 'Uploading…' : 'Upload image'}
              </button>
            </div>
            {loading ? (
              <p>Loading…</p>
            ) : error ? (
              <p role="alert" className="save-feedback is-error">{error}</p>
            ) : items.length === 0 ? (
              <div className="inline-note">No images here yet. Upload one to get started.</div>
            ) : (
              <div className="media-grid">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="media-grid__item"
                    onClick={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                  >
                    <img src={item.fallback_url || item.original_url} alt={item.alt_text || `Media ${item.id}`} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function MediaPicture({ media, alt }) {
  if (!media || (!media.optimized_srcset && !media.webp_srcset)) {
    return null;
  }

  return (
    <picture style={{ display: 'block', marginBottom: '0.75rem' }}>
      {media.webp_srcset && <source type="image/webp" srcSet={media.webp_srcset} />}
      {media.optimized_srcset && <source srcSet={media.optimized_srcset} />}
      <img src={media.fallback_url || media.original_url} alt={alt || media.alt_text || ''} style={{ width: '100%', borderRadius: '10px' }} loading="lazy" />
    </picture>
  );
}
