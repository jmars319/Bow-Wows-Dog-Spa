import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MediaCategoryHelp,
  MediaQualityWarnings,
  SearchableSelect,
  UsageShortcuts,
  VisualFocusPicker,
  mediaCategoryInfo,
} from '@jamarq/cpanel-admin-kit/convenience';
import { useAdminConfirm } from '../ConfirmProvider';
import { api, useAuth } from '../AdminShell';
import { MediaPicture } from '../MediaPicker';
import { formatDateTime, formatMetadata } from '../formatters';

const MEDIA_CATEGORY_OPTIONS = [
  { value: 'hero', label: mediaCategoryInfo('hero').label },
  { value: 'gallery', label: mediaCategoryInfo('gallery').label },
  { value: 'retail', label: mediaCategoryInfo('retail').label },
  { value: 'default', label: mediaCategoryInfo('default').label },
  { value: 'attachments', label: mediaCategoryInfo('attachments').label },
];

function formatAuditActionLabel(action) {
  const known = {
    login: 'Admin signed in',
    logout: 'Admin signed out',
    create: 'Created record',
    update: 'Updated record',
    delete: 'Deleted record',
  };
  const key = String(action || '').toLowerCase();
  if (known[key]) {
    return known[key];
  }

  return key
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Admin action';
}

