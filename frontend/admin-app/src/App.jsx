import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const api = axios.create({
  baseURL: '/api/admin',
  withCredentials: true,
});

const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [allowedSections, setAllowedSections] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/me');
      setUser(response.data.data.user);
      setAllowedSections(response.data.data.allowed_sections);
    } catch (err) {
      setUser(null);
      setAllowedSections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const login = async (email, password) => {
    const response = await api.post('/login', { email, password });
    setUser(response.data.data.user);
    setAllowedSections(response.data.data.allowed_sections);
  };

  const logout = async () => {
    await api.post('/logout');
    setUser(null);
    setAllowedSections([]);
  };

  return (
    <AuthContext.Provider value={{ user, allowedSections, loading, login, logout, reload: load }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  return useContext(AuthContext);
}

function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="card">Loading...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', section: 'dashboard' },
  { path: '/booking', label: 'Booking Requests', section: 'booking' },
  { path: '/schedule', label: 'Schedule Setup', section: 'schedule' },
  { path: '/happy-clients', label: 'Happy Clients', section: 'happy_clients' },
  { path: '/retail', label: 'Retail', section: 'retail' },
  { path: '/content', label: 'Text & Site Info', section: 'content' },
  { path: '/media', label: 'Media', section: 'media' },
  { path: '/audit', label: 'Audit Log', section: 'audit' },
  { path: '/users', label: 'Admin Users', section: 'users', superOnly: true },
  { path: '/system', label: 'System', section: 'system' },
];


function App() {
  return (
    <BrowserRouter basename="/admin">
      <AuthProvider>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route element={<AdminLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/booking" element={<BookingRequestsPage />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/happy-clients" element={<HappyClientsPage />} />
              <Route path="/retail" element={<RetailPage />} />
              <Route path="/content" element={<ContentPage />} />
              <Route path="/media" element={<MediaPage />} />
              <Route path="/audit" element={<AuditLogPage />} />
              <Route path="/users" element={<AdminUsersPage />} />
              <Route path="/system" element={<SystemPage />} />
            </Route>
          </Route>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

function AdminLayout() {
  const { user, allowedSections, logout } = useAuth();
  const navigate = useNavigate();
  const visibleNav = useMemo(
    () =>
      NAV_ITEMS.filter((item) => {
        if (item.superOnly && user?.role !== 'super_admin') return false;
        if (allowedSections.includes('*')) return true;
        return allowedSections.includes(item.section);
      }),
    [allowedSections, user],
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="admin-shell">
      <aside className="admin-nav">
        <div className="admin-nav__brand">
          <h2>Bow Wow Admin</h2>
          <p className="muted small-text">{user?.email}</p>
        </div>
        <nav className="admin-nav__links">
          {visibleNav.map((item) => (
            <Link key={item.path} to={item.path} className="admin-nav__link">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="admin-nav__footer">
          <button className="btn btn-warn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <div className="admin-main__scroll">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Login failed.');
    }
  };

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#f5f4f1' }}>
      <form className="card" onSubmit={submit} style={{ minWidth: '320px' }}>
        <h2>Admin Login</h2>
        <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
        <input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} style={{ marginTop: '0.75rem' }} />
        {error && <p style={{ color: '#b83232' }}>{error}</p>}
        <button className="btn" style={{ marginTop: '0.75rem' }}>
          Login
        </button>
      </form>
    </div>
  );
}

function DashboardPage() {
  const [data, setData] = useState(null);

  const load = useCallback(() => {
    api.get('/dashboard').then((response) => setData(response.data.data));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return <div className="card">Loading dashboard...</div>;
  }

  return (
    <ManualBookingLauncher onCreated={load}>
      {(openManual) => (
        <div>
          <div className="page-header">
            <h1>Dashboard</h1>
            <div className="page-toolbar">
              <button className="btn" onClick={() => openManual()}>
                Create Manual Reservation
              </button>
            </div>
          </div>
          <div className="stat-overview">
            {Object.entries(data.stats).map(([key, value]) => (
              <div key={key} className="card stat-card">
                <p>{BOOKING_STAT_LABELS[key] ?? key.replace('_', ' ')}</p>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="card" style={{ marginTop: '2rem' }}>
            <h3>Recent Activity</h3>
            <ul className="activity-list">
              {data.recent_activity.map((log) => (
                <li key={log.id}>
                  <span>{log.action}</span>
                  <span className="muted small-text">
                    {log.email ?? 'system'} · {formatDateTime(log.created_at)}
                  </span>
                </li>
              ))}
              {data.recent_activity.length === 0 && <li className="muted">No recent actions.</li>}
            </ul>
          </div>
        </div>
      )}
    </ManualBookingLauncher>
  );
}

const BOOKING_STAT_LABELS = {
  new_requests: 'New Requests',
  pending_confirmation: 'Pending Confirmation',
  confirmed_today: 'Confirmed Today',
  confirmed_week: 'Confirmed This Week',
};

const BOOKING_STAT_ORDER = ['new_requests', 'pending_confirmation', 'confirmed_today', 'confirmed_week'];

function BookingRequestsPage() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({});
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [scheduleSettings, setScheduleSettings] = useState(null);

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
    if (!selected) return;
    const refreshed = items.find((item) => item.id === selected.id);
    if (refreshed) {
      setSelected(refreshed);
      setNotes(refreshed.admin_notes || '');
    }
  }, [items, selected]);

  const openDetails = (request) => {
    setSelected(request);
    setNotes(request.admin_notes || '');
  };

  const performAction = async (action) => {
    if (!selected) return;
    const prompts = {
      confirm: 'Confirm this booking and notify the customer?',
      decline: 'Decline this booking request?',
      cancel: 'Cancel this booking?',
    };
    if (!window.confirm(prompts[action])) {
      return;
    }
    try {
      await api.post('/booking-requests/action', { id: selected.id, action, notes });
      setFeedback(`Booking ${action}ed.`);
      setTimeout(() => setFeedback(null), 2500);
      setSelected(null);
      setNotes('');
      load();
    } catch (err) {
      setFeedback(err.response?.data?.error?.message ?? 'Unable to update booking.');
    }
  };

  const extendHold = async () => {
    if (!selected) return;
    try {
      await api.post('/booking-requests/extend', { id: selected.id });
      load();
      setFeedback('Hold extended an additional 24 hours.');
    } catch (err) {
      setFeedback(err.response?.data?.error?.message ?? 'Unable to extend hold.');
    }
  };

  const releaseHold = async () => {
    if (!selected) return;
    if (!window.confirm('Release this hold and free the slot? This will cancel the pending request.')) {
      return;
    }
    try {
      await api.post('/booking-requests/release', { id: selected.id, notes });
      setSelected(null);
      load();
      setFeedback('Hold released.');
    } catch (err) {
      setFeedback(err.response?.data?.error?.message ?? 'Unable to release hold.');
    }
  };

  const statusOptions = [
    { value: '', label: 'All statuses' },
    { value: 'pending_confirmation', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
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
          <div className="booking-layout">
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
                      className={`card booking-card ${selected?.id === request.id ? 'is-active' : ''}`}
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
                          <p className="small-text">{request.dog_name || 'No dog name'}</p>
                          <p className="small-text muted">{truncateText(request.dog_notes) || 'No notes yet'}</p>
                        </div>
                      </div>
                      <p className="small-text">{summarizeServices(request.services_json)}</p>
                      <p className="muted small-text">
                        Submitted {formatTimeAgo(request.created_at)}
                        {holdInfo && request.status === 'pending_confirmation' ? ` · ~${holdInfo.hoursRemaining}h hold left` : ''}
                      </p>
                      <button className="btn btn-tertiary" type="button">
                        View details
                      </button>
                    </article>
                  );
                })}
                {items.length === 0 && <div className="card">No booking requests found.</div>}
              </div>
            </div>

            <div className="booking-detail card">
              {selected ? (
                <div className="booking-detail__content">
                  <h2>{selected.customer_name}</h2>
                  <p className="muted small-text">Request #{selected.id}</p>
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
                    </div>
                    <div>
                      <h4>Dog Details</h4>
                      <p>{selected.dog_name || 'Not provided'}</p>
                      <p className="muted">{selected.dog_notes || 'No notes yet'}</p>
                    </div>
                  </div>
                  <div className="detail-section">
                    <h4>Requested Services</h4>
                    <ul>
                      {parseServices(selected.services_json).map((service, index) => (
                        <li key={index}>{service}</li>
                      ))}
                      {parseServices(selected.services_json).length === 0 && <li>Not specified</li>}
                    </ul>
                  </div>
                  <div className="detail-section">
                    <h4>Admin Notes</h4>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add confirmation notes..." />
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
                    <button className="btn btn-success" onClick={() => performAction('confirm')}>
                      Confirm
                    </button>
                    <button className="btn btn-warn" onClick={() => performAction('decline')}>
                      Decline
                    </button>
                    <button className="btn btn-muted" onClick={() => performAction('cancel')}>
                      Cancel
                    </button>
                  </div>
                  {feedback && <p className="muted">{feedback}</p>}
                </div>
              ) : (
                <div className="muted">Select a booking to view full details.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </ManualBookingLauncher>
  );
}

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function SchedulePage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [settings, setSettings] = useState({ booking_hold_minutes: 1440, booking_pending_expire_hours: 24 });
  const [timeDrafts, setTimeDrafts] = useState({});
  const [overrideForm, setOverrideForm] = useState({ id: null, date: '', is_closed: false, times: '' });
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [builder, setBuilder] = useState({ start: '09:00', end: '17:00', weekdays: [1, 2, 3, 4, 5], replaceExisting: true });

  const load = useCallback(async () => {
    const [tpl, ov] = await Promise.all([api.get('/schedule/templates'), api.get('/schedule/overrides')]);
    const templateRows = tpl.data.data.templates || [];
    const normalized = Array.from({ length: 7 }, (_, weekday) => {
      const match = templateRows.find((template) => Number(template.weekday) === weekday);
      if (match) {
        return {
          weekday,
          is_enabled: Number(match.is_enabled ?? 1),
          times: JSON.parse(match.times_json || '[]'),
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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
    const start = builder.start;
    const end = builder.end;
    if (!start || !end) {
      return [];
    }
    const startDate = new Date(`1970-01-01T${start}`);
    const endDate = new Date(`1970-01-01T${end}`);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
      return [];
    }
    const blocks = [];
    let cursor = startDate.getTime();
    while (cursor < endDate.getTime()) {
      blocks.push(new Date(cursor).toISOString().slice(11, 16));
      cursor += slotMinutes * 60 * 1000;
    }
    return Array.from(new Set(blocks));
  }, [builder.start, builder.end, slotMinutes]);

  const applyBuilder = () => {
    const generated = buildBlocks();
    if (!generated.length) {
      alert('Enter a valid start/end time to generate slots.');
      return;
    }
    if (builder.weekdays.length === 0) {
      alert('Select at least one weekday.');
      return;
    }
    setTemplates((prev) =>
      prev.map((tpl) => {
        if (!builder.weekdays.includes(tpl.weekday)) {
          return tpl;
        }
        const nextTimes = builder.replaceExisting
          ? generated
          : Array.from(new Set([...(tpl.times || []), ...generated])).sort();
        return { ...tpl, times: nextTimes };
      }),
    );
  };

  const updateTemplateTimes = (weekday, nextTimes) => {
    setTemplates((prev) =>
      prev.map((tpl) => (tpl.weekday === weekday ? { ...tpl, times: nextTimes } : tpl)),
    );
  };

  const addTime = (weekday) => {
    const draft = (timeDrafts[weekday] || '').trim();
    if (!draft) return;
    const times = templates.find((tpl) => tpl.weekday === weekday)?.times || [];
    if (!times.includes(draft)) {
      updateTemplateTimes(weekday, [...times, draft]);
    }
    setTimeDrafts((prev) => ({ ...prev, [weekday]: '' }));
  };

  const removeTime = (weekday, time) => {
    const times = templates.find((tpl) => tpl.weekday === weekday)?.times || [];
    updateTemplateTimes(
      weekday,
      times.filter((value) => value !== time),
    );
  };

  const saveTemplates = async () => {
    await api.post('/schedule/templates', {
      templates: templates.map((template) => ({
        weekday: template.weekday,
        times: template.times,
        is_enabled: template.is_enabled,
      })),
      settings,
    });
    load();
  };

  const submitOverride = async (e) => {
    e.preventDefault();
    await api.post('/schedule/overrides', {
      date: overrideForm.date,
      is_closed: overrideForm.is_closed ? 1 : 0,
      times: overrideForm.times
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setOverrideForm({ id: null, date: '', is_closed: false, times: '' });
    load();
  };

  const editOverride = (override) => {
    setOverrideForm({
      id: override.id,
      date: override.date,
      is_closed: Boolean(override.is_closed),
      times: (JSON.parse(override.times_json || '[]') || []).join(', '),
    });
  };

  const deleteOverride = async (id) => {
    if (!window.confirm('Delete this override?')) return;
    await api.delete(`/schedule/overrides/${id}`);
    load();
  };

  const canDeleteOverride = user?.role === 'super_admin';

  return (
    <div>
      <h1>Schedule Setup</h1>
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
        <p className="muted">Add time buttons for each weekday. Disabled weekdays will not appear on the public calendar.</p>
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
                    {time} ×
                  </button>
                ))}
                {(tpl.times?.length ?? 0) === 0 && <span className="muted small-text">No times yet</span>}
              </div>
              <div className="time-add-row">
                <input
                  placeholder="HH:MM"
                  value={timeDrafts[tpl.weekday] || ''}
                  onChange={(e) => setTimeDrafts((prev) => ({ ...prev, [tpl.weekday]: e.target.value }))}
                />
                <button type="button" className="btn btn-tertiary" onClick={() => addTime(tpl.weekday)}>
                  Add time
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
        <p className="muted">Override a specific date to close bookings or provide custom times.</p>
        <form onSubmit={submitOverride} className="override-form">
          <input type="date" value={overrideForm.date} onChange={(e) => setOverrideForm((prev) => ({ ...prev, date: e.target.value }))} required />
          <label>
            <input type="checkbox" checked={overrideForm.is_closed} onChange={(e) => setOverrideForm((prev) => ({ ...prev, is_closed: e.target.checked }))} /> Closed
          </label>
          <input
            placeholder="Times (e.g. 09:00, 10:00)"
            value={overrideForm.times}
            onChange={(e) => setOverrideForm((prev) => ({ ...prev, times: e.target.value }))}
            disabled={overrideForm.is_closed}
          />
          <button className="btn">{overrideForm.id ? 'Update override' : 'Save override'}</button>
        </form>
        <div className="override-table">
          {overrides.map((override) => {
            const displayTimes = (JSON.parse(override.times_json || '[]') || []).join(', ');
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

function HappyClientsPage() {
  const defaultForm = {
    id: null,
    title: '',
    blurb: '',
    before_media: null,
    after_media: null,
    tags: '',
    sort_order: 0,
    is_published: true,
  };

  const [items, setItems] = useState([]);
  const [form, setForm] = useState(defaultForm);

  const load = useCallback(async () => {
    const response = await api.get('/happy-clients');
    setItems(response.data.data.items);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e) => {
    e.preventDefault();
    await api.post('/happy-clients', {
      id: form.id || undefined,
      title: form.title,
      blurb: form.blurb,
      sort_order: Number(form.sort_order) || 0,
      is_published: form.is_published ? 1 : 0,
      before_media_id: form.before_media?.id ?? null,
      after_media_id: form.after_media?.id ?? null,
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
    setForm(defaultForm);
    load();
  };

  const edit = (item) => {
    setForm({
      id: item.id,
      title: item.title,
      blurb: item.blurb ?? '',
      before_media: item.before_media ?? null,
      after_media: item.after_media ?? null,
      tags: (item.tags_list || []).join(', '),
      sort_order: item.sort_order ?? 0,
      is_published: item.is_published === 1,
    });
  };

  return (
    <div>
      <h1>Happy Clients</h1>
      <form className="card stack gap-sm" onSubmit={save}>
        <input placeholder="Title" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} required />
        <textarea placeholder="Short blurb" value={form.blurb} onChange={(e) => setForm((prev) => ({ ...prev, blurb: e.target.value }))} />
        <div className="grid two-col gap-sm">
          <input
            type="number"
            min="0"
            placeholder="Sort order"
            value={form.sort_order}
            onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))}
          />
          <label className="toggle">
            <input type="checkbox" checked={form.is_published} onChange={(e) => setForm((prev) => ({ ...prev, is_published: e.target.checked }))} /> Published
          </label>
        </div>
        <input placeholder="Tags (comma separated)" value={form.tags} onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))} />
        <MediaPicker label="Before photo" media={form.before_media} onChange={(media) => setForm((prev) => ({ ...prev, before_media: media }))} />
        <MediaPicker label="After photo" media={form.after_media} onChange={(media) => setForm((prev) => ({ ...prev, after_media: media }))} />
        <div className="form-actions">
          <button className="btn">{form.id ? 'Update Entry' : 'Add Entry'}</button>
          {form.id && (
            <button type="button" className="btn btn-link" onClick={() => setForm(defaultForm)}>
              Cancel edit
            </button>
          )}
        </div>
      </form>
      <div className="card-grid">
        {items.map((item) => (
          <div key={item.id} className="card">
            <div className="happy-preview">
              {item.before_media && <img src={item.before_media.fallback_url} alt="Before" />}
              {item.after_media && <img src={item.after_media.fallback_url} alt="After" />}
            </div>
            <strong>{item.title}</strong>
            <p className="muted">{item.blurb}</p>
            <p className="small-text">Tags: {(item.tags_list || []).join(', ') || '—'}</p>
            <button type="button" className="btn btn-tertiary" onClick={() => edit(item)}>
              Edit entry
            </button>
          </div>
        ))}
        {items.length === 0 && <div className="card">No happy clients added yet.</div>}
      </div>
    </div>
  );
}

function RetailPage() {
  const defaultForm = {
    id: null,
    name: '',
    description: '',
    price_cents: '',
    media: null,
    is_featured: false,
    is_published: true,
    sort_order: 0,
  };

  const [items, setItems] = useState([]);
  const [form, setForm] = useState(defaultForm);

  const load = useCallback(async () => {
    const response = await api.get('/retail');
    setItems(response.data.data.items);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e) => {
    e.preventDefault();
    await api.post('/retail', {
      id: form.id || undefined,
      name: form.name,
      description: form.description,
      price_cents: form.price_cents ? Math.round(Number(form.price_cents) * 100) : null,
      media_id: form.media?.id ?? null,
      is_featured: form.is_featured ? 1 : 0,
      is_published: form.is_published ? 1 : 0,
      sort_order: Number(form.sort_order) || 0,
    });
    setForm(defaultForm);
    load();
  };

  const edit = (item) => {
    setForm({
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      price_cents: item.price_cents ? (item.price_cents / 100).toFixed(2) : '',
      media: item.media ?? null,
      is_featured: item.is_featured === 1,
      is_published: item.is_published === 1,
      sort_order: item.sort_order ?? 0,
    });
  };

  return (
    <div>
      <h1>Retail Items</h1>
      <form className="card stack gap-sm" onSubmit={save}>
        <input placeholder="Product name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
        <textarea placeholder="Description" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
        <div className="grid two-col gap-sm">
          <input
            placeholder="Price (USD)"
            value={form.price_cents}
            onChange={(e) => setForm((prev) => ({ ...prev, price_cents: e.target.value }))}
            type="number"
            step="0.01"
            min="0"
          />
          <input
            type="number"
            placeholder="Sort order"
            value={form.sort_order}
            onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))}
          />
        </div>
        <div className="grid two-col gap-sm">
          <label className="toggle">
            <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm((prev) => ({ ...prev, is_featured: e.target.checked }))} /> Featured
          </label>
          <label className="toggle">
            <input type="checkbox" checked={form.is_published} onChange={(e) => setForm((prev) => ({ ...prev, is_published: e.target.checked }))} /> Published
          </label>
        </div>
        <MediaPicker label="Product image" media={form.media} onChange={(media) => setForm((prev) => ({ ...prev, media }))} />
        <div className="form-actions">
          <button className="btn">{form.id ? 'Update Item' : 'Save Item'}</button>
          {form.id && (
            <button type="button" className="btn btn-link" onClick={() => setForm(defaultForm)}>
              Cancel edit
            </button>
          )}
        </div>
      </form>
      <div className="card-grid">
        {items.map((item) => (
          <div key={item.id} className="card">
            {item.media && <img src={item.media.fallback_url} alt={item.media.alt_text || item.name} style={{ width: '100%', borderRadius: '10px' }} />}
            <strong>{item.name}</strong>
            <p className="muted">{item.description}</p>
            <p className="small-text">
              {item.price_cents ? `$${(item.price_cents / 100).toFixed(2)}` : 'Contact for pricing'} · {item.is_published ? 'Published' : 'Hidden'}
            </p>
            <button type="button" className="btn btn-tertiary" onClick={() => edit(item)}>
              Edit item
            </button>
          </div>
        ))}
        {items.length === 0 && <div className="card">No retail items yet.</div>}
      </div>
    </div>
  );
}

function ContentPage() {
  const [settings, setSettings] = useState(null);
  const [sections, setSections] = useState(null);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/content/site').then((response) => {
      setSettings(response.data.data.settings);
      setSections(response.data.data.sections);
    });
  }, []);

  if (!settings || !sections) {
    return <div className="card">Loading content...</div>;
  }

  const updateSection = (key, updates) => {
    setSections((prev) => ({
      ...prev,
      [key]: { ...(prev?.[key] || {}), ...updates },
    }));
  };

  const updateList = (key, items) => {
    updateSection(key, { items });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    await api.post('/content/site', { settings, sections });
    setSaving(false);
    setStatus('Saved!');
    setTimeout(() => setStatus(null), 3000);
  };

  return (
    <div>
      <h1>Text & Site Info</h1>
      <form className="stack gap-md" onSubmit={save}>
        <div className="card">
          <h3>Business Details</h3>
          <div className="grid two-col gap-sm">
            <label className="field-block">
              <span className="field-label">Business name</span>
              <input value={settings.business_name} onChange={(e) => setSettings((prev) => ({ ...prev, business_name: e.target.value }))} />
            </label>
            <label className="field-block">
              <span className="field-label">Serving area tagline</span>
              <input value={settings.serving_area} onChange={(e) => setSettings((prev) => ({ ...prev, serving_area: e.target.value }))} />
            </label>
            <label className="field-block">
              <span className="field-label">Phone</span>
              <input value={settings.phone} onChange={(e) => setSettings((prev) => ({ ...prev, phone: e.target.value }))} />
            </label>
            <label className="field-block">
              <span className="field-label">Email</span>
              <input value={settings.email} onChange={(e) => setSettings((prev) => ({ ...prev, email: e.target.value }))} />
            </label>
            <label className="field-block">
              <span className="field-label">Address</span>
              <input value={settings.address} onChange={(e) => setSettings((prev) => ({ ...prev, address: e.target.value }))} />
            </label>
            <label className="field-block">
              <span className="field-label">Business hours</span>
              <input value={settings.hours} onChange={(e) => setSettings((prev) => ({ ...prev, hours: e.target.value }))} />
            </label>
            <label className="field-block">
              <span className="field-label">Facebook handle</span>
              <input value={settings.social_facebook || ''} onChange={(e) => setSettings((prev) => ({ ...prev, social_facebook: e.target.value }))} />
            </label>
            <label className="field-block">
              <span className="field-label">Instagram handle</span>
              <input value={settings.social_instagram || ''} onChange={(e) => setSettings((prev) => ({ ...prev, social_instagram: e.target.value }))} />
            </label>
          </div>
        </div>

        <div className="card">
          <h3>Hero & Booking</h3>
          <label className="field-block">
            <span className="field-label">Hero headline</span>
            <input value={sections.hero?.headline || ''} onChange={(e) => updateSection('hero', { headline: e.target.value })} />
          </label>
          <div className="field-block">
            <span className="field-label">Hero subheading</span>
            <RichTextEditor value={sections.hero?.subheading || ''} onChange={(value) => updateSection('hero', { subheading: value })} />
          </div>
          <div className="grid two-col gap-sm">
            <label className="field-block">
              <span className="field-label">Primary CTA label</span>
              <input value={sections.hero?.cta_text || ''} onChange={(e) => updateSection('hero', { cta_text: e.target.value })} />
            </label>
            <label className="field-block">
              <span className="field-label">Secondary CTA label</span>
              <input value={sections.hero?.cta_secondary || ''} onChange={(e) => updateSection('hero', { cta_secondary: e.target.value })} />
            </label>
          </div>
          <div className="field-block">
            <span className="field-label">Booking intro text</span>
            <RichTextEditor value={sections.booking?.intro || ''} onChange={(value) => updateSection('booking', { intro: value })} />
          </div>
        </div>

        <div className="card">
          <h3>Services</h3>
          <div className="field-block">
            <span className="field-label">Intro copy</span>
            <RichTextEditor value={sections.services?.intro || ''} onChange={(value) => updateSection('services', { intro: value })} />
          </div>
          <ServiceCardsEditor cards={sections.services?.cards || []} onChange={(cards) => updateSection('services', { cards })} />
        </div>

        <div className="card">
          <h3>About Section</h3>
          <label className="field-block">
            <span className="field-label">Section title</span>
            <input value={sections.about?.title || ''} onChange={(e) => updateSection('about', { title: e.target.value })} />
          </label>
          <div className="field-block">
            <span className="field-label">Body copy</span>
            <RichTextEditor value={sections.about?.body || ''} onChange={(value) => updateSection('about', { body: value })} />
          </div>
        </div>

        <div className="card">
          <h3>FAQ</h3>
          <ListEditor
            items={sections.faq?.items || []}
            onChange={(items) => updateList('faq', items)}
            fields={[
              { name: 'question', label: 'Question' },
              { name: 'answer', label: 'Answer', rich: true },
            ]}
          />
        </div>

        <div className="card">
          <h3>Policies</h3>
          <ListEditor
            items={sections.policies?.items || []}
            onChange={(items) => updateList('policies', items)}
            fields={[
              { name: 'title', label: 'Policy Title' },
              { name: 'body', label: 'Policy Body', rich: true },
            ]}
          />
        </div>

        <div className="card">
          <h3>Location & Contact</h3>
          <div className="field-block">
            <span className="field-label">Location description</span>
            <RichTextEditor value={sections.location?.note || ''} onChange={(value) => updateSection('location', { note: value })} />
          </div>
          <div className="field-block">
            <span className="field-label">Contact helper text</span>
            <RichTextEditor value={sections.contact?.note || ''} onChange={(value) => updateSection('contact', { note: value })} />
          </div>
        </div>

        <div className="form-actions">
          <button className="btn" disabled={saving}>
            {saving ? 'Saving…' : 'Save Content'}
          </button>
          {status && <p className="muted">{status}</p>}
        </div>
      </form>
    </div>
  );
}

