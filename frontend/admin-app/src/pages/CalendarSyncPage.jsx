import { useCallback, useEffect, useState } from 'react';
import { api } from '../admin/AdminShell';
import { useAdminConfirm } from '../admin/ConfirmProvider';
import { createCalendarIntegrationForm, humanizeCalendarConnectionStatus } from '../admin/calendarSyncDefaults';

export function CalendarSyncPage() {
  const confirm = useAdminConfirm();

  // Calendar sync state
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState(createCalendarIntegrationForm());

  // Calendar sync data hydration
  const load = useCallback(async () => {
    const response = await api.get('/calendar-integrations');
    setData(response.data.data);
    setError(null);
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err.response?.data?.error?.message ?? err.message));
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const calendarStatus = params.get('calendar');
    if (!calendarStatus) {
      return;
    }

    const messages = {
      connected: { tone: 'success', message: 'Google Calendar connected.' },
      'oauth-error': { tone: 'error', message: 'Google Calendar could not be connected. Please try again.' },
      'connect-error': { tone: 'error', message: 'Google Calendar connection failed. Check the settings and try again.' },
    };
    setStatus(messages[calendarStatus] || null);
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const resetForm = () => {
    const defaultProvider = data?.providers?.[0]?.key || 'google';
    setForm(createCalendarIntegrationForm(defaultProvider));
    setStatus(null);
  };

  // Integration save workflow
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
      is_primary_write_target: Boolean(item.is_primary_write_target),
      blocks_availability: Boolean(item.blocks_availability),
    });
    setStatus(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const destroy = async (id) => {
    if (!(await confirm({
      message: 'Delete this calendar integration? Existing sync history for that slot will be removed too.',
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

  // Google connection boundary
  const connectGoogle = async (item) => {
    try {
      const response = await api.post(`/calendar-integrations/${item.id}/connect-google`);
      window.location.href = response.data.data.authorization_url;
    } catch (err) {
      setStatus({ tone: 'error', message: err.response?.data?.error?.message ?? err.message });
    }
  };

  const disconnectGoogle = async (item) => {
    if (!(await confirm({
      message: `Disconnect Google Calendar for ${item.label}? Public booking will stop using it after this is saved.`,
      confirmLabel: 'Disconnect',
      tone: 'danger',
    }))) {
      return;
    }

    try {
      await api.post(`/calendar-integrations/${item.id}/disconnect-google`);
      setStatus({ tone: 'success', message: 'Google Calendar disconnected.' });
      await load();
    } catch (err) {
      setStatus({ tone: 'error', message: err.response?.data?.error?.message ?? err.message });
    }
  };

  const testConnection = async (item) => {
    try {
      const response = await api.post(`/calendar-integrations/${item.id}/test`);
      const count = response.data.data.calendars?.length ?? 0;
      setStatus({ tone: 'success', message: `Google Calendar responded. ${count} calendar${count === 1 ? '' : 's'} visible.` });
    } catch (err) {
      setStatus({ tone: 'error', message: err.response?.data?.error?.message ?? err.message });
    }
  };

  // Sync queue workflow
  const runSync = async () => {
    try {
      const response = await api.post('/calendar-sync/run');
      const result = response.data.data;
      setStatus({
        tone: result.failed > 0 ? 'error' : 'success',
        message: `Sync run finished: ${result.completed} completed, ${result.skipped} skipped, ${result.failed} failed.`,
      });
      await load();
    } catch (err) {
      setStatus({ tone: 'error', message: err.response?.data?.error?.message ?? err.message });
    }
  };

  if (error && !data) {
    return <div className="card">{error}</div>;
  }

  if (!data) {
    return <div className="card">Loading calendar sync…</div>;
  }

  // Calendar readiness surface
  const providerLookup = Object.fromEntries((data.providers ?? []).map((provider) => [provider.key, provider]));
  const selectedProvider = providerLookup[form.provider] || data.providers?.[0] || null;
  const editingIntegration = form.id ? (data.integrations ?? []).find((item) => item.id === form.id) : null;
  const connectedCalendars = (data.integrations ?? []).filter((item) => item.connection_status === 'connected' && item.is_enabled);
  const primaryCalendar = connectedCalendars.find((item) => item.is_primary_write_target);
  const blockingCalendars = connectedCalendars.filter((item) => item.blocks_availability);
  const failedJobs = Number(data.queue?.status_totals?.failed || 0);
  const checklist = [
    {
      label: 'Calendar sync enabled',
      ready: Boolean(data.config?.enabled),
      detail: data.config?.enabled ? 'Bow Wow will use calendar sync rules.' : 'Calendar sync is disabled in configuration.',
    },
    {
      label: 'Google OAuth configured',
      ready: Boolean(data.config?.google_oauth_configured),
      detail: data.config?.google_oauth_configured ? 'Google connect buttons are available.' : 'Add Google client settings before connecting.',
    },
    {
      label: 'Connected calendar',
      ready: connectedCalendars.length > 0,
      detail: connectedCalendars.length > 0 ? `${connectedCalendars.length} enabled calendar${connectedCalendars.length === 1 ? '' : 's'} connected.` : 'Connect the primary Google Calendar.',
    },
    {
      label: 'Primary write target',
      ready: Boolean(primaryCalendar),
      detail: primaryCalendar ? primaryCalendar.label : 'Choose one calendar to receive confirmed appointments.',
    },
    {
      label: 'Availability blocking',
      ready: blockingCalendars.length > 0,
      detail: blockingCalendars.length > 0 ? 'Public booking slots will avoid busy calendar time.' : 'Enable blocking on at least one calendar.',
    },
    {
      label: 'Sync queue',
      ready: failedJobs === 0,
      detail: failedJobs === 0 ? 'No failed sync work is waiting.' : `${failedJobs} failed job${failedJobs === 1 ? '' : 's'} need attention.`,
    },
  ];
  const bookingSafe = checklist.every((item) => item.ready);
  const wizardSteps = [
    {
      id: 'env',
      title: '1. Check calendar settings',
      ready: Boolean(data.config?.enabled && data.config?.google_oauth_configured),
      detail: data.config?.google_oauth_configured
        ? 'Google OAuth settings are present.'
        : 'Add Google client id, secret, redirect URI, and token key before connecting.',
    },
    {
      id: 'connect',
      title: '2. Connect Google',
      ready: connectedCalendars.length > 0,
      detail: connectedCalendars.length > 0
        ? `${connectedCalendars.length} enabled calendar${connectedCalendars.length === 1 ? '' : 's'} connected.`
        : 'Save a calendar slot, then use Connect Google.',
    },
    {
      id: 'primary',
      title: '3. Choose the write calendar',
      ready: Boolean(primaryCalendar),
      detail: primaryCalendar
        ? `${primaryCalendar.label} receives confirmed appointments.`
        : 'Mark one connected calendar as the primary write calendar.',
    },
    {
      id: 'blocking',
      title: '4. Review blocking calendars',
      ready: blockingCalendars.length > 0,
      detail: blockingCalendars.length > 0
        ? 'Busy time on blocking calendars will hide public slots.'
        : 'Choose at least one calendar that blocks public availability.',
    },
    {
      id: 'test',
      title: '5. Test and sync',
      ready: failedJobs === 0,
      detail: failedJobs === 0
        ? 'Run Test on the calendar card, then Run Sync Now when ready.'
        : `${failedJobs} failed sync job${failedJobs === 1 ? '' : 's'} should be reviewed.`,
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Calendar Sync</h1>
          <p>Connect Google Calendar to block public booking times and write confirmed appointments to the staff calendar.</p>
        </div>
        <button type="button" className="btn btn-tertiary" onClick={runSync}>
          Run Sync Now
        </button>
      </div>

      {error ? <div className="card" style={{ marginBottom: '1rem' }}>{error}</div> : null}
      {status && <p role={status.tone === 'error' ? 'alert' : 'status'} className={`save-feedback ${status.tone === 'error' ? 'is-error' : 'is-success'}`}>{status.message}</p>}

      <div className="card">
        <div className="booking-card__header">
          <div>
            <h3>Booking safety preview</h3>
            <p className="muted">{bookingSafe ? 'Public booking can use Google Calendar availability.' : 'Calendar setup still needs review before launch.'}</p>
          </div>
          <span className={`status-pill status-pill--${bookingSafe ? 'success' : 'warning'}`}>
            {bookingSafe ? 'Safe' : 'Review'}
          </span>
        </div>
        <p>Calendar sync: {data.config?.enabled ? 'Enabled' : 'Disabled'}</p>
        <p>Default timezone: {data.config?.default_timezone || 'Not set'}</p>
        <p>Google OAuth: {data.config?.google_oauth_configured ? 'Configured' : 'Needs client id, secret, redirect URI, and token key'}</p>
        <p className="muted">Bow Wow remains the source of truth. Google Calendar blocks availability and receives confirmed bookings, but Google edits do not change booking records.</p>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3>Calendar Setup Wizard</h3>
        <p className="muted">Work through these steps in order. The buttons below stay the same; the wizard just shows what still needs attention.</p>
        <div className="calendar-checklist">
          {wizardSteps.map((item) => (
            <div key={item.id} className={`calendar-check ${item.ready ? 'is-ready' : 'is-warning'}`}>
              <strong>{item.ready ? 'Ready' : 'Needs setup'} · {item.title}</strong>
              <p className="muted small-text">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3>Launch Checklist</h3>
        <div className="calendar-checklist">
          {checklist.map((item) => (
            <div key={item.label} className={`calendar-check ${item.ready ? 'is-ready' : 'is-warning'}`}>
              <strong>{item.ready ? 'Ready' : 'Needs setup'} · {item.label}</strong>
              <p className="muted small-text">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <form className="card" style={{ marginTop: '1rem' }} onSubmit={save}>
        <h3>{form.id ? 'Edit calendar' : 'Add calendar'}</h3>
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
            <input value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} placeholder="Primary grooming calendar" />
          </label>
          <label>
            Calendar name
            <input value={form.target_calendar_name} onChange={(event) => setForm((current) => ({ ...current, target_calendar_name: event.target.value }))} placeholder="Grooming confirmations" />
          </label>
          <label>
            Calendar ID
            <input value={form.target_calendar_reference} onChange={(event) => setForm((current) => ({ ...current, target_calendar_reference: event.target.value }))} placeholder={selectedProvider?.planned_target_label || 'primary'} />
          </label>
        </div>

        <label style={{ display: 'block', marginTop: '0.75rem' }}>
          Notes
          <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={4} placeholder="Who owns this calendar, what it should receive, or anything staff should remember." />
        </label>

        <div style={{ display: 'grid', gap: '0.55rem', marginTop: '0.75rem' }}>
          <label>
            <input type="checkbox" checked={form.is_enabled} onChange={(event) => setForm((current) => ({ ...current, is_enabled: event.target.checked }))} /> Enabled
          </label>
          <label>
            <input type="checkbox" checked={form.sync_confirmed_bookings} onChange={(event) => setForm((current) => ({ ...current, sync_confirmed_bookings: event.target.checked }))} /> Write confirmed bookings to this calendar
          </label>
          <label>
            <input type="checkbox" checked={form.is_primary_write_target} onChange={(event) => setForm((current) => ({ ...current, is_primary_write_target: event.target.checked }))} /> Primary write calendar
          </label>
          <label>
            <input type="checkbox" checked={form.blocks_availability} onChange={(event) => setForm((current) => ({ ...current, blocks_availability: event.target.checked }))} /> Block public booking slots when this calendar is busy
          </label>
        </div>

        <div className="muted small-text" style={{ marginTop: '0.75rem' }}>
          Current connection status: {form.id ? humanizeCalendarConnectionStatus(editingIntegration?.connection_status || 'not_connected') : 'Not connected'}
        </div>

        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn">{form.id ? 'Update calendar' : 'Save calendar'}</button>
          <button type="button" className="btn btn-link" onClick={resetForm}>Clear</button>
        </div>
      </form>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3>Queued sync work</h3>
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
          <div className="card">No calendars saved yet.</div>
        ) : (
          (data.integrations ?? []).map((item) => (
            <div key={item.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <strong>{item.label}</strong>
                  <p className="muted" style={{ margin: '0.35rem 0 0' }}>
                    {item.provider_label} · {humanizeCalendarConnectionStatus(item.connection_status)} · {item.is_enabled ? 'Enabled' : 'Disabled'}
                  </p>
                  <p className="muted small-text" style={{ margin: '0.25rem 0 0' }}>
                    {item.is_primary_write_target ? 'Primary write calendar' : 'Blocking/secondary calendar'} · {item.blocks_availability ? 'Blocks booking availability' : 'Does not block public slots'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {item.provider === 'google' && item.connection_status === 'connected' ? (
                    <>
                      <button type="button" className="btn btn-tertiary" onClick={() => testConnection(item)}>Test</button>
                      <button type="button" className="btn btn-link danger" onClick={() => disconnectGoogle(item)}>Disconnect</button>
                    </>
                  ) : item.provider === 'google' ? (
                    <button type="button" className="btn" onClick={() => connectGoogle(item)}>Connect Google</button>
                  ) : null}
                  <button type="button" className="btn btn-tertiary" onClick={() => edit(item)}>Edit</button>
                  <button type="button" className="btn btn-link danger" onClick={() => destroy(item.id)}>Delete</button>
                </div>
              </div>
              <p style={{ margin: '0.75rem 0 0.25rem' }}>Target calendar: {item.target_calendar_name || 'Not named yet'}</p>
              <p className="muted small-text" style={{ margin: 0 }}>Calendar ID: {item.target_calendar_reference || 'Not assigned yet'}</p>
              {item.google_account_email ? <p className="muted small-text" style={{ margin: '0.25rem 0 0' }}>Google account: {item.google_account_email}</p> : null}
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
