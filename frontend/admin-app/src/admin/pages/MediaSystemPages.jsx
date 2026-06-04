import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useAdminConfirm } from '../ConfirmProvider';
import { api, useAuth } from '../AdminShell';
import { BOOKING_STAT_LABELS, BOOKING_STAT_ORDER, StatusBadge, getBookingActions, parseServices, summarizePets, summarizeServices } from '../bookingDisplay';
import { EditorSection, ListEditor, RichTextEditor, SectionEnabledToggle } from '../ContentEditorControls';
import { ManualBookingLauncher } from '../ManualBooking';
import { MediaPicker, MediaPicture } from '../MediaPicker';
import { formatDateLabel, formatDateTime, formatMetadata, formatTimeAgo, formatTimeLabel, formatTimeRange, renderHoldExpiry, truncateText, getHoldInfo } from '../formatters';
import { createRetailCategoryForm, createRetailProductForm } from '../retailDefaults';
import { buildScheduleTimeOptions, formatScheduleTime, minutesToScheduleValue, normalizeAdminTimeInput, sortScheduleTimes, timeValueToMinutes, toggleScheduleTime } from '../scheduleTime';

export function MediaPage() {
  const confirm = useAdminConfirm();
  const [items, setItems] = useState([]);
  const [file, setFile] = useState();
  const [metadata, setMetadata] = useState({ alt_text: '', title: '', caption: '', category: 'default' });
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [filter, setFilter] = useState('all');

  const isImageAsset = (item) => !item?.asset_type || item.asset_type === 'image';
  const mediaKindLabel = (item) => {
    if (isImageAsset(item)) return 'Uploaded image';
    if (item.asset_type === 'spreadsheet') return 'Spreadsheet';
    if (item.asset_type === 'text') return 'Text file';
    return 'Document';
  };

  const load = useCallback(async () => {
    const response = await api.get('/media');
    setItems(response.data.data.items);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const upload = (e) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    Object.entries(metadata).forEach(([key, value]) => formData.append(key, value || ''));

    const request = new XMLHttpRequest();
    request.open('POST', '/api/admin/media');
    request.withCredentials = true;
    setUploadStatus('Uploading...');
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setUploadProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onreadystatechange = () => {
      if (request.readyState === XMLHttpRequest.DONE) {
        if (request.status >= 200 && request.status < 300) {
      setUploadStatus(file.type.startsWith('image/') ? 'Processing image variants...' : 'Saving file...');
          setUploadProgress(100);
          setFile(null);
          setMetadata({ alt_text: '', title: '', caption: '', category: metadata.category });
          load().then(() => {
            setUploadStatus('Upload complete');
            setTimeout(() => setUploadStatus(null), 2000);
            setUploadProgress(0);
          });
        } else {
          let message = 'Upload failed.';
          try {
            const parsed = JSON.parse(request.responseText);
            message = parsed.error?.message || message;
          } catch (err) {
            // ignore parse errors
          }
          setUploadStatus(message);
          setUploadProgress(0);
        }
      }
    };
    request.onerror = () => {
      setUploadStatus('Upload failed.');
      setUploadProgress(0);
    };
    request.send(formData);
  };

  const destroy = async (id) => {
    if (!(await confirm({
      message: 'Delete this media item? This can remove it from gallery, reviews, retail, or other public sections that reference it.',
      confirmLabel: 'Delete media',
      tone: 'danger',
    }))) {
      return;
    }

    try {
      await api.delete(`/media/${id}`);
      setUploadStatus('Media deleted.');
      load();
    } catch (err) {
      setUploadStatus(err.response?.data?.error?.message ?? 'Unable to delete that media item.');
    }
  };

  const categories = useMemo(() => {
    const uniq = new Set(items.map((item) => item.category || 'default'));
    return ['all', ...uniq];
  }, [items]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') {
      return items;
    }
    return items.filter((item) => item.category === filter);
  }, [items, filter]);

  return (
    <div>
      <h1>Media Library</h1>
      <p className="muted">Upload reusable site images and safe documents here once, then assign them where they belong.</p>
      <form className="card" onSubmit={upload}>
        <label className="field-block">
          <span className="field-label">File</span>
          <input type="file" accept="image/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx" onChange={(e) => setFile(e.target.files?.[0])} />
        </label>
        <label className="field-block">
          <span className="field-label">Alt text</span>
          <input value={metadata.alt_text} onChange={(e) => setMetadata((prev) => ({ ...prev, alt_text: e.target.value }))} />
        </label>
        <label className="field-block">
          <span className="field-label">Title</span>
          <input value={metadata.title} onChange={(e) => setMetadata((prev) => ({ ...prev, title: e.target.value }))} />
        </label>
        <label className="field-block">
          <span className="field-label">Caption</span>
          <textarea value={metadata.caption} onChange={(e) => setMetadata((prev) => ({ ...prev, caption: e.target.value }))} />
        </label>
        <label className="field-block">
          <span className="field-label">Library category</span>
          <select value={metadata.category} onChange={(e) => setMetadata((prev) => ({ ...prev, category: e.target.value }))}>
            <option value="default">Default</option>
            <option value="gallery">Gallery</option>
            <option value="retail">Retail</option>
            <option value="attachments">Documents</option>
          </select>
        </label>
        <button className="btn">Upload</button>
        {uploadProgress > 0 && (
          <div style={{ marginTop: '0.5rem', background: '#eee', borderRadius: '8px', height: '8px', overflow: 'hidden' }}>
            <div style={{ width: `${uploadProgress}%`, background: '#1f2937', height: '8px' }} />
          </div>
        )}
        {uploadStatus && <p role={uploadStatus.toLowerCase().includes('failed') ? 'alert' : 'status'}>{uploadStatus}</p>}
      </form>
      <div className="media-filter card">
        <label className="field-label">Filter by upload type</label>
        <div className="chip-row">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className={`chip ${filter === category ? 'is-active' : ''}`}
              onClick={() => setFilter(category)}
            >
              {category === 'all' ? 'All' : category}
            </button>
          ))}
        </div>
      </div>
      <div className="media-gallery">
        {filteredItems.map((item) => (
          <div key={item.id} className="card" data-media-id={item.id}>
            {isImageAsset(item) ? (
              <MediaPicture media={item} alt={item.alt_text || item.title || `Media ${item.id}`} />
            ) : (
              <div className="media-document-card">
                <strong>{mediaKindLabel(item)}</strong>
                <span>{item.mime_type}</span>
              </div>
            )}
            <p>
              <strong>{item.title || item.alt_text || `Media #${item.id}`}</strong>
            </p>
            <p>
              #{item.id} · {item.category}
            </p>
            <small>{item.mime_type}</small>
            <button className="btn btn-warn" style={{ marginTop: '0.5rem' }} onClick={() => destroy(item.id)}>
              Delete
            </button>
          </div>
        ))}
        {filteredItems.length === 0 && <div className="card">No media files match this filter.</div>}
      </div>
    </div>
  );
}