function MediaPage() {
  const [items, setItems] = useState([]);
  const [file, setFile] = useState();
  const [metadata, setMetadata] = useState({ alt_text: '', title: '', caption: '', category: 'default' });
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [filter, setFilter] = useState('all');

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
          setUploadStatus('Processing variants…');
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
    await api.delete(`/media/${id}`);
    load();
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
      <form className="card" onSubmit={upload}>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0])} />
        <input placeholder="Alt text" value={metadata.alt_text} onChange={(e) => setMetadata((prev) => ({ ...prev, alt_text: e.target.value }))} />
        <input placeholder="Title (optional)" value={metadata.title} onChange={(e) => setMetadata((prev) => ({ ...prev, title: e.target.value }))} />
        <textarea placeholder="Caption (optional)" value={metadata.caption} onChange={(e) => setMetadata((prev) => ({ ...prev, caption: e.target.value }))} />
        <select value={metadata.category} onChange={(e) => setMetadata((prev) => ({ ...prev, category: e.target.value }))}>
          <option value="default">Default</option>
          <option value="gallery">Gallery</option>
          <option value="retail">Retail</option>
        </select>
        <button className="btn">Upload</button>
        {uploadProgress > 0 && (
          <div style={{ marginTop: '0.5rem', background: '#eee', borderRadius: '8px', height: '8px', overflow: 'hidden' }}>
            <div style={{ width: `${uploadProgress}%`, background: '#1f2937', height: '8px' }} />
          </div>
        )}
        {uploadStatus && <p>{uploadStatus}</p>}
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
          <div key={item.id} className="card">
            <MediaPicture media={item} alt={item.alt_text || item.title || `Media ${item.id}`} />
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

