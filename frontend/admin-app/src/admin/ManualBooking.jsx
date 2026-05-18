import { useEffect, useId, useState } from 'react';
import axios from 'axios';
import { api } from './AdminShell';
import { buildServiceList, todayString } from './formatters';

export function ManualBookingLauncher({ children, onCreated, scheduleSettings }) {
  const [isOpen, setIsOpen] = useState(false);
  const [defaults, setDefaults] = useState({ date: todayString(), time: '' });

  const openModal = (options = {}) => {
    setDefaults({
      date: options.date || todayString(),
      time: options.time || '',
    });
    setIsOpen(true);
  };

  const closeModal = () => setIsOpen(false);

  return (
    <>
      {typeof children === 'function' ? children(openModal) : children}
      {isOpen && (
        <ManualBookingModal
          defaults={defaults}
          onClose={closeModal}
          onCreated={() => {
            onCreated?.();
            closeModal();
          }}
          scheduleSettings={scheduleSettings}
        />
      )}
    </>
  );
}

function ManualBookingModal({ defaults, onClose, onCreated, scheduleSettings }) {
  const createInitialForm = () => ({
    date: defaults?.date || todayString(),
    time: defaults?.time || '',
    duration_blocks: 1,
    customer_name: '',
    email: '',
    phone: '',
    dog_name: '',
    dog_notes: '',
    services_input: '',
    admin_notes: '',
    auto_confirm: false,
  });

  const [form, setForm] = useState(createInitialForm);
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState(scheduleSettings ?? null);
  const dialogTitleId = useId();

  useEffect(() => {
    setForm(createInitialForm());
    setStatus(null);
  }, [defaults]);

  useEffect(() => {
    if (!settings) {
      api.get('/schedule/templates').then((response) => setSettings(response.data.data.settings));
    }
  }, [settings]);

  useEffect(() => {
    let ignore = false;
    const loadAvailability = async () => {
      setLoading(true);
      try {
        const response = await axios.get('/api/public/schedule', { params: { date: form.date } });
        if (!ignore) {
          setAvailability(response.data.data.availability);
        }
      } catch (err) {
        if (!ignore) {
          setAvailability([]);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };
    loadAvailability();
    return () => {
      ignore = true;
    };
  }, [form.date]);

  const holdMinutes = Number(settings?.booking_hold_minutes ?? 30);
  const holdWindowLabel = holdMinutes >= 60 ? `${Math.ceil(holdMinutes / 60)} hour${Math.ceil(holdMinutes / 60) === 1 ? '' : 's'}` : `${holdMinutes} minutes`;

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setStatus(null);
    if (!form.time) {
      setStatus('Select an available time or enter a manual time.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/booking-requests', {
        date: form.date,
        time: form.time,
        duration_blocks: Number(form.duration_blocks) || 1,
        customer_name: form.customer_name,
        phone: form.phone,
        email: form.email,
        dog_name: form.dog_name || undefined,
        dog_notes: form.dog_notes || undefined,
        services: buildServiceList(form.services_input),
        admin_notes: form.admin_notes || undefined,
        auto_confirm: form.auto_confirm ? 1 : 0,
      });
      onCreated?.();
    } catch (err) {
      setStatus(err.response?.data?.error?.message ?? 'Unable to save reservation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal" role="presentation">
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__content manual-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={dialogTitleId}>
        <div className="modal__header">
          <div>
            <h3 id={dialogTitleId}>Create Manual Reservation</h3>
            <p className="muted small-text">Holds the selected slot for {holdWindowLabel} while you follow up.</p>
          </div>
          <button type="button" className="btn btn-link" onClick={onClose}>
            Close
          </button>
        </div>
        <form className="manual-form" onSubmit={submit}>
          <div className="manual-form-grid">
            <label className="field-block">
              <span className="field-label">Date</span>
              <input type="date" value={form.date} onChange={(e) => updateForm('date', e.target.value)} required />
            </label>
            <label className="field-block">
              <span className="field-label">Manual time override</span>
              <input value={form.time} onChange={(e) => updateForm('time', e.target.value)} placeholder="HH:MM" />
            </label>
            <label className="field-block">
              <span className="field-label">Duration (30-min blocks)</span>
              <input
                type="number"
                min="1"
                value={form.duration_blocks}
                onChange={(e) => updateForm('duration_blocks', e.target.value)}
              />
            </label>
            <label className="field-block">
              <span className="field-label">Customer name</span>
              <input value={form.customer_name} onChange={(e) => updateForm('customer_name', e.target.value)} required />
            </label>
            <label className="field-block">
              <span className="field-label">Email</span>
              <input type="email" value={form.email} onChange={(e) => updateForm('email', e.target.value)} required />
            </label>
            <label className="field-block">
              <span className="field-label">Phone</span>
              <input value={form.phone} onChange={(e) => updateForm('phone', e.target.value)} required />
            </label>
          </div>

          <div className="availability-panel">
            <span className="field-label">Available times</span>
            {loading && <p className="muted small-text">Loading availability…</p>}
            {!loading && availability.length === 0 && <p className="muted small-text">No published times for this date.</p>}
            <div className="availability-grid">
              {availability.map((slot) => (
                <button
                  key={slot.time}
                  type="button"
                  className={`time-chip ${form.time === slot.time ? 'is-selected' : ''}`}
                  onClick={() => updateForm('time', slot.time)}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </div>

          <div className="manual-form-grid">
            <label className="field-block">
              <span className="field-label">Dog name</span>
              <input value={form.dog_name} onChange={(e) => updateForm('dog_name', e.target.value)} required />
            </label>
            <label className="field-block">
              <span className="field-label">Dog notes</span>
              <textarea value={form.dog_notes} onChange={(e) => updateForm('dog_notes', e.target.value)} />
            </label>
            <label className="field-block">
              <span className="field-label">Services (one per line)</span>
              <textarea
                value={form.services_input}
                onChange={(e) => updateForm('services_input', e.target.value)}
                placeholder="Grooming\nSpa bath"
              />
            </label>
            <label className="field-block">
              <span className="field-label">Internal notes</span>
              <textarea value={form.admin_notes} onChange={(e) => updateForm('admin_notes', e.target.value)} />
            </label>
          </div>

          <label className="toggle" style={{ marginTop: '0.5rem' }}>
            <input type="checkbox" checked={form.auto_confirm} onChange={(e) => updateForm('auto_confirm', e.target.checked)} /> Auto-confirm immediately
          </label>

          <div className="form-actions">
            <button className="btn" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save reservation'}
            </button>
            <button type="button" className="btn btn-link" onClick={onClose}>
              Cancel
            </button>
          </div>
          {status && <p role="status" className="muted small-text">{status}</p>}
        </form>
      </div>
    </div>
  );
}
