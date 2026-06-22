import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdminConfirm } from '../ConfirmProvider';
import { api, useAuth } from '../AdminShell';
import { buildScheduleTimeOptions, formatScheduleTime, minutesToScheduleValue, normalizeAdminTimeInput, sortScheduleTimes, timeValueToMinutes, toggleScheduleTime } from '../scheduleTime';

export const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function SchedulePage() {
  const { user } = useAuth();
  const confirm = useAdminConfirm();

  // Schedule editor state
  const [templates, setTemplates] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [settings, setSettings] = useState({
    booking_hold_minutes: 1440,
    booking_pending_expire_hours: 24,
    booking_pause_enabled: false,
    booking_pause_message: 'Online appointment times are paused right now. Please call or send a message and we will help find a safe appointment time.',
  });
  const [timeDrafts, setTimeDrafts] = useState({});
  const [overrideTimeDraft, setOverrideTimeDraft] = useState('');
  const [overrideForm, setOverrideForm] = useState({ id: null, date: '', is_closed: false, times: [] });
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [builder, setBuilder] = useState({ start: '09:00', end: '17:00', weekdays: [1, 2, 3, 4, 5], replaceExisting: true });
  const [feedback, setFeedback] = useState(null);
  const timeOptions = useMemo(() => buildScheduleTimeOptions(slotMinutes), [slotMinutes]);

  // Schedule data hydration
  const load = useCallback(async () => {
    const [tpl, ov] = await Promise.all([api.get('/schedule/templates'), api.get('/schedule/overrides')]);
    const templateRows = tpl.data.data.templates || [];
    const normalized = Array.from({ length: 7 }, (_, weekday) => {
      const match = templateRows.find((template) => Number(template.weekday) === weekday);
      if (match) {
        return {
          weekday,
          is_enabled: Number(match.is_enabled ?? 1),
          times: sortScheduleTimes(JSON.parse(match.times_json || '[]')),
        };
      }
      return {
        weekday,
        is_enabled: 0,
        times: [],
      };
    });
    setTemplates(normalized);
    setSettings(tpl.data.data.settings);
    setSlotMinutes(tpl.data.data.slot_minutes ?? 30);
    setOverrides(ov.data.data.overrides);
    setFeedback(null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Slot builder workflow
  const toggleBuilderDay = (weekday) => {
    setBuilder((prev) => {
      const exists = prev.weekdays.includes(weekday);
      return {
        ...prev,
        weekdays: exists ? prev.weekdays.filter((day) => day !== weekday) : [...prev.weekdays, weekday].sort(),
      };
    });
  };

  const buildBlocks = useCallback(() => {
    const startMinutes = timeValueToMinutes(builder.start);
    const endMinutes = timeValueToMinutes(builder.end);
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      return [];
    }

    const blocks = [];
    let cursor = startMinutes;
    while (cursor < endMinutes) {
      blocks.push(minutesToScheduleValue(cursor));
      cursor += slotMinutes;
    }
    return Array.from(new Set(blocks));
  }, [builder.end, builder.start, slotMinutes]);

  const applyBuilder = () => {
    const generated = buildBlocks();
    if (!generated.length) {
      setFeedback({ tone: 'error', message: 'Enter a valid start/end time to generate slots.' });
      return;
    }
    if (builder.weekdays.length === 0) {
      setFeedback({ tone: 'error', message: 'Select at least one weekday.' });
      return;
    }
    setTemplates((prev) =>
      prev.map((tpl) => {
        if (!builder.weekdays.includes(tpl.weekday)) {
          return tpl;
        }
        const nextTimes = builder.replaceExisting
          ? generated
          : sortScheduleTimes([...(tpl.times || []), ...generated]);
        return { ...tpl, times: nextTimes };
      }),
    );
    setFeedback({ tone: 'success', message: `Generated ${generated.length} time button${generated.length === 1 ? '' : 's'} for the selected weekdays.` });
  };

  const updateTemplateTimes = (weekday, nextTimes) => {
    setTemplates((prev) =>
      prev.map((tpl) => (tpl.weekday === weekday ? { ...tpl, times: sortScheduleTimes(nextTimes) } : tpl)),
    );
  };

  const addTime = (weekday) => {
    const draft = (timeDrafts[weekday] || '').trim();
    if (!draft) return;
    const times = templates.find((tpl) => tpl.weekday === weekday)?.times || [];
    const normalized = normalizeAdminTimeInput(draft);
    if (!normalized) {
      setFeedback({ tone: 'error', message: `Could not understand "${draft}". Try 1100, 11:30am, or 2pm.` });
      return;
    }

    updateTemplateTimes(weekday, [...times, normalized]);
    setTimeDrafts((prev) => ({ ...prev, [weekday]: '' }));
    setFeedback({ tone: 'success', message: `${WEEKDAY_LABELS[weekday]} now includes ${formatScheduleTime(normalized)}.` });
  };

  const removeTime = (weekday, time) => {
    const times = templates.find((tpl) => tpl.weekday === weekday)?.times || [];
    updateTemplateTimes(
      weekday,
      times.filter((value) => value !== time),
    );
  };

  // Template persistence workflow
  const toggleTemplateTime = (weekday, time) => {
    const times = templates.find((tpl) => tpl.weekday === weekday)?.times || [];
    updateTemplateTimes(weekday, toggleScheduleTime(times, time));
  };

  const saveTemplates = async () => {
    try {
      await api.post('/schedule/templates', {
        templates: templates.map((template) => ({
          weekday: template.weekday,
          times: template.times,
          is_enabled: template.is_enabled,
        })),
        settings,
      });
      setFeedback({ tone: 'success', message: 'Schedule saved.' });
      load();
    } catch (error) {
      setFeedback({ tone: 'error', message: error.response?.data?.error?.message || 'Unable to save the schedule right now.' });
    }
  };

  // Override management boundary
  const submitOverride = async (e) => {
    e.preventDefault();
    try {
      await api.post('/schedule/overrides', {
        date: overrideForm.date,
        is_closed: overrideForm.is_closed ? 1 : 0,
        times: overrideForm.is_closed ? [] : overrideForm.times,
      });
      setOverrideForm({ id: null, date: '', is_closed: false, times: [] });
      setOverrideTimeDraft('');
      setFeedback({ tone: 'success', message: 'Date override saved.' });
      load();
    } catch (error) {
      setFeedback({ tone: 'error', message: error.response?.data?.error?.message || 'Unable to save that date override.' });
    }
  };

  const editOverride = (override) => {
    setOverrideForm({
      id: override.id,
      date: override.date,
      is_closed: Boolean(override.is_closed),
      times: sortScheduleTimes(JSON.parse(override.times_json || '[]') || []),
    });
    setOverrideTimeDraft('');
  };

  const deleteOverride = async (id) => {
    if (!(await confirm({ message: 'Delete this override?', confirmLabel: 'Delete', tone: 'danger' }))) return;
    await api.delete(`/schedule/overrides/${id}`);
    load();
  };

  const canDeleteOverride = user?.role === 'super_admin';
  const hasVisibleSlots = templates.some((template) => (template.is_enabled === 1 || template.is_enabled === true) && (template.times || []).length > 0);
  const bookingSafety = settings.booking_pause_enabled
    ? {
        tone: 'warning',
        title: 'Online time selection is paused',
        message: 'Customers can still read the booking section, but appointment times are hidden and routed to contact.',
      }
    : hasVisibleSlots
      ? {
          tone: 'success',
          title: 'Booking time selection is ready',
          message: 'Public booking can show time buttons based on active services and the schedule.',
        }
      : {
          tone: 'error',
          title: 'No public booking times are available',
          message: 'Add enabled weekday times or keep vacation mode on so customers are routed to contact.',
        };

  // Schedule editor surface
  const addOverrideTime = () => {
    const normalized = normalizeAdminTimeInput(overrideTimeDraft);
    if (!normalized) {
      setFeedback({ tone: 'error', message: `Could not understand "${overrideTimeDraft}". Try 1100, 11:30am, or 2pm.` });
      return;
    }

    setOverrideForm((prev) => ({ ...prev, times: sortScheduleTimes([...(prev.times || []), normalized]) }));
    setOverrideTimeDraft('');
    setFeedback({ tone: 'success', message: `Override now includes ${formatScheduleTime(normalized)}.` });
  };

  const toggleOverrideTime = (time) => {
    setOverrideForm((prev) => ({ ...prev, times: toggleScheduleTime(prev.times || [], time) }));
  };

  return (
    <div>
      <h1>Schedule Setup</h1>
      {feedback && <p className={`save-feedback ${feedback.tone === 'error' ? 'is-error' : 'is-success'}`}>{feedback.message}</p>}
      <div className={`card booking-safety-card booking-safety-card--${bookingSafety.tone}`}>
        <div className="booking-card__header">
          <div>
            <h3>Booking safety preview</h3>
            <p className="muted">{bookingSafety.title}</p>
          </div>
          <span className={`status-pill status-pill--${bookingSafety.tone}`}>{bookingSafety.tone === 'success' ? 'Safe' : 'Needs attention'}</span>
        </div>
        <p className="muted small-text">{bookingSafety.message}</p>
      </div>
      <div className="card">
        <h3>Business Closed / Vacation Mode</h3>
        <p className="muted">Use this when the shop is closed, the calendar is being repaired, or staff wants requests to come through contact instead of time buttons.</p>
        <label className="toggle">
          <input
            type="checkbox"
            checked={Boolean(settings.booking_pause_enabled)}
            onChange={(event) => setSettings((prev) => ({ ...prev, booking_pause_enabled: event.target.checked }))}
          />{' '}
          Hide online appointment times and show contact fallback
        </label>
        <label className="field-block" style={{ marginTop: '0.75rem' }}>
          <span className="field-label">Fallback message customers see</span>
          <textarea
            value={settings.booking_pause_message || ''}
            onChange={(event) => setSettings((prev) => ({ ...prev, booking_pause_message: event.target.value }))}
            rows={3}
          />
        </label>
        <button className="btn btn-tertiary" type="button" onClick={saveTemplates}>
          Save Vacation Mode
        </button>
      </div>
      <div className="card">
        <h3>Standard Schedule Builder</h3>
        <p className="muted">Generate {slotMinutes}-minute time buttons and apply them to multiple weekdays at once.</p>
        <div className="builder-grid">
          <label className="field-block">
            <span className="field-label">Start time</span>
            <input type="time" value={builder.start} onChange={(e) => setBuilder((prev) => ({ ...prev, start: e.target.value }))} />
          </label>
          <label className="field-block">
            <span className="field-label">End time</span>
            <input type="time" value={builder.end} onChange={(e) => setBuilder((prev) => ({ ...prev, end: e.target.value }))} />
          </label>
        </div>
        <div className="chip-row">
          {WEEKDAY_LABELS.map((label, idx) => (
            <button
              key={label}
              type="button"
              className={`chip ${builder.weekdays.includes(idx) ? 'is-active' : ''}`}
              onClick={() => toggleBuilderDay(idx)}
            >
              {label.slice(0, 3)}
            </button>
          ))}
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={builder.replaceExisting}
            onChange={(e) => setBuilder((prev) => ({ ...prev, replaceExisting: e.target.checked }))}
          />{' '}
          Replace existing times (otherwise new slots are appended)
        </label>
        <button className="btn btn-tertiary" style={{ marginTop: '0.75rem' }} onClick={applyBuilder}>
          Apply generated schedule
        </button>
      </div>
      <div className="card">
        <h3>Weekday Templates</h3>
        <p className="muted">Click time buttons to toggle each day’s availability. Typed entries are normalized automatically, so 1100 becomes 11:00 AM.</p>
        <div className="stack gap-md">
          {templates.map((tpl) => (
            <div key={tpl.weekday} className="template-row">
              <div className="template-row__header">
                <strong>{WEEKDAY_LABELS[tpl.weekday]}</strong>
                <label>
                  <input
                    type="checkbox"
                    checked={tpl.is_enabled === 1 || tpl.is_enabled === true}
                    onChange={(e) =>
                      setTemplates((prev) =>
                        prev.map((item) => (item.weekday === tpl.weekday ? { ...item, is_enabled: e.target.checked ? 1 : 0 } : item)),
                      )
                    }
                  />{' '}
                  Enabled
                </label>
              </div>
              <div className="time-chip-row">
                {tpl.times?.map((time) => (
                  <button key={time} type="button" className="time-chip" onClick={() => removeTime(tpl.weekday, time)}>
                    {formatScheduleTime(time)} ×
                  </button>
                ))}
                {(tpl.times?.length ?? 0) === 0 && <span className="muted small-text">No appointment times added</span>}
              </div>
              <div className="time-option-grid">
                {timeOptions.map((time) => (
                  <button
                    key={`${tpl.weekday}-${time}`}
                    type="button"
                    className={`time-chip ${tpl.times?.includes(time) ? 'is-selected' : ''}`}
                    onClick={() => toggleTemplateTime(tpl.weekday, time)}
                  >
                    {formatScheduleTime(time)}
                  </button>
                ))}
              </div>
              <div className="time-add-row">
                <input
                  placeholder="Type 1100, 11:30am, or 2pm"
                  value={timeDrafts[tpl.weekday] || ''}
                  onChange={(e) => setTimeDrafts((prev) => ({ ...prev, [tpl.weekday]: e.target.value }))}
                />
                <button type="button" className="btn btn-tertiary" onClick={() => addTime(tpl.weekday)}>
                  Add custom time
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="settings-grid">
          <div>
            <label className="field-label">Hold window (minutes)</label>
            <input
              type="number"
              min="5"
              max="1440"
              value={settings.booking_hold_minutes ?? 1440}
              onChange={(e) => setSettings((prev) => ({ ...prev, booking_hold_minutes: e.target.value }))}
            />
            <p className="muted small-text">Prevents double-booking while guests submit the request.</p>
          </div>
          <div>
            <label className="field-label">Auto-expire pending (hours)</label>
            <input
              type="number"
              min="0"
              max="72"
              value={settings.booking_pending_expire_hours ?? 24}
              onChange={(e) => setSettings((prev) => ({ ...prev, booking_pending_expire_hours: e.target.value }))}
            />
            <p className="muted small-text">Pending requests older than this will be marked as expired.</p>
          </div>
        </div>
        <button className="btn" onClick={saveTemplates}>
          Save Schedule
        </button>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3>Date Overrides</h3>
        <p className="muted">Close a specific date for emergencies or holidays, or assign a one-off schedule without editing the whole weekday template.</p>
        <form onSubmit={submitOverride} className="override-form">
          <input type="date" value={overrideForm.date} onChange={(e) => setOverrideForm((prev) => ({ ...prev, date: e.target.value }))} required />
          <label>
            <input type="checkbox" checked={overrideForm.is_closed} onChange={(e) => setOverrideForm((prev) => ({ ...prev, is_closed: e.target.checked }))} /> Closed
          </label>
          <button className="btn">{overrideForm.id ? 'Update override' : 'Save override'}</button>
        </form>
        {!overrideForm.is_closed && (
          <div className="override-editor">
            <div className="time-chip-row">
              {(overrideForm.times || []).map((time) => (
                <button key={time} type="button" className="time-chip" onClick={() => toggleOverrideTime(time)}>
                  {formatScheduleTime(time)} ×
                </button>
              ))}
              {(overrideForm.times?.length ?? 0) === 0 && <span className="muted small-text">No appointment times selected</span>}
            </div>
            <div className="time-option-grid">
              {timeOptions.map((time) => (
                <button
                  key={`override-${time}`}
                  type="button"
                  className={`time-chip ${overrideForm.times?.includes(time) ? 'is-selected' : ''}`}
                  onClick={() => toggleOverrideTime(time)}
                >
                  {formatScheduleTime(time)}
                </button>
              ))}
            </div>
            <div className="time-add-row">
              <input placeholder="Type 1100, 11:30am, or 2pm" value={overrideTimeDraft} onChange={(e) => setOverrideTimeDraft(e.target.value)} />
              <button type="button" className="btn btn-tertiary" onClick={addOverrideTime}>
                Add custom time
              </button>
            </div>
          </div>
        )}
        <div className="override-table">
          {overrides.map((override) => {
            const displayTimes = sortScheduleTimes(JSON.parse(override.times_json || '[]') || []).map(formatScheduleTime).join(', ');
            return (
              <div key={override.id} className="override-row">
                <div>
                  <strong>{override.date}</strong>
                  <p className="muted">{override.is_closed ? 'Closed' : displayTimes || 'Default schedule'}</p>
                </div>
                <div className="override-actions">
                  <button type="button" className="btn btn-link" onClick={() => editOverride(override)}>
                    Edit
                  </button>
                  {canDeleteOverride && (
                    <button type="button" className="btn btn-link danger" onClick={() => deleteOverride(override.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {overrides.length === 0 && <p className="muted">No overrides scheduled.</p>}
        </div>
      </div>
    </div>
  );
}