function AuditLogPage() {
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

function AdminUsersPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ email: '', password: '', role: 'manager', is_enabled: true });

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
    await api.post('/users', form);
    setForm({ email: '', password: '', role: 'manager', is_enabled: true });
    load();
  };

  return (
    <div>
      <h1>Admin Users</h1>
      <form className="card" onSubmit={save}>
        <input placeholder="Email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
        <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} />
        <select value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}>
          <option value="manager">Manager</option>
          <option value="scheduler">Scheduler</option>
          <option value="content_editor">Content Editor</option>
          <option value="super_admin">Super Admin</option>
        </select>
        <label>
          <input type="checkbox" checked={form.is_enabled} onChange={(e) => setForm((prev) => ({ ...prev, is_enabled: e.target.checked }))} /> Enabled
        </label>
        <button className="btn">Save User</button>
      </form>
      {items.map((item) => (
        <div key={item.id} className="card" style={{ marginTop: '0.75rem' }}>
          <strong>{item.email}</strong> – {item.role}
        </div>
      ))}
    </div>
  );
}

function SystemPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get('/system')
      .then((response) => setData(response.data.data))
      .catch((err) => setError(err.response?.data?.error?.message ?? err.message));
  }, []);

  if (error) {
    return <div className="card">{error}</div>;
  }

  if (!data) {
    return <div className="card">Loading diagnostics...</div>;
  }

  const rows = [
    { label: 'PHP Version', ok: true, value: data.php_version },
    { label: 'GD Extension', ok: data.extensions?.gd, tip: 'Enable GD in php.ini or via GoDaddy PHP selector.' },
    { label: 'Imagick Extension', ok: data.extensions?.imagick, tip: 'Enable Imagick via hosting control panel.' },
    { label: 'WebP Support', ok: data.webp_support, tip: 'Ensure GD or Imagick built with WebP.' },
    { label: 'Database Connectivity', ok: data.db_ok, tip: 'Check DB credentials in backend/.env and grant privileges.' },
    { label: 'SendGrid Config', ok: data.sendgrid_configured, tip: 'Set SENDGRID_API_KEY and sender info inside backend/.env.' },
  ];

  const pathTips = {
    upload_dir_writable: 'Set uploads/ to 775 via cPanel.',
    originals_writable: 'Ensure uploads/originals is writable.',
    variants_optimized_writable: 'Ensure uploads/variants/optimized is writable.',
    variants_webp_writable: 'Ensure uploads/variants/webp is writable.',
    manifests_writable: 'Ensure uploads/manifests is writable.',
  };

  Object.entries(data.paths_writable ?? {}).forEach(([key, ok]) => {
    rows.push({
      label: `Writable: ${key.replace(/_/g, ' ')}`,
      ok,
      tip: pathTips[key] ?? 'Adjust directory permissions (775).',
    });
  });

  return (
    <div>
      <h1>System Diagnostics</h1>
      <p>These checks confirm that uploads, image processing, and email delivery are ready for GoDaddy deployment.</p>
      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td style={{ padding: '0.5rem 0', width: '35%' }}>{row.label}</td>
                <td style={{ padding: '0.5rem 0', width: '15%' }}>{row.ok ? '✅' : '⚠️'}</td>
                <td style={{ padding: '0.5rem 0' }}>{row.value || (row.ok ? 'OK' : 'Action required')}</td>
                <td style={{ padding: '0.5rem 0', color: row.ok ? '#4b5563' : '#b45309' }}>{!row.ok && row.tip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ marginTop: '1rem' }}>
        <h3>Environment</h3>
        <p>App URL: {data.app?.url}</p>
        <p>Environment: {data.app?.env}</p>
      </div>
    </div>
  );
}

