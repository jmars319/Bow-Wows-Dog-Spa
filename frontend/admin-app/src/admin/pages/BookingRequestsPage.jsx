import { useCallback, useEffect, useId, useState } from 'react';
import { PublicPreviewLink } from '@jamarq/cpanel-admin-kit/convenience';
import { useAdminConfirm } from '../ConfirmProvider';
import { api } from '../AdminShell';
import { BOOKING_STAT_LABELS, BOOKING_STAT_ORDER, StatusBadge, getBookingActions, parseServices, summarizePets, summarizeServices } from '../bookingDisplay';
import { ManualBookingLauncher } from '../ManualBooking';
import { formatDateLabel, formatTimeAgo, formatTimeLabel, formatTimeRange, renderHoldExpiry, truncateText, getHoldInfo } from '../formatters';

export function BookingRequestsPage() {
  const confirm = useAdminConfirm();

  // Booking request state
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({});
  const [statusFilter, setStatusFilter] = useState('');
  const [testFilter, setTestFilter] = useState('hide');
  const [requestSearch, setRequestSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editDirty, setEditDirty] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [emailPreview, setEmailPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [scheduleSettings, setScheduleSettings] = useState(null);
  const dialogTitleId = useId();

  const load = useCallback(async () => {
    const response = await api.get('/booking-requests', {
      params: {
        status: statusFilter || undefined,
        test: testFilter,
        search: requestSearch.trim() || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      },
    });
    setItems(response.data.data.items);
    setStats(response.data.data.stats);
  }, [dateFrom, dateTo, requestSearch, statusFilter, testFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.get('/schedule/templates').then((response) => setScheduleSettings(response.data.data.settings));
  }, []);

  useEffect(() => {
    if (!selected) {
      return undefined;
    }

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setSelected(null);
      }
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const refreshed = items.find((item) => item.id === selected.id);
    if (refreshed) {
      setSelected(refreshed);
      if (!notesDirty) {
        setNotes(refreshed.admin_notes || '');
      }
      if (!editDirty) {
        setEditForm(createBookingEditForm(refreshed));
      }
      return;
    }

    setSelected(null);
    setNotes('');
    setNotesDirty(false);
    setEditForm(null);
    setEditDirty(false);
  }, [editDirty, items, notesDirty, selected]);

  // Booking detail workflow
  const openDetails = (request) => {
    setFeedback(null);
    setSelected(request);
    setNotes(request.admin_notes || '');
    setNotesDirty(false);
    setEditForm(createBookingEditForm(request));
    setEditDirty(false);
    setEmailPreview(null);
  };

  const closeDetails = () => {
    setSelected(null);
    setFeedback(null);
    setNotesDirty(false);
    setEditForm(null);
    setEditDirty(false);
    setEmailPreview(null);
  };

  const saveNotes = async () => {
    if (!selected) return;
    try {
      const response = await api.post('/booking-requests/notes', { id: selected.id, notes });
      const updated = response.data.data;
      setSelected(updated);
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setNotes(updated.admin_notes || '');
      setNotesDirty(false);
      setEditForm(createBookingEditForm(updated));
      setEditDirty(false);
      setFeedback({ tone: 'success', message: 'Internal notes saved.' });
    } catch (err) {
      setFeedback({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to save notes.' });
    }
  };

  // Booking action workflow
  const performAction = async (action) => {
    if (!selected) return;
    if (!(await confirm({ message: bookingActionPrompt(selected, action), confirmLabel: 'Continue', tone: 'danger' }))) {
      return;
    }
    try {
      const response = await api.post('/booking-requests/action', { id: selected.id, action, notes });
      const updated = response.data.data;
      const labels = {
        confirm: 'Booking confirmed.',
        decline: 'Booking declined.',
        cancel: 'Booking cancelled.',
        complete: 'Booking marked completed.',
      };
      setSelected(updated);
      setNotes(updated.admin_notes || '');
      setNotesDirty(false);
      setEditForm(createBookingEditForm(updated));
      setEditDirty(false);
      setFeedback({ tone: 'success', message: labels[action] || 'Booking updated.' });
      setTimeout(() => setFeedback(null), 2500);
      load();
    } catch (err) {
      setFeedback({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to update booking.' });
    }
  };

  const performListAction = async (event, request, action) => {
    event.stopPropagation();
    if (!(await confirm({ message: bookingActionPrompt(request, action), confirmLabel: 'Continue', tone: 'danger' }))) {
      return;
    }

    try {
      const response = await api.post('/booking-requests/action', { id: request.id, action, notes: request.admin_notes || '' });
      const updated = response.data.data;
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      if (selected?.id === updated.id) {
        setSelected(updated);
        setNotes(updated.admin_notes || '');
        setEditForm(createBookingEditForm(updated));
      }
      setFeedback({ tone: 'success', message: 'Booking updated.' });
      setTimeout(() => setFeedback(null), 2500);
      load();
    } catch (err) {
      setFeedback({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to update booking.' });
    }
  };

  // Hold management boundary
  const extendHold = async () => {
    if (!selected) return;
    try {
      const response = await api.post('/booking-requests/extend', { id: selected.id });
      const updated = response.data.data;
      setSelected(updated);
      setNotes(updated.admin_notes || '');
      setNotesDirty(false);
      setEditForm(createBookingEditForm(updated));
      setEditDirty(false);
      load();
      setFeedback({ tone: 'success', message: 'Hold extended an additional 24 hours.' });
    } catch (err) {
      setFeedback({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to extend hold.' });
    }
  };

  const releaseHold = async () => {
    if (!selected) return;
    if (!(await confirm({
      message: 'Release this hold and free the slot? This will cancel the pending request.',
      confirmLabel: 'Release hold',
      tone: 'danger',
    }))) {
      return;
    }
    try {
      const response = await api.post('/booking-requests/release', { id: selected.id, notes });
      const updated = response.data.data;
      setSelected(updated);
      setNotes(updated.admin_notes || '');
      setNotesDirty(false);
      setEditForm(createBookingEditForm(updated));
      setEditDirty(false);
      load();
      setFeedback({ tone: 'success', message: 'Hold released.' });
    } catch (err) {
      setFeedback({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to release hold.' });
    }
  };

  const updateEditField = (key, value) => {
    setEditForm((current) => ({ ...(current || {}), [key]: value }));
    setEditDirty(true);
  };

  const saveBookingDetails = async () => {
    if (!selected || !editForm) return;
    try {
      const response = await api.post('/booking-requests/update', {
        ...editForm,
        id: selected.id,
        pets: selected.pets || [],
      });
      const updated = response.data.data;
      setSelected(updated);
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setNotes(updated.admin_notes || '');
      setNotesDirty(false);
      setEditForm(createBookingEditForm(updated));
      setEditDirty(false);
      setFeedback({ tone: 'success', message: 'Booking details saved.' });
      load();
    } catch (err) {
      setFeedback({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to save booking details.' });
    }
  };

  // Admin export surface
  const previewCustomerEmail = async (template) => {
    if (!selected) return;
    setPreviewLoading(true);
    setEmailPreview(null);
    try {
      const response = await api.post('/booking-requests/email-preview', {
        id: selected.id,
        template,
        notes,
      });
      setEmailPreview({
        template,
        ...response.data.data,
      });
    } catch (err) {
      setFeedback({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to preview that email.' });
    } finally {
      setPreviewLoading(false);
    }
  };

  const exportFilteredRequests = () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (testFilter) params.set('test', testFilter);
    if (requestSearch.trim()) params.set('search', requestSearch.trim());
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    window.location.href = `/api/admin/booking-requests/export?${params.toString()}`;
  };

  const statusOptions = [
    { value: '', label: 'All statuses' },
    { value: 'pending_confirmation', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'completed', label: 'Completed' },
    { value: 'declined', label: 'Declined' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'expired', label: 'Expired' },
  ];
  return (
    <ManualBookingLauncher onCreated={load} scheduleSettings={scheduleSettings}>
      {(openManual) => (
        <div>
          <div className="page-header">
            <h1>Booking Requests</h1>
            <div className="page-toolbar">
              <PublicPreviewLink href="/#booking" label="View booking" />
              <button className="btn" onClick={() => openManual()}>
                Manual Request
              </button>
              <button className="btn btn-tertiary" onClick={() => openManual({ isInternalTest: true })}>
                Test Request
              </button>
              <button className="btn btn-tertiary" onClick={exportFilteredRequests}>
                Export CSV
              </button>
            </div>
          </div>
          <div className="booking-layout booking-layout--queue">
            <div className="booking-column">
              <div className="card">
                <label className="field-label">Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <label className="field-block" style={{ marginTop: '0.75rem' }}>
                  <span className="field-label">Test requests</span>
                  <select value={testFilter} onChange={(event) => setTestFilter(event.target.value)}>
                    <option value="hide">Hide</option>
                    <option value="all">Show all</option>
                    <option value="only">Tests</option>
                  </select>
                </label>
                <div className="grid two-col gap-sm" style={{ marginTop: '0.75rem' }}>
                  <label className="field-block">
                    <span className="field-label">From</span>
                    <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                  </label>
                  <label className="field-block">
                    <span className="field-label">To</span>
                    <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                  </label>
                </div>
                <label className="field-block" style={{ marginTop: '0.75rem' }}>
                  <span className="field-label">Find</span>
                  <input
                    value={requestSearch}
                    placeholder="Search requests..."
                    onChange={(event) => setRequestSearch(event.target.value)}
                  />
                </label>
              </div>

              <div className="stat-grid">
                {BOOKING_STAT_ORDER.map((key) => (
                  <div key={key} className="card stat-card">
                    <p>{BOOKING_STAT_LABELS[key]}</p>
                    <strong>{stats?.[key] ?? 0}</strong>
                  </div>
                ))}
              </div>

              <div className="booking-list">
                {feedback && !selected && (
                  <p className={`save-feedback ${feedback.tone === 'error' ? 'is-error' : 'is-success'}`}>{feedback.message}</p>
                )}
                {items.map((request) => {
                  const holdInfo = getHoldInfo(request.created_at, scheduleSettings?.booking_pending_expire_hours);
                  return (
                    <article
                      key={request.id}
                      className={`card booking-card booking-card--${request.status} ${selected?.id === request.id ? 'is-active' : ''}`}
                      onClick={() => openDetails(request)}
                    >
                      <div className="booking-card__header">
                        <div>
                          <strong>{request.customer_name}</strong>
                          <p className="muted">
                            {formatDateLabel(request.date)} · {formatTimeLabel(request.date, request.time)}
                          </p>
                        </div>
                        <StatusBadge status={request.status} />
                      </div>
                      {request.is_internal_test && <span className="status-pill status-pill--info">Internal test</span>}
                      <div className="booking-card__meta">
                        <div>
                          <p className="small-text">{request.email}</p>
                          <p className="small-text">{request.phone}</p>
                        </div>
                        <div>
                          <p className="small-text">{summarizePets(request.pets) || request.dog_name || 'No dog info'}</p>
                          <p className="small-text muted">{truncateText(request.request_notes || request.dog_notes) || 'No customer notes provided'}</p>
                        </div>
                      </div>
                      <p className="small-text">{(request.service_names || []).join(', ') || summarizeServices(request.services_json)}</p>
                      {(request.paperwork_attachments || []).length > 0 && (
                        <p className="small-text muted">{request.paperwork_attachments.length} paperwork file{request.paperwork_attachments.length === 1 ? '' : 's'} attached</p>
                      )}
                      <p className="muted small-text">
                        Submitted {formatTimeAgo(request.created_at)}
                        {holdInfo && request.status === 'pending_confirmation' ? ` · ~${holdInfo.hoursRemaining}h hold left` : ''}
                      </p>
                      <div className="booking-card__quick-actions">
                        {getBookingActions(request.status).map((action) => (
                          <button
                            key={action.key}
                            className={`btn ${action.className}`}
                            type="button"
                            onClick={(event) => performListAction(event, request, action.key)}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                      <button className="btn btn-tertiary" type="button" onClick={(event) => { event.stopPropagation(); openDetails(request); }}>
                        Open request
                      </button>
                    </article>
                  );
                })}
                {items.length === 0 && <div className="card">No requests found.</div>}
              </div>
            </div>
          </div>

          {selected && (
            <div className="modal" role="presentation">
              <div className="modal__backdrop" onClick={closeDetails} />
              <div className="modal__content booking-request-modal" role="dialog" aria-modal="true" aria-labelledby={dialogTitleId} onClick={(event) => event.stopPropagation()}>
                <div className="modal__header">
                  <div>
                    <h3 id={dialogTitleId}>Booking Request</h3>
                    <p className="muted small-text">Review and respond to request #{selected.id}.</p>
                  </div>
                  <button type="button" className="btn btn-link" onClick={closeDetails}>
                    Close
                  </button>
                </div>

                <div className="booking-detail__content">
                  <h2>{selected.customer_name}</h2>
                  <p className="muted small-text">Request #{selected.id}</p>
                  <StatusBadge status={selected.status} />
                  {selected.is_internal_test && (
                    <div className="inline-note booking-detail__notice">
                      <strong>Internal test request</strong>
                      <p className="muted small-text">No customer emails or calendar sync unless staff runs a sync test.</p>
                    </div>
                  )}
                  {selected.status === 'pending_confirmation' && (
                    <div className="inline-note booking-detail__notice">
                      <strong>Pending review</strong>
                      <p className="muted small-text">This request holds time until staff responds or releases it.</p>
                    </div>
                  )}
                  <div className="detail-section">
                    <h4>Reservation Window</h4>
                    <p>
                      {formatDateLabel(selected.date)} · {formatTimeRange(selected.date, selected.time, selected.end_time)}
                    </p>
                    {selected.status === 'pending_confirmation' && (
                      <p className="muted small-text">
                        Hold auto-expires{' '}
                        {renderHoldExpiry(selected.created_at, scheduleSettings?.booking_pending_expire_hours)}
                      </p>
                    )}
                  </div>
                  {['pending_confirmation', 'confirmed'].includes(selected.status) && editForm && (
                    <div className="detail-section">
                      <h4>Edit Appointment</h4>
                      <div className="form-grid">
                        <label>
                          Date
                          <input type="date" value={editForm.date} onChange={(event) => updateEditField('date', event.target.value)} />
                        </label>
                        <label>
                          Time
                          <input type="time" value={editForm.time} onChange={(event) => updateEditField('time', event.target.value)} />
                        </label>
                        <label>
                          Duration minutes
                          <input type="number" min="15" step="15" value={editForm.duration_minutes} onChange={(event) => updateEditField('duration_minutes', event.target.value)} />
                        </label>
                        <label>
                          Owner name
                          <input value={editForm.owner_name} onChange={(event) => updateEditField('owner_name', event.target.value)} />
                        </label>
                        <label>
                          Email
                          <input type="email" value={editForm.email} onChange={(event) => updateEditField('email', event.target.value)} />
                        </label>
                        <label>
                          Phone
                          <input type="tel" value={editForm.phone} onChange={(event) => updateEditField('phone', event.target.value)} />
                        </label>
                        <label>
                          Vet name
                          <input value={editForm.vet_name} onChange={(event) => updateEditField('vet_name', event.target.value)} />
                        </label>
                        <label>
                          Vet phone
                          <input type="tel" value={editForm.vet_phone} onChange={(event) => updateEditField('vet_phone', event.target.value)} />
                        </label>
                      </div>
                      <label style={{ display: 'block', marginTop: '0.75rem' }}>
                        Customer request notes
                        <textarea value={editForm.request_notes} onChange={(event) => updateEditField('request_notes', event.target.value)} rows={3} />
                      </label>
                      <label style={{ display: 'block', marginTop: '0.75rem' }}>
                        Paperwork notes
                        <textarea value={editForm.paperwork_notes} onChange={(event) => updateEditField('paperwork_notes', event.target.value)} rows={3} />
                      </label>
                      <div className="detail-actions detail-actions--secondary">
                        <button className="btn btn-tertiary" type="button" onClick={saveBookingDetails} disabled={!editDirty}>
                          Save appointment details
                        </button>
                        {editDirty && <span className="small-text muted">Unsaved appointment changes</span>}
                      </div>
                    </div>
                  )}
                  <div className="detail-grid">
                    <div>
                      <h4>Contact</h4>
                      <p>{selected.email}</p>
                      <p>{selected.phone}</p>
                      <p className="muted small-text">{selected.vet_name || 'Vet not provided'}</p>
                      {selected.vet_phone && <p className="muted small-text">{selected.vet_phone}</p>}
                    </div>
                    <div>
                      <h4>Dog Details</h4>
                      {(selected.pets || []).length > 0 ? (
                        <div className="stack gap-sm">
                          {selected.pets.map((pet, index) => (
                            <div key={`${pet.pet_name}-${index}`} className="inline-note">
                              <strong>{pet.pet_name}</strong>
                              <p className="muted small-text">
                                {[pet.breed, pet.approximate_weight].filter(Boolean).join(' · ') || 'Breed/weight not provided'}
                              </p>
                              {(pet.temperament_notes || pet.medical_or_grooming_notes) && (
                                <p className="muted small-text">
                                  {[pet.temperament_notes, pet.medical_or_grooming_notes].filter(Boolean).join(' | ')}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
                          <p>{selected.dog_name || 'Not provided'}</p>
                          <p className="muted">{selected.dog_notes || 'No intake notes provided'}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="detail-section">
                    <h4>Requested Services</h4>
                    <ul>
                      {(selected.service_names || parseServices(selected.services_json)).map((service, index) => (
                        <li key={index}>{service}</li>
                      ))}
                      {(selected.service_names || parseServices(selected.services_json)).length === 0 && <li>Not specified</li>}
                    </ul>
                  </div>
                  <div className="detail-grid">
                    <div>
                      <h4>Customer Notes</h4>
                      <p className="muted">{selected.request_notes || 'No intake notes provided.'}</p>
                    </div>
                    <div>
                      <h4>Paperwork</h4>
                      <p className="muted">{selected.paperwork_notes || 'No paperwork notes provided.'}</p>
                      {(selected.paperwork_attachments || []).length > 0 ? (
                        <div className="stack gap-sm">
                          {selected.paperwork_attachments.map((attachment) => (
                            <a
                              key={attachment.id}
                              href={`/api/admin/booking-requests/${selected.id}/attachments/${attachment.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="link-chip"
                            >
                              {attachment.original_name}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="muted small-text">No uploaded paperwork.</p>
                      )}
                    </div>
                  </div>
                  <div className="detail-section">
                    <h4>Admin Notes</h4>
                    <textarea
                      value={notes}
                      onChange={(e) => {
                        setNotes(e.target.value);
                        setNotesDirty(true);
                      }}
                      placeholder="Add internal notes or follow-up reminders..."
                    />
                    <div className="detail-actions detail-actions--secondary">
                      <button className="btn btn-tertiary" type="button" onClick={saveNotes} disabled={!notesDirty}>
                        Save notes
                      </button>
                      {notesDirty && <span className="small-text muted">Unsaved note changes</span>}
                    </div>
                  </div>
                  {selected.status === 'pending_confirmation' && (
                    <div className="detail-section">
                      <h4>Hold Controls</h4>
                      <div className="detail-actions detail-actions--secondary">
                        <button className="btn btn-tertiary" onClick={extendHold}>
                          Extend hold +24h
                        </button>
                        <button className="btn btn-link danger" onClick={releaseHold}>
                          Release hold
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="detail-actions">
                    {['pending_confirmation'].includes(selected.status) && !selected.is_internal_test && (
                      <>
                        <button className="btn btn-tertiary" type="button" onClick={() => previewCustomerEmail('confirm')} disabled={previewLoading}>
                          Approval email preview
                        </button>
                        <button className="btn btn-tertiary" type="button" onClick={() => previewCustomerEmail('decline')} disabled={previewLoading}>
                          Rejection email preview
                        </button>
                      </>
                    )}
                    {getBookingActions(selected.status).map((action) => (
                      <button
                        key={action.key}
                        className={`btn ${action.className}`}
                        type="button"
                        onClick={() => performAction(action.key)}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                  {emailPreview && (
                    <div className="detail-section email-preview-panel">
                      <div className="booking-card__header">
                        <h4>{emailPreview.template === 'decline' ? 'Decline' : 'Confirm'} Email Preview</h4>
                        <span className="small-text muted">Not sent yet</span>
                      </div>
                      <p className="small-text"><strong>Subject:</strong> {emailPreview.subject}</p>
                      <div className="rich-preview" dangerouslySetInnerHTML={{ __html: emailPreview.html || '' }} />
                    </div>
                  )}
                  {feedback && <p className={`save-feedback ${feedback.tone === 'error' ? 'is-error' : 'is-success'}`}>{feedback.message}</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </ManualBookingLauncher>
  );
}

function createBookingEditForm(request) {
  return {
    date: request?.date || '',
    time: String(request?.time || '').slice(0, 5),
    duration_minutes: request?.total_duration_minutes || 30,
    owner_name: request?.owner_name || request?.customer_name || '',
    email: request?.email || '',
    phone: request?.phone || '',
    vet_name: request?.vet_name || '',
    vet_phone: request?.vet_phone || '',
    request_notes: request?.request_notes || '',
    paperwork_notes: request?.paperwork_notes || '',
    admin_notes: request?.admin_notes || '',
  };
}

function bookingActionPrompt(request, action) {
  if (action === 'confirm') {
    return request.is_internal_test
      ? 'Confirm this test? No email or calendar event will be created.'
      : 'Confirm this booking and notify the customer?';
  }
  if (action === 'decline') {
    return request.is_internal_test ? 'Decline this test? No customer email will be sent.' : 'Decline this booking request?';
  }
  return {
    cancel: 'Cancel this booking?',
    complete: 'Mark this booking as completed?',
  }[action];
}