export function AuditLogPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/audit-log').then((response) => {
      setItems(response.data.data.items);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="card">Loading audit log...</div>;
  }

  return (
    <div>
      <h1>Audit Log</h1>
      <div className="card audit-table">
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>User</th>
              <th>Entity</th>
              <th>Metadata</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.action}</td>
                <td>{item.email ?? 'system'}</td>
                <td>
                  {item.entity_type} #{item.entity_id ?? '—'}
                </td>
                <td>{formatMetadata(item.metadata_json)}</td>
                <td>{formatDateTime(item.created_at)}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No audit entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


export function AdminUsersPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'manager', is_enabled: true });
  const [status, setStatus] = useState(null);

  const load = useCallback(async () => {
    const response = await api.get('/users');
    setItems(response.data.data.items);
  }, []);

  useEffect(() => {
    if (user?.role === 'super_admin') {
      load();
    }
  }, [load, user]);

  if (user?.role !== 'super_admin') {
    return <p>Super admin only.</p>;
  }

  const save = async (e) => {
    e.preventDefault();
    setStatus(null);
    try {
      await api.post('/users', form);
      setForm({ username: '', email: '', password: '', role: 'manager', is_enabled: true });
      setStatus({ tone: 'success', message: 'Admin user saved.' });
      load();
    } catch (err) {
      setStatus({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to save admin user.' });
    }
  };

  return (
    <div>
      <h1>Admin Users</h1>
      <form className="card" onSubmit={save}>
        <div className="grid two-col gap-sm">
          <div className="field-block">
            <label htmlFor="admin-user-username">Username</label>
            <input
              id="admin-user-username"
              placeholder="Optional username for login"
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
            />
          </div>
          <div className="field-block">
            <label htmlFor="admin-user-email">Email</label>
            <input
              id="admin-user-email"
              type="email"
              placeholder="name@example.com"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
          </div>
        </div>
        <div className="grid two-col gap-sm">
          <div className="field-block">
            <label htmlFor="admin-user-password">Password</label>
            <input
              id="admin-user-password"
              placeholder="Create a password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            />
          </div>
          <div className="field-block">
            <label htmlFor="admin-user-role">Role</label>
            <select id="admin-user-role" value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}>
              <option value="manager">Manager</option>
              <option value="scheduler">Scheduler</option>
              <option value="content_editor">Content Editor</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
        </div>
        <label>
          <input type="checkbox" checked={form.is_enabled} onChange={(e) => setForm((prev) => ({ ...prev, is_enabled: e.target.checked }))} /> Enabled
        </label>
        <button className="btn">Save User</button>
        {status && <p role={status.tone === 'error' ? 'alert' : 'status'} className={status.tone === 'error' ? 'muted danger' : 'muted'}>{status.message}</p>}
      </form>
      {items.map((item) => (
        <div key={item.id} className="card" style={{ marginTop: '0.75rem' }}>
          <strong>{item.username || item.email}</strong> {item.username ? <span className="small-text">({item.email})</span> : null} – {item.role} · {item.is_enabled ? 'Enabled' : 'Disabled'}
        </div>
      ))}
    </div>
  );
}