function ManualBookingLauncher({ children, onCreated, scheduleSettings }) {
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

  const holdMinutes = Number(settings?.booking_hold_minutes ?? 1440);
  const holdHours = Math.round(holdMinutes / 60);

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
    <div className="modal">
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__content manual-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <h3>Create Manual Reservation</h3>
            <p className="muted small-text">Holds the selected slot for {holdHours} hours while you follow up.</p>
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
              <input value={form.dog_name} onChange={(e) => updateForm('dog_name', e.target.value)} />
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
          {status && <p className="muted small-text">{status}</p>}
        </form>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const labels = {
    pending_confirmation: 'Pending',
    confirmed: 'Confirmed',
    declined: 'Declined',
    cancelled: 'Cancelled',
    expired: 'Expired',
  };
  return <span className={`status-badge status-${status}`}>{labels[status] ?? status}</span>;
}

function parseServices(json) {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (typeof parsed === 'object') {
      return Object.values(parsed).filter(Boolean);
    }
    return [];
  } catch (err) {
    return [];
  }
}

function summarizeServices(json) {
  const services = parseServices(json);
  if (!services.length) {
    return 'No services selected';
  }
  return services.join(', ');
}

function RichTextEditor({ value, onChange }) {
  const modules = useMemo(
    () => ({
      toolbar: [['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['link'], ['clean']],
    }),
    [],
  );

  return <ReactQuill theme="snow" value={value} onChange={onChange} modules={modules} />;
}

function ListEditor({ items, onChange, fields }) {
  const addItem = () => {
    const blank = {};
    fields.forEach((field) => {
      blank[field.name] = '';
    });
    onChange([...(items || []), blank]);
  };

  const updateItem = (index, key, value) => {
    const next = [...items];
    next[index] = { ...next[index], [key]: value };
    onChange(next);
  };

  const removeItem = (index) => {
    const next = [...items];
    next.splice(index, 1);
    onChange(next);
  };

  return (
    <div className="stack gap-sm">
      {items?.map((item, index) => (
        <div key={index} className="list-editor-row">
          {fields.map((field) =>
            field.rich ? (
              <RichTextEditor key={field.name} value={item[field.name] || ''} onChange={(value) => updateItem(index, field.name, value)} />
            ) : (
              <input
                key={field.name}
                placeholder={field.label}
                value={item[field.name] || ''}
                onChange={(e) => updateItem(index, field.name, e.target.value)}
              />
            ),
          )}
          <button type="button" className="btn btn-link danger" onClick={() => removeItem(index)}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-tertiary" onClick={addItem}>
        Add item
      </button>
    </div>
  );
}

function ServiceCardsEditor({ cards, onChange }) {
  const updateCard = (index, key, value) => {
    const next = [...cards];
    next[index] = { ...next[index], [key]: value };
    onChange(next);
  };

  const addCard = () => {
    onChange([
      ...cards,
      {
        title: '',
        price: '',
        description: '',
        bullets: [],
      },
    ]);
  };

  const removeCard = (index) => {
    const next = [...cards];
    next.splice(index, 1);
    onChange(next);
  };

  const updateBullets = (index, value) => {
    updateCard(
      index,
      'bullets',
      value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    );
  };

  return (
    <div className="stack gap-sm">
      {cards.map((card, index) => (
        <div key={index} className="card muted-card">
          <div className="grid two-col gap-sm">
            <input placeholder="Service title" value={card.title} onChange={(e) => updateCard(index, 'title', e.target.value)} />
            <input placeholder="Price" value={card.price} onChange={(e) => updateCard(index, 'price', e.target.value)} />
          </div>
          <RichTextEditor value={card.description || ''} onChange={(value) => updateCard(index, 'description', value)} />
          <textarea
            placeholder="Bullets (one per line)"
            value={(card.bullets || []).join('\n')}
            onChange={(e) => updateBullets(index, e.target.value)}
          />
          <button type="button" className="btn btn-link danger" onClick={() => removeCard(index)}>
            Remove service
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-tertiary" onClick={addCard}>
        Add service
      </button>
    </div>
  );
}

function MediaPicker({ label, media, onChange }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadMedia = async () => {
    setLoading(true);
    const response = await api.get('/media');
    setItems(response.data.data.items);
    setLoading(false);
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
        <button type="button" className="btn btn-tertiary" onClick={openModal}>
          Choose image
        </button>
        {media && (
          <button type="button" className="btn btn-link" onClick={() => onChange(null)}>
            Clear
          </button>
        )}
      </div>
      {open && (
        <div className="media-modal">
          <div className="media-modal__backdrop" onClick={() => setOpen(false)} />
          <div className="media-modal__content">
            <div className="media-modal__header">
              <h3>Select media</h3>
              <button type="button" className="btn btn-link" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            {loading ? (
              <p>Loading…</p>
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

function MediaPicture({ media, alt }) {
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

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function buildServiceList(input) {
  if (!input) return [];
  return input
    .split(/\r?\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatDateLabel(date) {
  if (!date) return '';
  const value = new Date(`${date}T00:00:00`);
  if (Number.isNaN(value.getTime())) {
    return date;
  }
  return value.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTimeLabel(date, time) {
  if (!time) return '—';
  const value = new Date(`${date || '1970-01-01'}T${time}`);
  if (Number.isNaN(value.getTime())) {
    return time;
  }
  return value.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function calcDurationMinutes(start, end) {
  if (!start || !end) return null;
  const base = '1970-01-01T';
  const startDate = new Date(base + start);
  const endDate = new Date(base + end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }
  return Math.round((endDate.getTime() - startDate.getTime()) / 60000);
}

function formatTimeRange(date, start, end) {
  const startLabel = formatTimeLabel(date, start);
  if (!end) {
    return startLabel;
  }
  const endLabel = formatTimeLabel(date, end);
  const duration = calcDurationMinutes(start, end);
  return `${startLabel} – ${endLabel}${duration ? ` (${duration} min)` : ''}`;
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatTimeAgo(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function truncateText(value, max = 90) {
  if (!value) return '';
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function getHoldInfo(createdAt, pendingHours) {
  const hours = Number(pendingHours);
  if (!createdAt || !hours || hours <= 0) {
    return null;
  }
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) {
    return null;
  }
  const expires = new Date(created.getTime() + hours * 60 * 60 * 1000);
  const hoursRemaining = Math.max(0, Math.ceil((expires.getTime() - Date.now()) / (60 * 60 * 1000)));
  return { expires, hoursRemaining };
}

function renderHoldExpiry(createdAt, pendingHours) {
  const info = getHoldInfo(createdAt, pendingHours);
  if (!info) {
    return 'soon';
  }
  return `${formatDateTime(info.expires.toISOString())} (~${info.hoursRemaining}h remaining)`;
}

function formatMetadata(value) {
  if (!value) return '—';
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || Object.keys(parsed).length === 0) {
      return '—';
    }
    return Object.entries(parsed)
      .map(([key, val]) => `${key}: ${val}`)
      .join(', ');
  } catch (err) {
    return '—';
  }
}

export default App;
