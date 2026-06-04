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

export function BookingRequestsPage() {
  const confirm = useAdminConfirm();
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({});
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [scheduleSettings, setScheduleSettings] = useState(null);
  const dialogTitleId = useId();

  const load = useCallback(async () => {
    const response = await api.get('/booking-requests', { params: { status: statusFilter || undefined } });
    setItems(response.data.data.items);
    setStats(response.data.data.stats);
  }, [statusFilter]);

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
      return;
    }

    setSelected(null);
    setNotes('');
    setNotesDirty(false);
  }, [items, notesDirty, selected]);

  const openDetails = (request) => {
    setFeedback(null);
    setSelected(request);
    setNotes(request.admin_notes || '');
    setNotesDirty(false);
  };

  const closeDetails = () => {
    setSelected(null);
    setFeedback(null);
    setNotesDirty(false);
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
      setFeedback({ tone: 'success', message: 'Internal notes saved.' });
    } catch (err) {
      setFeedback({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to save notes.' });
    }
  };

  const performAction = async (action) => {
    if (!selected) return;
    const prompts = {
      confirm: 'Confirm this booking and notify the customer?',
      decline: 'Decline this booking request?',
      cancel: 'Cancel this booking?',
      complete: 'Mark this booking as completed?',
    };
    if (!(await confirm({ message: prompts[action], confirmLabel: 'Continue', tone: 'danger' }))) {
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
      setFeedback({ tone: 'success', message: labels[action] || 'Booking updated.' });
      setTimeout(() => setFeedback(null), 2500);
      load();
    } catch (err) {
      setFeedback({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to update booking.' });
    }
  };

  const extendHold = async () => {
    if (!selected) return;
    try {
      const response = await api.post('/booking-requests/extend', { id: selected.id });
      const updated = response.data.data;
      setSelected(updated);
      setNotes(updated.admin_notes || '');
      setNotesDirty(false);
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
      load();
      setFeedback({ tone: 'success', message: 'Hold released.' });
    } catch (err) {
      setFeedback({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to release hold.' });
    }
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
              <button className="btn" onClick={() => openManual()}>
                Create Manual Reservation
              </button>
              <button className="btn btn-tertiary" onClick={load}>
                Refresh
              </button>
            </div>
          </div>
          <div className="booking-layout booking-layout--queue">
            <div className="booking-column">
              <div className="card">
                <label className="field-label">Filter by status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
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
                      <button className="btn btn-tertiary" type="button">
                        Open request
                      </button>
                    </article>
                  );
                })}
                {items.length === 0 && <div className="card">No booking requests found.</div>}
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
                    <p className="muted small-text">Review request #{selected.id}, manage notes, and confirm or decline from one place.</p>
                  </div>
                  <button type="button" className="btn btn-link" onClick={closeDetails}>
                    Close
                  </button>
                </div>

                <div className="booking-detail__content">
                  <h2>{selected.customer_name}</h2>
                  <p className="muted small-text">Request #{selected.id}</p>
                  <StatusBadge status={selected.status} />
                  {selected.status === 'pending_confirmation' && (
                    <div className="inline-note booking-detail__notice">
                      <strong>Pending review</strong>
                      <p className="muted small-text">This request is still holding availability until staff confirms, declines, or releases it.</p>
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
                      placeholder="Add internal notes, confirmation details, or follow-up reminders..."
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
