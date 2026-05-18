import { useCallback, useEffect, useState } from 'react';
import { api } from '../admin/AdminShell';
import { useAdminConfirm } from '../admin/ConfirmProvider';
import { createCalendarIntegrationForm, humanizeCalendarConnectionStatus } from '../admin/calendarSyncDefaults';

export function CalendarSyncPage() {
  const confirm = useAdminConfirm();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState(createCalendarIntegrationForm());

  const load = useCallback(async () => {
    const response = await api.get('/calendar-integrations');
    setData(response.data.data);
    setError(null);
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err.response?.data?.error?.message ?? err.message));
  }, [load]);

  const resetForm = () => {
    const defaultProvider = data?.providers?.[0]?.key || 'google';
    setForm(createCalendarIntegrationForm(defaultProvider));
    setStatus(null);
  };

  const save = async (event) => {
    event.preventDefault();
    try {
      const response = await api.post('/calendar-integrations', form);
      const saved = response.data.data;
      setStatus({ tone: 'success', message: `${saved.label} saved.` });
      await load();
      setForm(createCalendarIntegrationForm(saved.provider || data?.providers?.[0]?.key || 'google'));
    } catch (err) {
      setStatus({
        tone: 'error',
        message: err.response?.data?.error?.message ?? err.message,
      });
    }
  };

  const edit = (item) => {
    setForm({
      id: item.id,
      provider: item.provider,
      label: item.label || '',
      target_calendar_name: item.target_calendar_name || '',
      target_calendar_reference: item.target_calendar_reference || '',
      notes: item.notes || '',
      is_enabled: Boolean(item.is_enabled),
      sync_confirmed_bookings: Boolean(item.sync_confirmed_bookings),
    });
    setStatus(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const destroy = async (id) => {
    if (!(await confirm({
      message: 'Delete this calendar integration slot? Existing sync history for that slot will be removed too.',
      confirmLabel: 'Delete slot',
      tone: 'danger',
    }))) {
      return;
    }

    try {
      await api.delete(`/calendar-integrations/${id}`);
      setStatus({ tone: 'success', message: 'Calendar integration deleted.' });
      if (form.id === id) {
        resetForm();
      }
      await load();
    } catch (err) {
      setStatus({
        tone: 'error',
        message: err.response?.data?.error?.message ?? err.message,
      });
    }
  };

  if (error && !data) {
    return <div className="card">{error}</div>;
  }

  if (!data) {
    return <div className="card">Loading calendar prep foundation…</div>;
  }

  const providerLookup = Object.fromEntries((data.providers ?? []).map((provider) => [provider.key, provider]));
  const selectedProvider = providerLookup[form.provider] || data.providers?.[0] || null;
  const editingIntegration = form.id ? (data.integrations ?? []).find((item) => item.id === form.id) : null;

  return (
    <div>
      <h1>Calendar Prep</h1>
      <p>Internal pre-launch setup only. This stores future Google, Microsoft, or Apple sync targets and reserves the booking lifecycle hooks needed to sync confirmed appointments later.</p>
      {error ? <div className="card" style={{ marginBottom: '1rem' }}>{error}</div> : null}

      <div className="card">
        <h3>Current foundation</h3>
        <p>Calendar sync enabled: {data.config?.enabled ? 'Yes' : 'No'}</p>
        <p>Default timezone: {data.config?.default_timezone || 'Not set'}</p>
        <p>Max job attempts: {data.config?.max_job_attempts ?? 0}</p>
        <p className="muted">No provider-specific OAuth or event-writing code is active yet. Enabling a slot here will not create calendar events until a provider implementation is added and connected.</p>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3>Supported provider slots</h3>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {(data.providers ?? []).map((provider) => (
            <div key={provider.key} style={{ border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'baseline' }}>
                <strong>{provider.label}</strong>
                <span className="small-text muted">{provider.implementation_status === 'foundation_only' ? 'Foundation only' : provider.implementation_status}</span>
              </div>
              <p style={{ margin: '0.5rem 0 0.25rem' }}>{provider.summary}</p>
              <p className="muted small-text" style={{ margin: 0 }}>Planned auth: {provider.planned_auth_strategy}</p>
              <p className="muted small-text" style={{ margin: '0.25rem 0 0' }}>{provider.future_notes}</p>
            </div>
          ))}
        </div>
      </div>

      <form className="card" style={{ marginTop: '1rem' }} onSubmit={save}>
        <h3>{form.id ? 'Edit integration slot' : 'Add integration slot'}</h3>
        <p className="muted">You can store multiple targets here now, then connect one or more of them later when we implement the real provider.</p>
        <div className="form-grid">
          <label>
            Provider
            <select value={form.provider} onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))}>
              {(data.providers ?? []).map((provider) => (
                <option key={provider.key} value={provider.key}>{provider.label}</option>
              ))}
            </select>
          </label>
          <label>
            Label
            <input value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} placeholder="Front desk calendar" />
          </label>
          <label>
            Target calendar name
            <input value={form.target_calendar_name} onChange={(event) => setForm((current) => ({ ...current, target_calendar_name: event.target.value }))} placeholder="Grooming confirmations" />
          </label>
          <label>
            Future target reference
            <input value={form.target_calendar_reference} onChange={(event) => setForm((current) => ({ ...current, target_calendar_reference: event.target.value }))} placeholder={selectedProvider?.planned_target_label || 'Calendar reference'} />
          </label>
        </div>

        <label style={{ display: 'block', marginTop: '0.75rem' }}>
          Notes
          <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={4} placeholder="Who owns this calendar, what it should receive, or anything we should remember later." />
        </label>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          <label>
            <input type="checkbox" checked={form.is_enabled} onChange={(event) => setForm((current) => ({ ...current, is_enabled: event.target.checked }))} /> Enabled when provider is ready
          </label>
          <label>
            <input type="checkbox" checked={form.sync_confirmed_bookings} onChange={(event) => setForm((current) => ({ ...current, sync_confirmed_bookings: event.target.checked }))} /> Sync confirmed bookings only
          </label>
        </div>

        <div className="muted small-text" style={{ marginTop: '0.75rem' }}>
          Current connection status: {form.id ? humanizeCalendarConnectionStatus(editingIntegration?.connection_status || 'not_connected') : 'Not connected'}
        </div>

        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn">{form.id ? 'Update slot' : 'Save slot'}</button>
          <button type="button" className="btn btn-link" onClick={resetForm}>Clear</button>
        </div>
        {status && <p role={status.tone === 'error' ? 'alert' : 'status'} className={status.tone === 'error' ? 'muted danger' : 'muted'} style={{ marginTop: '0.75rem' }}>{status.message}</p>}
      </form>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3>Queued sync work</h3>
        <p className="muted">These counters are here so future provider implementations can reuse the same queue and tracking model.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {Object.entries(data.queue?.status_totals ?? {}).map(([key, total]) => (
              <tr key={key}>
                <td style={{ padding: '0.4rem 0', width: '35%' }}>{humanizeCalendarConnectionStatus(key)}</td>
                <td style={{ padding: '0.4rem 0' }}>{total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
        {(data.integrations ?? []).length === 0 ? (
          <div className="card">No calendar integration slots saved yet.</div>
        ) : (
          (data.integrations ?? []).map((item) => (
            <div key={item.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <strong>{item.label}</strong>
                  <p className="muted" style={{ margin: '0.35rem 0 0' }}>
                    {item.provider_label} · {humanizeCalendarConnectionStatus(item.connection_status)} · {item.is_enabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-tertiary" onClick={() => edit(item)}>Edit</button>
                  <button type="button" className="btn btn-link danger" onClick={() => destroy(item.id)}>Delete</button>
                </div>
              </div>
              <p style={{ margin: '0.75rem 0 0.25rem' }}>Target calendar: {item.target_calendar_name || 'Not named yet'}</p>
              <p className="muted small-text" style={{ margin: 0 }}>Future reference: {item.target_calendar_reference || 'Not assigned yet'}</p>
              <p className="muted small-text" style={{ margin: '0.25rem 0 0' }}>Confirmed-only sync: {item.sync_confirmed_bookings ? 'Yes' : 'No'}</p>
              <p className="muted small-text" style={{ margin: '0.25rem 0 0' }}>Pending jobs: {item.stats?.pending_jobs ?? 0} · Failed jobs: {item.stats?.failed_jobs ?? 0} · Linked events: {item.stats?.linked_events ?? 0}</p>
              {item.notes ? <p style={{ margin: '0.75rem 0 0' }}>{item.notes}</p> : null}
              {item.last_error ? <p className="muted danger" style={{ margin: '0.75rem 0 0' }}>Last error: {item.last_error}</p> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