export function MediaPage() {
  const confirm = useAdminConfirm();
  const [items, setItems] = useState([]);
  const [files, setFiles] = useState([]);
  const [metadata, setMetadata] = useState({ alt_text: '', title: '', caption: '', category: 'default' });
  const [createGalleryDrafts, setCreateGalleryDrafts] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [filters, setFilters] = useState({
    category: 'all',
    asset_type: 'all',
    archived: 'active',
    in_use: 'all',
    health: 'all',
    search: '',
  });
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [replacementIds, setReplacementIds] = useState({});
  const uploadInputRef = useRef(null);

  const isImageAsset = (item) => !item?.asset_type || item.asset_type === 'image';
  const mediaKindLabel = (item) => {
    if (isImageAsset(item)) return 'Uploaded image';
    if (item.asset_type === 'spreadsheet') return 'Spreadsheet';
    if (item.asset_type === 'text') return 'Text file';
    return 'Document';
  };

  const load = useCallback(async () => {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== '' && value !== 'all')
    );
    const response = await api.get('/media', { params });
    setItems(response.data.data.items);
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = (e) => {
    e.preventDefault();
    if (files.length === 0) return;
    if (files.length > 1 && !['default', 'gallery'].includes(metadata.category)) {
      setUploadStatus('Bulk upload is available for Default and Gallery images only.');
      return;
    }

    const formData = new FormData();
    if (files.length > 1) {
      files.forEach((item) => formData.append('files[]', item));
      if (metadata.category === 'gallery' && createGalleryDrafts) {
        formData.append('create_gallery_drafts', '1');
      }
    } else {
      formData.append('file', files[0]);
    }
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
          setUploadStatus(files.some((item) => item.type.startsWith('image/')) ? 'Processing image variants...' : 'Saving file...');
          setUploadProgress(100);
          setFiles([]);
          if (uploadInputRef.current) {
            uploadInputRef.current.value = '';
          }
          setMetadata({ alt_text: '', title: '', caption: '', category: metadata.category });
          load().then(() => {
            let message = 'Upload complete';
            try {
              const parsed = JSON.parse(request.responseText);
              const duplicateMessage = parsed.data?.message || parsed.data?.messages?.[0];
              const draftCount = parsed.data?.gallery_drafts?.length || 0;
              if (duplicateMessage) {
                message = duplicateMessage;
              } else if (draftCount > 0) {
                message = `${draftCount} gallery draft${draftCount === 1 ? '' : 's'} created for review.`;
              }
            } catch (err) {
              // Keep the generic success text because legacy upload handlers may return non-JSON bodies.
            }
            setUploadStatus(message);
            setTimeout(() => setUploadStatus(null), 2000);
            setUploadProgress(0);
          });
        } else {
          let message = 'Upload failed.';
          try {
            const parsed = JSON.parse(request.responseText);
            message = parsed.error?.message || message;
          } catch (err) {
            // Non-JSON error responses should not hide the generic upload failure.
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

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditDraft({
      title: item.title || '',
      alt_text: item.alt_text || '',
      caption: item.caption || '',
      category: item.category || 'default',
      focal_x: item.focal_x ?? '',
      focal_y: item.focal_y ?? '',
      is_archived: Boolean(item.is_archived),
    });
  };

  const updateDraft = (key, value) => {
    setEditDraft((current) => ({ ...current, [key]: value }));
  };

  const saveEdit = async (id) => {
    try {
      await api.put(`/media/${id}`, editDraft);
      setUploadStatus('Media details saved.');
      setEditingId(null);
      setEditDraft({});
      load();
    } catch (err) {
      setUploadStatus(err.response?.data?.error?.message ?? 'Unable to save media details.');
    }
  };

  const archiveItem = async (item, archived) => {
    const label = archived ? 'Archive this media item?' : 'Restore this media item?';
    if (!(await confirm({
      message: label,
      confirmLabel: archived ? 'Archive media' : 'Restore media',
      tone: archived ? 'warning' : 'default',
    }))) {
      return;
    }

    try {
      await api.put(`/media/${item.id}`, { is_archived: archived ? 1 : 0 });
      setUploadStatus(archived ? 'Media archived.' : 'Media restored.');
      load();
    } catch (err) {
      setUploadStatus(err.response?.data?.error?.message ?? 'Unable to update archive status.');
    }
  };

  const replaceEverywhere = async (item) => {
    const replacementId = Number(replacementIds[item.id] || 0);
    if (!replacementId) {
      setUploadStatus('Choose a replacement image first.');
      return;
    }
    if (!(await confirm({
      message: `Replace every known use of "${item.title || item.alt_text || `Media #${item.id}`}" with the selected image? The old image will be archived.`,
      confirmLabel: 'Replace everywhere',
      tone: 'warning',
    }))) {
      return;
    }

    try {
      const response = await api.post(`/media/${item.id}/replace`, { replacement_media_id: replacementId });
      setUploadStatus(`Updated ${response.data.data.replaced || 0} reference${response.data.data.replaced === 1 ? '' : 's'} and archived the old image.`);
      setReplacementIds((current) => ({ ...current, [item.id]: '' }));
      load();
    } catch (err) {
      setUploadStatus(err.response?.data?.error?.message ?? 'Unable to replace this image.');
    }
  };

  const destroy = async (id) => {
    if (!(await confirm({
      message: 'Permanently delete this archived media item? This removes the database record and stored files. This is only allowed when it is unused.',
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
    const standard = MEDIA_CATEGORY_OPTIONS.map((option) => option.value);
    const uniq = new Set([...standard, ...items.map((item) => item.category || 'default')]);
    return ['all', ...uniq];
  }, [items]);

  const replacementOptions = useMemo(
    () => items.filter((item) => isImageAsset(item) && !item.is_archived),
    [items]
  );
  const replacementSelectOptions = useMemo(
    () => replacementOptions.map((option) => ({
      value: option.id,
      label: option.title || option.alt_text || `Media #${option.id}`,
      meta: [option.category, option.file_name || option.original_filename].filter(Boolean).join(' · '),
      searchText: [
        option.title,
        option.alt_text,
        option.caption,
        option.category,
        option.file_name,
        option.original_filename,
        option.id,
      ].filter(Boolean).join(' '),
    })),
    [replacementOptions]
  );

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <div>
      <h1>Media Library</h1>
      <p className="muted">Upload reusable site images and safe documents here once, then assign them where they belong.</p>
      <form className="card" data-media-upload-form onSubmit={upload}>
        <label className="field-block">
          <span className="field-label">File</span>
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
          <span className="small-text muted">Images are optimized after upload. Multiple uploads are only for Default or Gallery images.</span>
          {files.length > 0 && <span className="small-text">{files.length} file{files.length === 1 ? '' : 's'} selected.</span>}
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
            {MEDIA_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <MediaCategoryHelp category={metadata.category} />
        </label>
        {files.length > 1 && metadata.category === 'gallery' && (
          <label className="toggle gallery-draft-option">
            <input
              type="checkbox"
              checked={createGalleryDrafts}
              onChange={(event) => setCreateGalleryDrafts(event.target.checked)}
            />
            Create unpublished Gallery review drafts from these uploads
          </label>
        )}
        <button className="btn" disabled={files.length === 0}>{files.length > 1 ? `Upload ${files.length} files` : 'Upload'}</button>
        {uploadProgress > 0 && (
          <div style={{ marginTop: '0.5rem', background: '#eee', borderRadius: '8px', height: '8px', overflow: 'hidden' }}>
            <div style={{ width: `${uploadProgress}%`, background: '#1f2937', height: '8px' }} />
          </div>
        )}
        {uploadStatus && (
          <p role={/failed|larger|could not|unable|error/i.test(uploadStatus) ? 'alert' : 'status'} className={/failed|larger|could not|unable|error/i.test(uploadStatus) ? 'save-feedback is-error' : 'save-feedback is-success'}>
            {uploadStatus}
          </p>
        )}
      </form>
      <div className="media-filter card">
        <div className="grid three-col gap-sm">
          <label className="field-block">
            <span className="field-label">Search</span>
            <input value={filters.search} placeholder="Name, caption, filename..." onChange={(event) => updateFilter('search', event.target.value)} />
          </label>
          <label className="field-block">
            <span className="field-label">Category</span>
            <select value={filters.category} onChange={(event) => updateFilter('category', event.target.value)}>
              {categories.map((category) => (
                <option key={category} value={category}>{category === 'all' ? 'All' : mediaCategoryInfo(category).label}</option>
              ))}
            </select>
          </label>
          <label className="field-block">
            <span className="field-label">Type</span>
            <select value={filters.asset_type} onChange={(event) => updateFilter('asset_type', event.target.value)}>
              <option value="all">All</option>
              <option value="image">Images</option>
              <option value="document">Documents</option>
              <option value="spreadsheet">Spreadsheets</option>
              <option value="text">Text files</option>
            </select>
          </label>
          <label className="field-block">
            <span className="field-label">Archive</span>
            <select value={filters.archived} onChange={(event) => updateFilter('archived', event.target.value)}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">Active and archived</option>
            </select>
          </label>
          <label className="field-block">
            <span className="field-label">Usage</span>
            <select value={filters.in_use} onChange={(event) => updateFilter('in_use', event.target.value)}>
              <option value="all">Any use</option>
              <option value="yes">In use</option>
              <option value="no">Unused</option>
            </select>
          </label>
          <label className="field-block">
            <span className="field-label">Needs attention</span>
            <select value={filters.health} onChange={(event) => updateFilter('health', event.target.value)}>
              <option value="all">Any status</option>
              <option value="needs_attention">Needs attention</option>
              <option value="missing_alt">Alt text needed</option>
              <option value="small_hero">Hero image may be too small</option>
              <option value="unusual_aspect">Unusual crop shape</option>
              <option value="missing_variants">Optimized versions missing</option>
              <option value="missing_local_file">Local fallback missing</option>
            </select>
          </label>
        </div>
      </div>
      <div className="media-gallery">
        {items.map((item) => (
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
              #{item.id} · {mediaCategoryInfo(item.category || 'default').label} · {item.is_archived ? 'Archived' : 'Active'}
            </p>
            <small>{mediaKindLabel(item)} · {item.mime_type}</small>
            <UsageShortcuts usages={(item.usages || []).map((usage) => ({
              id: `${usage.type}-${usage.label}`,
              label: usage.label,
              href: usage.admin_path,
            }))} />
            {isImageAsset(item) && (
              <MediaQualityWarnings asset={item} context={item.category === 'hero' ? 'hero' : 'image'} />
            )}
            {editingId === item.id ? (
              <div className="media-edit-panel">
                <label className="field-block">
                  <span className="field-label">Title</span>
                  <input value={editDraft.title || ''} onChange={(event) => updateDraft('title', event.target.value)} />
                </label>
                <label className="field-block">
                  <span className="field-label">Alt text</span>
                  <input value={editDraft.alt_text || ''} onChange={(event) => updateDraft('alt_text', event.target.value)} />
                </label>
                {isImageAsset(item) && !editDraft.alt_text && (editDraft.title || editDraft.caption) && (
                  <button
                    type="button"
                    className="btn btn-tertiary"
                    onClick={() => updateDraft('alt_text', editDraft.title || editDraft.caption)}
                  >
                    Use title/caption as alt text
                  </button>
                )}
                <label className="field-block">
                  <span className="field-label">Caption</span>
                  <textarea value={editDraft.caption || ''} onChange={(event) => updateDraft('caption', event.target.value)} />
                </label>
                <div className="grid two-col gap-sm">
                  <label className="field-block">
                    <span className="field-label">Category</span>
                    <select value={editDraft.category || 'default'} onChange={(event) => updateDraft('category', event.target.value)}>
                      {MEDIA_CATEGORY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <MediaCategoryHelp category={editDraft.category || 'default'} />
                  </label>
                  <label className="toggle">
                    <input type="checkbox" checked={Boolean(editDraft.is_archived)} onChange={(event) => updateDraft('is_archived', event.target.checked)} /> Archived
                  </label>
                </div>
                {isImageAsset(item) && (
                  <VisualFocusPicker
                    imageUrl={item.fallback_url || item.original_url}
                    focalX={editDraft.focal_x}
                    focalY={editDraft.focal_y}
                    onChange={(focus) => setEditDraft((current) => ({ ...current, ...focus }))}
                  />
                )}
                <div className="form-actions">
                  <button type="button" className="btn" onClick={() => saveEdit(item.id)}>Save details</button>
                  <button type="button" className="btn btn-link" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="inline-actions">
                <button type="button" className="btn btn-tertiary" onClick={() => startEdit(item)}>Edit details</button>
                <button type="button" className="btn btn-tertiary" onClick={() => archiveItem(item, !item.is_archived)}>
                  {item.is_archived ? 'Restore' : 'Archive'}
                </button>
              </div>
            )}
            {isImageAsset(item) && item.usage_labels?.length > 0 && (
              <div className="replace-panel">
                <label className="field-block">
                  <span className="field-label">Replace everywhere with</span>
                  <SearchableSelect
                    label={`Replacement image for ${item.title || item.alt_text || `Media #${item.id}`}`}
                    value={replacementIds[item.id] || ''}
                    options={[
                      { value: '', label: 'Choose image' },
                      ...replacementSelectOptions.filter((option) => String(option.value) !== String(item.id)),
                    ]}
                    onChange={(nextValue) => setReplacementIds((current) => ({ ...current, [item.id]: nextValue }))}
                    searchPlaceholder="Search existing images..."
                    emptyMessage="No matching images"
                    clearLabel="Clear replacement image"
                  />
                </label>
                <button type="button" className="btn btn-warn" onClick={() => replaceEverywhere(item)}>Replace everywhere</button>
              </div>
            )}
            {item.can_delete && (
              <button className="btn btn-warn" style={{ marginTop: '0.5rem' }} onClick={() => destroy(item.id)}>
                Delete archived media
              </button>
            )}
          </div>
        ))}
        {items.length === 0 && <div className="card">No media files match this filter.</div>}
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
                <td>{formatAuditActionLabel(item.action)}</td>
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

export function ChangePasswordPage() {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [status, setStatus] = useState(null);

  const save = async (event) => {
    event.preventDefault();
    setStatus(null);
    try {
      await api.post('/change-password', form);
      setForm({ current_password: '', new_password: '', confirm_password: '' });
      setStatus({ tone: 'success', message: 'Password updated.' });
    } catch (err) {
      setStatus({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to update password.' });
    }
  };

  return (
    <div>
      <h1>Change Password</h1>
      <p className="muted">Update the password for the admin account you are signed into.</p>
      <form className="card stack gap-sm" onSubmit={save}>
        <label className="field-block">
          <span className="field-label">Current password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={form.current_password}
            onChange={(event) => setForm((current) => ({ ...current, current_password: event.target.value }))}
            required
          />
        </label>
        <label className="field-block">
          <span className="field-label">New password</span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={form.new_password}
            onChange={(event) => setForm((current) => ({ ...current, new_password: event.target.value }))}
            required
          />
        </label>
        <label className="field-block">
          <span className="field-label">Confirm new password</span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={form.confirm_password}
            onChange={(event) => setForm((current) => ({ ...current, confirm_password: event.target.value }))}
            required
          />
        </label>
        <div className="form-actions">
          <button className="btn">Update Password</button>
          {status && (
            <p role={status.tone === 'error' ? 'alert' : 'status'} className={`save-feedback ${status.tone === 'error' ? 'is-error' : 'is-success'}`}>
              {status.message}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
