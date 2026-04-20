import { Suspense, createContext, lazy, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const ADMIN_BASE = '/admin';
const RichTextEditorImpl = lazy(() => import('./RichTextEditor'));

const api = axios.create({
  baseURL: '/api/admin',
  withCredentials: true,
});

const AuthContext = createContext(null);
const DirtyStateContext = createContext({
  isDirty: false,
  setDirtyState: () => {},
  clearDirty: () => {},
  confirmNavigation: () => true,
});

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

  const login = async (identifier, password) => {
    const response = await api.post('/login', { identifier, password });
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

function DirtyStateProvider({ children }) {
  const [state, setState] = useState({
    isDirty: false,
    message: 'You have unsaved changes. Leave without saving?',
  });

  useEffect(() => {
    if (!state.isDirty) {
      return undefined;
    }

    const beforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = state.message;
      return state.message;
    };

    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [state]);

  const setDirtyState = useCallback((next) => {
    setState((current) => ({
      isDirty: Boolean(next?.isDirty),
      message: next?.message || current.message || 'You have unsaved changes. Leave without saving?',
    }));
  }, []);

  const clearDirty = useCallback(() => {
    setState((current) => ({ ...current, isDirty: false }));
  }, []);

  const confirmNavigation = useCallback(() => {
    if (!state.isDirty) {
      return true;
    }

    const shouldLeave = window.confirm(state.message || 'You have unsaved changes. Leave without saving?');
    if (shouldLeave) {
      setState((current) => ({ ...current, isDirty: false }));
    }

    return shouldLeave;
  }, [state.isDirty, state.message]);

  return (
    <DirtyStateContext.Provider value={{ ...state, setDirtyState, clearDirty, confirmNavigation }}>
      {children}
    </DirtyStateContext.Provider>
  );
}

function useAdminDirtyState() {
  return useContext(DirtyStateContext);
}

function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="card">Checking your session…</div>;
  }
  if (!user) {
    return <Navigate to={`${ADMIN_BASE}/login`} replace />;
  }
  return <Outlet />;
}

const NAV_ITEMS = [
  { path: `${ADMIN_BASE}/dashboard`, label: 'Dashboard', section: 'dashboard' },
  { path: `${ADMIN_BASE}/booking`, label: 'Booking Requests', section: 'booking' },
  { path: `${ADMIN_BASE}/schedule`, label: 'Schedule Setup', section: 'schedule' },
  { path: `${ADMIN_BASE}/services`, label: 'Services', section: 'services' },
  { path: `${ADMIN_BASE}/reviews`, label: 'Reviews', section: 'reviews' },
  { path: `${ADMIN_BASE}/gallery`, label: 'Gallery', section: 'gallery' },
  { path: `${ADMIN_BASE}/content`, label: 'Text & Site Info', section: 'content' },
  { path: `${ADMIN_BASE}/contacts`, label: 'Contact Inbox', section: 'contact_messages' },
  { path: `${ADMIN_BASE}/media`, label: 'Media', section: 'media' },
  { path: `${ADMIN_BASE}/retail`, label: 'Products', section: 'retail' },
  { path: `${ADMIN_BASE}/audit`, label: 'Audit Log', section: 'audit' },
  { path: `${ADMIN_BASE}/users`, label: 'Admin Users', section: 'users', superOnly: true },
  { path: `${ADMIN_BASE}/calendar-sync`, label: 'Calendar Sync', section: 'system' },
  { path: `${ADMIN_BASE}/system`, label: 'System', section: 'system' },
];


function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <DirtyStateProvider>
          <Routes>
            <Route path="/" element={<Navigate to={`${ADMIN_BASE}/login`} replace />} />
            <Route path="/login" element={<Navigate to={`${ADMIN_BASE}/login`} replace />} />
            <Route element={<RequireAuth />}>
              <Route element={<AdminLayout />}>
                <Route path={ADMIN_BASE} element={<Navigate to={`${ADMIN_BASE}/dashboard`} replace />} />
                <Route path={`${ADMIN_BASE}/dashboard`} element={<DashboardPage />} />
                <Route path={`${ADMIN_BASE}/booking`} element={<BookingRequestsPage />} />
                <Route path={`${ADMIN_BASE}/schedule`} element={<SchedulePage />} />
                <Route path={`${ADMIN_BASE}/services`} element={<ServicesPage />} />
                <Route path={`${ADMIN_BASE}/reviews`} element={<FeaturedReviewsPage />} />
                <Route path={`${ADMIN_BASE}/gallery`} element={<GalleryPage />} />
                <Route path={`${ADMIN_BASE}/happy-clients`} element={<Navigate to={`${ADMIN_BASE}/gallery`} replace />} />
                <Route path={`${ADMIN_BASE}/retail`} element={<RetailPage />} />
                <Route path={`${ADMIN_BASE}/content`} element={<ContentPage />} />
                <Route path={`${ADMIN_BASE}/contacts`} element={<ContactMessagesPage />} />
                <Route path={`${ADMIN_BASE}/media`} element={<MediaPage />} />
                <Route path={`${ADMIN_BASE}/audit`} element={<AuditLogPage />} />
                <Route path={`${ADMIN_BASE}/users`} element={<AdminUsersPage />} />
                <Route path={`${ADMIN_BASE}/calendar-sync`} element={<CalendarSyncPage />} />
                <Route path={`${ADMIN_BASE}/system`} element={<SystemPage />} />
              </Route>
            </Route>
            <Route path={`${ADMIN_BASE}/login`} element={<LoginPage />} />
            <Route path="*" element={<Navigate to={`${ADMIN_BASE}/login`} replace />} />
          </Routes>
        </DirtyStateProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

function AdminLayout() {
  const { user, allowedSections, logout } = useAuth();
  const { confirmNavigation } = useAdminDirtyState();
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
    if (!confirmNavigation()) {
      return;
    }
    await logout();
    navigate(`${ADMIN_BASE}/login`);
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
            <Link
              key={item.path}
              to={item.path}
              className="admin-nav__link"
              onClick={(event) => {
                if (!confirmNavigation()) {
                  event.preventDefault();
                }
              }}
            >
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
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await login(form.identifier, form.password);
      navigate(`${ADMIN_BASE}/dashboard`);
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Login failed.');
    }
  };

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#f5f4f1' }}>
      <form className="card" onSubmit={submit} style={{ minWidth: '320px' }}>
        <h2>Admin Login</h2>
        <div className="field-block">
          <label htmlFor="admin-identifier">Email or username</label>
          <input
            id="admin-identifier"
            type="text"
            value={form.identifier}
            onChange={(e) => setForm((prev) => ({ ...prev, identifier: e.target.value }))}
            autoComplete="username"
          />
        </div>
        <div className="field-block" style={{ marginTop: '0.75rem' }}>
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            autoComplete="current-password"
          />
        </div>
        {error && <p role="alert" style={{ color: '#b83232' }}>{error}</p>}
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
  const [notesDirty, setNotesDirty] = useState(false);
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
    if (!window.confirm(prompts[action])) {
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
    if (!window.confirm('Release this hold and free the slot? This will cancel the pending request.')) {
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

function normalizeAdminTimeInput(value) {
  const raw = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!raw) {
    return null;
  }

  let match = raw.match(/^(\d{1,2})(\d{2})$/);
  if (match) {
    return normalizeAdminTimeParts(Number(match[1]), Number(match[2]), null);
  }

  match = raw.match(/^(\d{1,2})(?::?(\d{2}))?(AM|PM)$/);
  if (match) {
    return normalizeAdminTimeParts(Number(match[1]), Number(match[2] || 0), match[3]);
  }

  match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    return normalizeAdminTimeParts(Number(match[1]), Number(match[2]), null);
  }

  match = raw.match(/^(\d{1,2})$/);
  if (match) {
    return normalizeAdminTimeParts(Number(match[1]), 0, null);
  }

  return null;
}

function normalizeAdminTimeParts(hour, minutes, suffix) {
  if (minutes < 0 || minutes > 59) {
    return null;
  }

  let nextHour = hour;
  if (suffix) {
    if (hour < 1 || hour > 12) {
      return null;
    }
    if (suffix === 'AM') {
      nextHour = hour === 12 ? 0 : hour;
    } else {
      nextHour = hour === 12 ? 12 : hour + 12;
    }
  } else if (hour < 0 || hour > 23) {
    return null;
  }

  return `${String(nextHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

function sortScheduleTimes(times) {
  return Array.from(new Set((times || []).map((time) => normalizeAdminTimeInput(time)).filter(Boolean))).sort();
}

function formatScheduleTime(value) {
  const normalized = normalizeAdminTimeInput(value);
  if (!normalized) {
    return value;
  }

  const [hourRaw, minuteRaw] = normalized.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const meridiem = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${meridiem}`;
}

function timeValueToMinutes(value) {
  const normalized = normalizeAdminTimeInput(value);
  if (!normalized) {
    return null;
  }

  const [hourRaw, minuteRaw] = normalized.split(':');
  return Number(hourRaw) * 60 + Number(minuteRaw);
}

function minutesToScheduleValue(totalMinutes) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

function buildScheduleTimeOptions(slotMinutes, start = '07:00', end = '20:00') {
  const startMinutes = timeValueToMinutes(start);
  const endMinutes = timeValueToMinutes(end);
  if (startMinutes === null || endMinutes === null || endMinutes < startMinutes) {
    return [];
  }

  const options = [];
  for (let cursor = startMinutes; cursor <= endMinutes; cursor += slotMinutes) {
    options.push(minutesToScheduleValue(cursor));
  }

  return options;
}

function toggleScheduleTime(times, value) {
  const normalized = normalizeAdminTimeInput(value);
  if (!normalized) {
    return sortScheduleTimes(times);
  }

  return times.includes(normalized)
    ? times.filter((time) => time !== normalized)
    : sortScheduleTimes([...(times || []), normalized]);
}

function SchedulePage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [settings, setSettings] = useState({ booking_hold_minutes: 1440, booking_pending_expire_hours: 24 });
  const [timeDrafts, setTimeDrafts] = useState({});
  const [overrideTimeDraft, setOverrideTimeDraft] = useState('');
  const [overrideForm, setOverrideForm] = useState({ id: null, date: '', is_closed: false, times: [] });
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [builder, setBuilder] = useState({ start: '09:00', end: '17:00', weekdays: [1, 2, 3, 4, 5], replaceExisting: true });
  const [feedback, setFeedback] = useState(null);
  const timeOptions = useMemo(() => buildScheduleTimeOptions(slotMinutes), [slotMinutes]);

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
    if (!window.confirm('Delete this override?')) return;
    await api.delete(`/schedule/overrides/${id}`);
    load();
  };

  const canDeleteOverride = user?.role === 'super_admin';

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

function ServicesPage() {
  const defaultForm = {
    id: null,
    name: '',
    short_summary: '',
    description: '',
    duration_minutes: 60,
    price_label: '',
    breed_weight_note: '',
    sort_order: 0,
    is_active: true,
  };

  const [items, setItems] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [feedback, setFeedback] = useState(null);

  const load = useCallback(async () => {
    const response = await api.get('/services');
    setItems(response.data.data.items || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (event) => {
    event.preventDefault();
    try {
      await api.post('/services', {
        ...form,
        duration_minutes: Number(form.duration_minutes) || 30,
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active ? 1 : 0,
      });
      setForm(defaultForm);
      setFeedback({ tone: 'success', message: 'Service saved.' });
      load();
    } catch (err) {
      setFeedback({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to save service.' });
    }
  };

  const edit = (item) => {
    setFeedback(null);
    setForm({
      id: item.id,
      name: item.name,
      short_summary: item.short_summary || '',
      description: item.description || '',
      duration_minutes: item.duration_minutes || 60,
      price_label: item.price_label || '',
      breed_weight_note: item.breed_weight_note || '',
      sort_order: item.sort_order || 0,
      is_active: Boolean(item.is_active),
    });
  };

  return (
    <div>
      <h1>Services</h1>
      <p className="muted">Manage the live services used on the public site and in booking duration calculations.</p>
      <form className="card stack gap-sm" onSubmit={save}>
        <div className="grid two-col gap-sm">
          <label className="field-block">
            <span className="field-label">Service name</span>
            <input id="service-name" placeholder="Full service name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
          </label>
          <label className="field-block">
            <span className="field-label">Duration in minutes</span>
            <input
              id="service-duration"
              type="number"
              min="15"
              step="15"
              placeholder="60"
              value={form.duration_minutes}
              onChange={(e) => setForm((prev) => ({ ...prev, duration_minutes: e.target.value }))}
            />
          </label>
        </div>
        <label className="field-block">
          <span className="field-label">Short summary</span>
          <textarea
            id="service-summary"
            placeholder="Short summary for accordions and cards"
            value={form.short_summary}
            onChange={(e) => setForm((prev) => ({ ...prev, short_summary: e.target.value }))}
          />
        </label>
        <div className="field-block">
          <span className="field-label">Expanded description</span>
          <RichTextEditor value={form.description} onChange={(value) => setForm((prev) => ({ ...prev, description: value }))} />
        </div>
        <div className="grid two-col gap-sm">
          <label className="field-block">
            <span className="field-label">Pricing label</span>
            <input id="service-price-label" placeholder="Starts at $65" value={form.price_label} onChange={(e) => setForm((prev) => ({ ...prev, price_label: e.target.value }))} />
          </label>
          <label className="field-block">
            <span className="field-label">Breed or weight note</span>
            <input
              id="service-breed-note"
              placeholder="Optional note for sizing or coat needs"
              value={form.breed_weight_note}
              onChange={(e) => setForm((prev) => ({ ...prev, breed_weight_note: e.target.value }))}
            />
          </label>
        </div>
        <div className="grid two-col gap-sm">
          <label className="field-block">
            <span className="field-label">Display order</span>
            <input
              id="service-sort-order"
              type="number"
              placeholder="0"
              value={form.sort_order}
              onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))}
            />
          </label>
          <label className="toggle">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))} /> Active
          </label>
        </div>
        <div className="form-actions">
          <button className="btn">{form.id ? 'Update Service' : 'Save Service'}</button>
          {form.id && (
            <button type="button" className="btn btn-link" onClick={() => setForm(defaultForm)}>
              Cancel edit
            </button>
          )}
          {feedback && <p role={feedback.tone === 'error' ? 'alert' : 'status'} className={`save-feedback ${feedback.tone === 'error' ? 'is-error' : 'is-success'}`}>{feedback.message}</p>}
        </div>
      </form>

      <div className="card-grid">
        {items.map((item) => (
          <div key={item.id} className="card">
            <div className="booking-card__header">
              <strong>{item.name}</strong>
              <span className={`status-badge ${item.is_active ? 'status-confirmed' : 'status-expired'}`}>{item.is_active ? 'Active' : 'Hidden'}</span>
            </div>
            <p className="muted">{item.short_summary}</p>
            <p className="small-text">
              {item.duration_minutes} min · {item.price_label || 'Pricing note not set'}
            </p>
            <p className="small-text muted">{item.breed_weight_note || 'No breed/weight note'}</p>
            <p className="small-text muted">Display order: {item.sort_order ?? 0}</p>
            <button type="button" className="btn btn-tertiary" onClick={() => edit(item)}>
              Edit service
            </button>
          </div>
        ))}
        {items.length === 0 && <div className="card">No services configured yet. Add a service here to make it available on the site and in booking requests.</div>}
      </div>
    </div>
  );
}

function FeaturedReviewsPage() {
  const defaultForm = {
    id: null,
    reviewer_name: '',
    review_text: '',
    star_rating: 5,
    source_label: 'Google',
    source_url: '',
    display_order: 0,
    is_featured: true,
  };

  const [items, setItems] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [feedback, setFeedback] = useState(null);

  const load = useCallback(async () => {
    const response = await api.get('/reviews');
    setItems(response.data.data.items || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (event) => {
    event.preventDefault();
    try {
      await api.post('/reviews', {
        ...form,
        star_rating: Number(form.star_rating) || 5,
        display_order: Number(form.display_order) || 0,
        is_featured: form.is_featured ? 1 : 0,
      });
      setForm(defaultForm);
      setFeedback({ tone: 'success', message: 'Featured review saved.' });
      load();
    } catch (err) {
      setFeedback({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to save featured review.' });
    }
  };

  const edit = (item) => {
    setFeedback(null);
    setForm({
      id: item.id,
      reviewer_name: item.reviewer_name,
      review_text: item.review_text,
      star_rating: item.star_rating || 5,
      source_label: item.source_label || 'Google',
      source_url: item.source_url || '',
      display_order: item.display_order || 0,
      is_featured: Boolean(item.is_featured),
    });
  };

  return (
    <div>
      <h1>Featured Reviews</h1>
      <p className="muted">Feature real review excerpts here. This does not create a public review submission form.</p>
      <form className="card stack gap-sm" onSubmit={save}>
        <div className="grid two-col gap-sm">
          <label className="field-block">
            <span className="field-label">Reviewer name</span>
            <input
              id="reviewer-name"
              placeholder="Name shown publicly"
              value={form.reviewer_name}
              onChange={(e) => setForm((prev) => ({ ...prev, reviewer_name: e.target.value }))}
              required
            />
          </label>
          <label className="field-block">
            <span className="field-label">Star rating</span>
            <select id="review-star-rating" value={form.star_rating} onChange={(e) => setForm((prev) => ({ ...prev, star_rating: e.target.value }))}>
              {[5, 4, 3, 2, 1].map((rating) => (
                <option key={rating} value={rating}>
                  {rating} stars
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field-block">
          <span className="field-label">Review excerpt</span>
          <textarea
            id="review-excerpt"
            placeholder="Short excerpt approved for the public site"
            value={form.review_text}
            onChange={(e) => setForm((prev) => ({ ...prev, review_text: e.target.value }))}
            required
          />
        </label>
        <div className="grid two-col gap-sm">
          <label className="field-block">
            <span className="field-label">Source label</span>
            <input id="review-source-label" placeholder="Google" value={form.source_label} onChange={(e) => setForm((prev) => ({ ...prev, source_label: e.target.value }))} />
          </label>
          <label className="field-block">
            <span className="field-label">Source URL</span>
            <input id="review-source-url" placeholder="Optional review link" value={form.source_url} onChange={(e) => setForm((prev) => ({ ...prev, source_url: e.target.value }))} />
          </label>
        </div>
        <div className="grid two-col gap-sm">
          <label className="field-block">
            <span className="field-label">Display order</span>
            <input
              id="review-display-order"
              type="number"
              placeholder="0"
              value={form.display_order}
              onChange={(e) => setForm((prev) => ({ ...prev, display_order: e.target.value }))}
            />
          </label>
          <label className="toggle">
            <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm((prev) => ({ ...prev, is_featured: e.target.checked }))} /> Featured
          </label>
        </div>
        <div className="form-actions">
          <button className="btn">{form.id ? 'Update Review' : 'Save Review'}</button>
          {form.id && (
            <button type="button" className="btn btn-link" onClick={() => setForm(defaultForm)}>
              Cancel edit
            </button>
          )}
          {feedback && <p role={feedback.tone === 'error' ? 'alert' : 'status'} className={`save-feedback ${feedback.tone === 'error' ? 'is-error' : 'is-success'}`}>{feedback.message}</p>}
        </div>
      </form>

      <div className="card-grid">
        {items.map((item) => (
          <div key={item.id} className="card">
            <div className="booking-card__header">
              <strong>{item.reviewer_name}</strong>
              <span className="small-text">{'★'.repeat(item.star_rating)}</span>
            </div>
            <p>{item.review_text}</p>
            <p className="small-text muted">
              {item.source_label}
              {item.source_url ? ' · Linked' : ''}
            </p>
            <p className="small-text muted">
              Display order: {item.display_order ?? 0} · {item.is_featured ? 'Visible' : 'Hidden'}
            </p>
            <button type="button" className="btn btn-tertiary" onClick={() => edit(item)}>
              Edit review
            </button>
          </div>
        ))}
        {items.length === 0 && <div className="card">No featured reviews added yet. Add real review excerpts here when you are ready to feature them.</div>}
      </div>
    </div>
  );
}

function GalleryPage() {
  const defaultForm = {
    id: null,
    title: '',
    caption: '',
    item_type: 'groomed_pet',
    primary_media: null,
    secondary_media: null,
    sort_order: 0,
    is_published: true,
  };

  const [items, setItems] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [feedback, setFeedback] = useState(null);

  const load = useCallback(async () => {
    const response = await api.get('/gallery-items');
    setItems(response.data.data.items || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (event) => {
    event.preventDefault();
    try {
      await api.post('/gallery-items', {
        id: form.id || undefined,
        title: form.title,
        caption: form.caption,
        item_type: form.item_type,
        primary_media_id: form.primary_media?.id ?? null,
        secondary_media_id: form.secondary_media?.id ?? null,
        sort_order: Number(form.sort_order) || 0,
        is_published: form.is_published ? 1 : 0,
      });
      setForm(defaultForm);
      setFeedback({ tone: 'success', message: 'Gallery item saved.' });
      load();
    } catch (err) {
      setFeedback({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to save gallery item.' });
    }
  };

  const edit = (item) => {
    setFeedback(null);
    setForm({
      id: item.id,
      title: item.title,
      caption: item.caption || '',
      item_type: item.item_type || 'groomed_pet',
      primary_media: item.primary_media || null,
      secondary_media: item.secondary_media || null,
      sort_order: item.sort_order || 0,
      is_published: Boolean(item.is_published),
    });
  };

  return (
    <div>
      <h1>Gallery</h1>
      <p className="muted">Choose the media shown in the public gallery, before/after blocks, and trust-building photo sections.</p>
      <form className="card stack gap-sm" onSubmit={save}>
        <div className="grid two-col gap-sm">
          <label className="field-block">
            <span className="field-label">Title</span>
            <input id="gallery-title" placeholder="Public title for this item" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} required />
          </label>
          <label className="field-block">
            <span className="field-label">Item type</span>
            <select id="gallery-item-type" value={form.item_type} onChange={(e) => setForm((prev) => ({ ...prev, item_type: e.target.value }))}>
              <option value="groomed_pet">Groomed Pet</option>
              <option value="before_after">Before / After</option>
              <option value="facility">Facility</option>
              <option value="boutique">Boutique</option>
            </select>
          </label>
        </div>
        <label className="field-block">
          <span className="field-label">Caption</span>
          <textarea id="gallery-caption" placeholder="Optional supporting caption" value={form.caption} onChange={(e) => setForm((prev) => ({ ...prev, caption: e.target.value }))} />
        </label>
        <MediaPicker label="Primary image" media={form.primary_media} onChange={(media) => setForm((prev) => ({ ...prev, primary_media: media }))} />
        <MediaPicker label="Secondary image (optional)" media={form.secondary_media} onChange={(media) => setForm((prev) => ({ ...prev, secondary_media: media }))} />
        <div className="grid two-col gap-sm">
          <label className="field-block">
            <span className="field-label">Display order</span>
            <input
              id="gallery-sort-order"
              type="number"
              placeholder="0"
              value={form.sort_order}
              onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))}
            />
          </label>
          <label className="toggle">
            <input type="checkbox" checked={form.is_published} onChange={(e) => setForm((prev) => ({ ...prev, is_published: e.target.checked }))} /> Published
          </label>
        </div>
        <div className="form-actions">
          <button className="btn">{form.id ? 'Update Item' : 'Save Item'}</button>
          {form.id && (
            <button type="button" className="btn btn-link" onClick={() => setForm(defaultForm)}>
              Cancel edit
            </button>
          )}
          {feedback && <p role={feedback.tone === 'error' ? 'alert' : 'status'} className={`save-feedback ${feedback.tone === 'error' ? 'is-error' : 'is-success'}`}>{feedback.message}</p>}
        </div>
      </form>

      <div className="card-grid">
        {items.map((item) => (
          <div key={item.id} className="card">
            <div className="happy-preview">
              {item.primary_media && <img src={item.primary_media.fallback_url || item.primary_media.original_url} alt={item.title} />}
              {item.secondary_media && <img src={item.secondary_media.fallback_url || item.secondary_media.original_url} alt={item.title} />}
            </div>
            <strong>{item.title}</strong>
            <p className="muted">{item.caption}</p>
            <p className="small-text">
              {item.item_type} · {item.is_published ? 'Published' : 'Hidden'}
            </p>
            <p className="small-text muted">Display order: {item.sort_order ?? 0}</p>
            <button type="button" className="btn btn-tertiary" onClick={() => edit(item)}>
              Edit item
            </button>
          </div>
        ))}
        {items.length === 0 && <div className="card">No gallery items yet. Add published media items to show photos on the public site.</div>}
      </div>
    </div>
  );
}

function ContactMessagesPage() {
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    const response = await api.get('/contact-messages');
    setItems(response.data.data.items || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="page-header">
        <h1>Contact Inbox</h1>
        <div className="page-toolbar">
          <button className="btn btn-tertiary" onClick={load}>
            Refresh
          </button>
        </div>
      </div>
      <p className="muted">General contact messages live here only. Booking requests stay in the booking queue.</p>
      <div className="booking-list">
        {items.map((item) => (
          <div key={item.id} className="card">
            <div className="booking-card__header">
              <strong>{item.name}</strong>
              <span className="small-text muted">{formatDateTime(item.created_at)}</span>
            </div>
            <p className="small-text">{item.email}</p>
            {item.phone && <p className="small-text">{item.phone}</p>}
            <p>{item.message}</p>
          </div>
        ))}
        {items.length === 0 && <div className="card">No contact messages yet. Messages from the public contact form will appear here.</div>}
      </div>
    </div>
  );
}

function createRetailCategoryForm() {
  return {
    id: null,
    name: '',
    is_published: true,
  };
}

const DEFAULT_RETAIL_PRODUCT_OPTIONS = {
  online_sale_status: [
    { value: 'catalog_only', label: 'Catalog only for now' },
    { value: 'ready', label: 'Okay to sell online later' },
    { value: 'in_store_only', label: 'Keep in-store only' },
  ],
  inventory_status: [
    { value: 'untracked', label: 'Not tracked yet' },
    { value: 'in_stock', label: 'In stock' },
    { value: 'limited', label: 'Low or limited' },
    { value: 'out_of_stock', label: 'Out of stock' },
  ],
  fulfillment_mode: [
    { value: 'undecided', label: 'Undecided' },
    { value: 'pickup_only', label: 'Pickup only' },
    { value: 'ship_or_pickup', label: 'Can ship or pickup' },
  ],
};

function createRetailProductForm(categoryId = '') {
  return {
    id: null,
    category_id: categoryId ? String(categoryId) : '',
    name: '',
    sku: '',
    description: '',
    price: '',
    media: null,
    online_sale_status: 'catalog_only',
    inventory_status: 'untracked',
    fulfillment_mode: 'undecided',
    is_published: true,
  };
}

function RetailPage() {
  const [categories, setCategories] = useState([]);
  const [commerce, setCommerce] = useState({ mode: 'catalog_only', mode_label: 'Catalog only', checkout_enabled: false });
  const [productOptions, setProductOptions] = useState(DEFAULT_RETAIL_PRODUCT_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [categoryForm, setCategoryForm] = useState(createRetailCategoryForm());
  const [productForm, setProductForm] = useState(createRetailProductForm());
  const [categoryFeedback, setCategoryFeedback] = useState(null);
  const [productFeedback, setProductFeedback] = useState(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/retail');
      setCategories(response.data.data.categories || []);
      setCommerce(response.data.data.commerce || { mode: 'catalog_only', mode_label: 'Catalog only', checkout_enabled: false });
      setProductOptions(response.data.data.product_options || DEFAULT_RETAIL_PRODUCT_OPTIONS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (productForm.id || productForm.category_id || categories.length === 0) {
      return;
    }

    setProductForm((current) => ({
      ...current,
      category_id: String(categories[0].id),
    }));
  }, [categories, productForm.category_id, productForm.id]);

  const resetCategoryForm = () => {
    setCategoryForm(createRetailCategoryForm());
  };

  const resetProductForm = (nextCategoryId = '') => {
    const fallbackCategoryId = nextCategoryId || (categories[0] ? String(categories[0].id) : '');
    setProductForm(createRetailProductForm(fallbackCategoryId));
  };

  const saveCategory = async (event) => {
    event.preventDefault();
    setSavingCategory(true);
    setCategoryFeedback(null);

    try {
      const response = await api.post('/retail/categories', {
        id: categoryForm.id || undefined,
        name: categoryForm.name,
        is_published: categoryForm.is_published ? 1 : 0,
      });

      const savedCategory = response.data.data.category;
      await load();
      resetCategoryForm();
      setCategoryFeedback({
        tone: 'success',
        message: categoryForm.id ? 'Category updated.' : 'Category created.',
      });
      setProductForm((current) => {
        if (current.category_id) {
          return current;
        }

        return {
          ...current,
          category_id: String(savedCategory.id),
        };
      });
    } catch (err) {
      setCategoryFeedback({
        tone: 'error',
        message: err.response?.data?.error?.message ?? 'Unable to save category.',
      });
    } finally {
      setSavingCategory(false);
    }
  };

  const saveProduct = async (event) => {
    event.preventDefault();
    setSavingProduct(true);
    setProductFeedback(null);

    try {
      const response = await api.post('/retail', {
        id: productForm.id || undefined,
        category_id: productForm.category_id ? Number(productForm.category_id) : null,
        name: productForm.name,
        sku: productForm.sku,
        description: productForm.description,
        price_cents: productForm.price ? Math.round(Number(productForm.price) * 100) : null,
        media_id: productForm.media?.id ?? null,
        online_sale_status: productForm.online_sale_status,
        inventory_status: productForm.inventory_status,
        fulfillment_mode: productForm.fulfillment_mode,
        is_published: productForm.is_published ? 1 : 0,
      });

      const savedItem = response.data.data.item;
      await load();
      resetProductForm(savedItem.category_id ? String(savedItem.category_id) : '');
      setProductFeedback({
        tone: 'success',
        message: productForm.id ? 'Product updated.' : 'Product saved.',
      });
    } catch (err) {
      setProductFeedback({
        tone: 'error',
        message: err.response?.data?.error?.message ?? 'Unable to save product.',
      });
    } finally {
      setSavingProduct(false);
    }
  };

  const editCategory = (category) => {
    setCategoryFeedback(null);
    setCategoryForm({
      id: category.id,
      name: category.name,
      is_published: Boolean(category.is_published),
    });
  };

  const editProduct = (item) => {
    setProductFeedback(null);
    setProductForm({
      id: item.id,
      category_id: item.category_id ? String(item.category_id) : '',
      name: item.name,
      sku: item.sku || '',
      description: item.description ?? '',
      price: item.price_cents ? (item.price_cents / 100).toFixed(2) : '',
      media: item.media ?? null,
      online_sale_status: item.online_sale_status || 'catalog_only',
      inventory_status: item.inventory_status || 'untracked',
      fulfillment_mode: item.fulfillment_mode || 'undecided',
      is_published: Boolean(item.is_published),
    });
  };

  const startProductForCategory = (categoryId) => {
    setProductFeedback(null);
    setProductForm(createRetailProductForm(String(categoryId)));
  };

  const deleteCategory = async (category) => {
    if (!window.confirm(`Delete "${category.name}"? Categories can only be deleted when they are empty.`)) {
      return;
    }

    setCategoryFeedback(null);
    const remainingCategoryId = categories.find((item) => item.id !== category.id)?.id;
    try {
      await api.delete(`/retail/categories/${category.id}`);
      await load();
      if (categoryForm.id === category.id) {
        resetCategoryForm();
      }
      if (productForm.category_id === String(category.id)) {
        resetProductForm(remainingCategoryId ? String(remainingCategoryId) : '');
      }
      setCategoryFeedback({ tone: 'success', message: 'Category deleted.' });
    } catch (err) {
      setCategoryFeedback({
        tone: 'error',
        message: err.response?.data?.error?.message ?? 'Unable to delete category.',
      });
    }
  };

  const deleteProduct = async (item) => {
    if (!window.confirm(`Delete "${item.name}"?`)) {
      return;
    }

    setProductFeedback(null);
    try {
      await api.delete(`/retail/items/${item.id}`);
      await load();
      if (productForm.id === item.id) {
        resetProductForm(item.category_id ? String(item.category_id) : '');
      }
      setProductFeedback({ tone: 'success', message: 'Product deleted.' });
    } catch (err) {
      setProductFeedback({
        tone: 'error',
        message: err.response?.data?.error?.message ?? 'Unable to delete product.',
      });
    }
  };

  const totalProducts = categories.reduce((sum, category) => sum + (category.items?.length || 0), 0);

  return (
    <div className="stack gap-md">
      <div className="page-header">
        <div>
          <h1>Products</h1>
          <p className="muted">Create simple categories, add products under each one, and the public site updates automatically.</p>
        </div>
      </div>

      <div className="card">
        <strong>Online sales are not live yet.</strong>
        <p className="muted small-text" style={{ margin: '0.5rem 0 0' }}>
          Current shop mode: {commerce.mode_label}. The extra sales-prep fields below are optional groundwork only, so checkout can be added later without reshaping every product.
        </p>
      </div>

      <div className="retail-admin-layout">
        <form className="card stack gap-sm" data-retail-form="category" onSubmit={saveCategory}>
          <div>
            <h2>{categoryForm.id ? 'Edit category' : 'Add category'}</h2>
            <p className="muted small-text">Start with broad groups customers will recognize right away.</p>
          </div>
          <label className="field-block">
            <span className="field-label">Category name</span>
            <input
              placeholder="Shampoos & coat care"
              value={categoryForm.name}
              onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={categoryForm.is_published}
              onChange={(event) => setCategoryForm((current) => ({ ...current, is_published: event.target.checked }))}
            />
            Show this category on the site
          </label>
          <div className="form-actions">
            <button className="btn" disabled={savingCategory}>
              {savingCategory ? 'Saving…' : categoryForm.id ? 'Update category' : 'Save category'}
            </button>
            {categoryForm.id && (
              <button type="button" className="btn btn-link" onClick={resetCategoryForm}>
                Cancel edit
              </button>
            )}
          </div>
          {categoryFeedback && (
            <p
              role={categoryFeedback.tone === 'error' ? 'alert' : 'status'}
              className={`save-feedback ${categoryFeedback.tone === 'error' ? 'is-error' : 'is-success'}`}
            >
              {categoryFeedback.message}
            </p>
          )}
        </form>

        <form className="card stack gap-sm" data-retail-form="product" onSubmit={saveProduct}>
          <div>
            <h2>{productForm.id ? 'Edit product' : 'Add product'}</h2>
            <p className="muted small-text">Keep it simple: category, name, price, photo, and a short note if needed.</p>
          </div>
          {categories.length === 0 ? (
            <div className="inline-note">Create a category first, then products can be added underneath it.</div>
          ) : (
            <>
              <label className="field-block">
                <span className="field-label">Category</span>
                <select
                  value={productForm.category_id}
                  onChange={(event) => setProductForm((current) => ({ ...current, category_id: event.target.value }))}
                  required
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-block">
                <span className="field-label">Product name</span>
                <input
                  id="retail-product-name"
                  placeholder="Blueberry facial"
                  value={productForm.name}
                  onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </label>
              <label className="field-block">
                <span className="field-label">SKU (optional)</span>
                <input
                  placeholder="BWDS-BLUEBERRY-001"
                  value={productForm.sku}
                  onChange={(event) => setProductForm((current) => ({ ...current, sku: event.target.value }))}
                />
              </label>
              <div className="grid two-col gap-sm">
                <label className="field-block">
                  <span className="field-label">Price</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="Leave blank to hide the price"
                    value={productForm.price}
                    onChange={(event) => setProductForm((current) => ({ ...current, price: event.target.value }))}
                  />
                </label>
                <label className="toggle retail-toggle">
                  <input
                    type="checkbox"
                    checked={productForm.is_published}
                    onChange={(event) => setProductForm((current) => ({ ...current, is_published: event.target.checked }))}
                  />
                  Show this product on the site
                </label>
              </div>
              <label className="field-block">
                <span className="field-label">Short note</span>
                <textarea
                  placeholder="Optional details customers should know."
                  value={productForm.description}
                  onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))}
                />
              </label>
              <MediaPicker
                label="Product image"
                media={productForm.media}
                onChange={(media) => setProductForm((current) => ({ ...current, media }))}
                libraryCategory="retail"
                uploadCategory="retail"
              />
              <details className="retail-sales-prep">
                <summary>Future online sales prep</summary>
                <p className="muted small-text">Optional only. Leave these at the defaults until you actually decide to sell online.</p>
                <div className="grid two-col gap-sm">
                  <label className="field-block">
                    <span className="field-label">Online sales plan</span>
                    <select
                      value={productForm.online_sale_status}
                      onChange={(event) => setProductForm((current) => ({ ...current, online_sale_status: event.target.value }))}
                    >
                      {productOptions.online_sale_status.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-block">
                    <span className="field-label">Stock status</span>
                    <select
                      value={productForm.inventory_status}
                      onChange={(event) => setProductForm((current) => ({ ...current, inventory_status: event.target.value }))}
                    >
                      {productOptions.inventory_status.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-block">
                    <span className="field-label">Fulfillment later</span>
                    <select
                      value={productForm.fulfillment_mode}
                      onChange={(event) => setProductForm((current) => ({ ...current, fulfillment_mode: event.target.value }))}
                    >
                      {productOptions.fulfillment_mode.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </details>
              <div className="form-actions">
                <button className="btn" disabled={savingProduct}>
                  {savingProduct ? 'Saving…' : productForm.id ? 'Update product' : 'Save product'}
                </button>
                {productForm.id && (
                  <button type="button" className="btn btn-link" onClick={() => resetProductForm(productForm.category_id)}>
                    Cancel edit
                  </button>
                )}
              </div>
            </>
          )}
          {productFeedback && (
            <p
              role={productFeedback.tone === 'error' ? 'alert' : 'status'}
              className={`save-feedback ${productFeedback.tone === 'error' ? 'is-error' : 'is-success'}`}
            >
              {productFeedback.message}
            </p>
          )}
        </form>
      </div>

      <div className="retail-summary-bar">
        <div className="card">
          <strong>{categories.length}</strong>
          <p className="muted small-text">Categories</p>
        </div>
        <div className="card">
          <strong>{totalProducts}</strong>
          <p className="muted small-text">Products</p>
        </div>
      </div>

      {loading ? (
        <div className="card">Loading products…</div>
      ) : categories.length === 0 ? (
        <div className="card">No categories yet. Add the first category to start building the product section.</div>
      ) : (
        <div className="retail-category-stack">
          {categories.map((category) => (
            <article key={category.id} className="card retail-category-card">
              <div className="retail-category-card__header">
                <div>
                  <h3>{category.name}</h3>
                  <p className="muted small-text">
                    {category.is_published ? 'Visible on the site' : 'Hidden from the site'} · {category.items?.length || 0} product
                    {(category.items?.length || 0) === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="retail-inline-actions">
                  <button type="button" className="btn btn-tertiary" onClick={() => startProductForCategory(category.id)}>
                    Add product
                  </button>
                  <button type="button" className="btn btn-link" onClick={() => editCategory(category)}>
                    Edit
                  </button>
                  <button type="button" className="btn btn-link danger" onClick={() => deleteCategory(category)}>
                    Delete
                  </button>
                </div>
              </div>

              {category.items?.length ? (
                <div className="retail-product-list">
                  {category.items.map((item) => (
                    <div key={item.id} className="retail-product-row">
                      {item.media ? (
                        <img
                          className="retail-product-row__image"
                          src={item.media.fallback_url || item.media.original_url}
                          alt={item.media.alt_text || item.name}
                        />
                      ) : (
                        <div className="retail-product-row__placeholder" aria-hidden="true">
                          {item.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="retail-product-row__details">
                        <div className="retail-product-row__heading">
                          <strong>{item.name}</strong>
                          <span className="small-text muted">{item.price_label || 'Ask in spa'}</span>
                        </div>
                        {item.description ? <p className="muted small-text">{item.description}</p> : <p className="muted small-text">No extra notes.</p>}
                        <p className="small-text muted">{item.is_published ? 'Visible on the site' : 'Hidden from the site'}</p>
                      </div>
                      <div className="retail-inline-actions">
                        <button type="button" className="btn btn-link" onClick={() => editProduct(item)}>
                          Edit
                        </button>
                        <button type="button" className="btn btn-link danger" onClick={() => deleteProduct(item)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="inline-note">No products in this category yet.</div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function ContentPage() {
  const { setDirtyState, clearDirty } = useAdminDirtyState();
  const [settings, setSettings] = useState(null);
  const [sections, setSections] = useState(null);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  const currentSnapshot = useMemo(() => {
    if (!settings || !sections) {
      return '';
    }

    return JSON.stringify({ settings, sections });
  }, [sections, settings]);

  const isDirty = Boolean(savedSnapshot && currentSnapshot && currentSnapshot !== savedSnapshot);

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      try {
        const response = await api.get('/content/site');
        if (ignore) {
          return;
        }

        const nextSettings = response.data.data.settings || {};
        const nextSections = response.data.data.sections || {};
        const snapshot = JSON.stringify({ settings: nextSettings, sections: nextSections });

        setSettings(nextSettings);
        setSections(nextSections);
        setSavedSnapshot(snapshot);
        setStatus(null);
      } catch (err) {
        if (!ignore) {
          setStatus({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to load site content.' });
        }
      }
    };

    load();

    return () => {
      ignore = true;
      clearDirty();
    };
  }, [clearDirty]);

  useEffect(() => {
    setDirtyState({
      isDirty,
      message: 'You have unsaved text and site info changes. Leave without saving?',
    });
  }, [isDirty, setDirtyState]);

  useEffect(() => {
    if (isDirty && status?.tone === 'success') {
      setStatus(null);
    }
  }, [isDirty, status]);

  const updateSection = (key, updates) => {
    setStatus(null);
    setSections((prev) => ({
      ...prev,
      [key]: { ...(prev?.[key] || {}), ...updates },
    }));
  };

  const updateList = (key, items) => {
    updateSection(key, { items });
  };

  const restoreLastSaved = () => {
    if (!savedSnapshot) {
      return;
    }

    if (!window.confirm('Discard unsaved changes and restore the last saved version?')) {
      return;
    }

    const parsed = JSON.parse(savedSnapshot);
    setSettings(parsed.settings || {});
    setSections(parsed.sections || {});
    clearDirty();
    setStatus({ tone: 'success', message: 'Unsaved changes discarded.' });
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatus(null);

    try {
      await api.post('/content/site', { settings, sections });
      setSavedSnapshot(currentSnapshot);
      clearDirty();
      setStatus({ tone: 'success', message: 'Site content saved.' });
    } catch (err) {
      setStatus({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to save content.' });
    } finally {
      setSaving(false);
    }
  };

  if (!settings || !sections) {
    return <div className="card">{status?.message || 'Loading site content…'}</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Text & Site Info</h1>
          <p className="muted">Manage public-site copy, contact details, and section messaging without changing the site structure.</p>
        </div>
      </div>

      <form className="stack gap-md" onSubmit={save}>
        <div className="editor-savebar card">
          <div>
            <strong>{isDirty ? 'Unsaved changes' : 'All changes saved'}</strong>
            <p className="muted small-text">This page controls live public-site text and settings.</p>
          </div>
          <div className="editor-savebar__actions">
            {status && <p className={`save-feedback ${status.tone === 'error' ? 'is-error' : 'is-success'}`}>{status.message}</p>}
            {isDirty && (
              <button type="button" className="btn btn-tertiary" onClick={restoreLastSaved}>
                Discard unsaved changes
              </button>
            )}
            <button className="btn" disabled={saving}>
              {saving ? 'Saving…' : 'Save Content'}
            </button>
          </div>
        </div>

        <EditorSection title="Business Details" description="Phone, hours, address, map links, and public trust profile settings." initiallyOpen>
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
              <span className="field-label">Maps URL</span>
              <input value={settings.maps_url || ''} onChange={(e) => setSettings((prev) => ({ ...prev, maps_url: e.target.value }))} />
            </label>
            <label className="field-block">
              <span className="field-label">Google reviews URL</span>
              <input value={settings.google_reviews_url || ''} onChange={(e) => setSettings((prev) => ({ ...prev, google_reviews_url: e.target.value }))} />
            </label>
            <label className="field-block">
              <span className="field-label">Google rating</span>
              <input value={settings.google_review_rating || ''} onChange={(e) => setSettings((prev) => ({ ...prev, google_review_rating: e.target.value }))} />
            </label>
            <label className="field-block">
              <span className="field-label">Google review count</span>
              <input value={settings.google_review_count || ''} onChange={(e) => setSettings((prev) => ({ ...prev, google_review_count: e.target.value }))} />
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
        </EditorSection>

        <EditorSection title="Hero" description="First-screen headline, supporting copy, and primary CTA labels." initiallyOpen>
          <SectionEnabledToggle
            label="Show hero section"
            value={sections.hero?.enabled !== false}
            onChange={(enabled) => updateSection('hero', { enabled })}
          />
          <label className="field-block">
            <span className="field-label">Hero eyebrow</span>
            <input value={sections.hero?.eyebrow || ''} onChange={(e) => updateSection('hero', { eyebrow: e.target.value })} />
          </label>
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
        </EditorSection>

        <EditorSection title="Trust & Booking Messaging" description="Trust strip copy, booking intro text, and request-state messaging." initiallyOpen>
          <SectionEnabledToggle
            label="Show trust strip"
            value={sections.trust?.enabled !== false}
            onChange={(enabled) => updateSection('trust', { enabled })}
          />
          <label className="field-block">
            <span className="field-label">Trust section title</span>
            <input value={sections.trust?.title || ''} onChange={(e) => updateSection('trust', { title: e.target.value })} />
          </label>
          <div className="field-block">
            <span className="field-label">Trust intro</span>
            <RichTextEditor value={sections.trust?.intro || ''} onChange={(value) => updateSection('trust', { intro: value })} />
          </div>
          <ListEditor
            items={sections.trust?.points || []}
            onChange={(points) => updateSection('trust', { points })}
            fields={[
              { name: 'title', label: 'Point title' },
              { name: 'text', label: 'Point text' },
            ]}
          />
          <SectionEnabledToggle
            label="Show booking section"
            value={sections.booking?.enabled !== false}
            onChange={(enabled) => updateSection('booking', { enabled })}
          />
          <div className="field-block">
            <span className="field-label">Booking section title</span>
            <input value={sections.booking?.title || ''} onChange={(e) => updateSection('booking', { title: e.target.value })} />
          </div>
          <div className="field-block">
            <span className="field-label">Booking intro text</span>
            <RichTextEditor value={sections.booking?.intro || ''} onChange={(value) => updateSection('booking', { intro: value })} />
          </div>
          <div className="field-block">
            <span className="field-label">Booking notice</span>
            <RichTextEditor value={sections.booking?.notice || ''} onChange={(value) => updateSection('booking', { notice: value })} />
          </div>
          <div className="field-block">
            <span className="field-label">Availability helper</span>
            <RichTextEditor value={sections.booking?.availability_note || ''} onChange={(value) => updateSection('booking', { availability_note: value })} />
          </div>
        </EditorSection>

        <EditorSection title="Services" description="Service section intro and pricing/disclaimer copy.">
          <SectionEnabledToggle
            label="Show services section"
            value={sections.services?.enabled !== false}
            onChange={(enabled) => updateSection('services', { enabled })}
          />
          <div className="field-block">
            <span className="field-label">Section title</span>
            <input value={sections.services?.title || ''} onChange={(e) => updateSection('services', { title: e.target.value })} />
          </div>
          <div className="field-block">
            <span className="field-label">Intro copy</span>
            <RichTextEditor value={sections.services?.intro || ''} onChange={(value) => updateSection('services', { intro: value })} />
          </div>
          <div className="field-block">
            <span className="field-label">Pricing disclaimer</span>
            <RichTextEditor value={sections.services?.disclaimer || ''} onChange={(value) => updateSection('services', { disclaimer: value })} />
          </div>
        </EditorSection>

        <EditorSection title="Gallery & Reviews" description="Section headings and support copy for photo and trust modules.">
          <SectionEnabledToggle
            label="Show gallery section"
            value={sections.gallery?.enabled !== false}
            onChange={(enabled) => updateSection('gallery', { enabled })}
          />
          <label className="field-block">
            <span className="field-label">Gallery title</span>
            <input value={sections.gallery?.title || ''} onChange={(e) => updateSection('gallery', { title: e.target.value })} />
          </label>
          <div className="field-block">
            <span className="field-label">Gallery intro</span>
            <RichTextEditor value={sections.gallery?.intro || ''} onChange={(value) => updateSection('gallery', { intro: value })} />
          </div>
          <SectionEnabledToggle
            label="Show reviews section"
            value={sections.reviews?.enabled !== false}
            onChange={(enabled) => updateSection('reviews', { enabled })}
          />
          <label className="field-block">
            <span className="field-label">Reviews section title</span>
            <input value={sections.reviews?.title || ''} onChange={(e) => updateSection('reviews', { title: e.target.value })} />
          </label>
          <div className="field-block">
            <span className="field-label">Reviews intro</span>
            <RichTextEditor value={sections.reviews?.intro || ''} onChange={(value) => updateSection('reviews', { intro: value })} />
          </div>
          <label className="field-block">
            <span className="field-label">Reviews CTA label</span>
            <input value={sections.reviews?.cta_text || ''} onChange={(e) => updateSection('reviews', { cta_text: e.target.value })} />
          </label>
        </EditorSection>

        <EditorSection title="About" description="Care philosophy and reassuring neighborhood-boutique messaging.">
          <SectionEnabledToggle
            label="Show about section"
            value={sections.about?.enabled !== false}
            onChange={(enabled) => updateSection('about', { enabled })}
          />
          <label className="field-block">
            <span className="field-label">Section title</span>
            <input value={sections.about?.title || ''} onChange={(e) => updateSection('about', { title: e.target.value })} />
          </label>
          <div className="field-block">
            <span className="field-label">Body copy</span>
            <RichTextEditor value={sections.about?.body || ''} onChange={(value) => updateSection('about', { body: value })} />
          </div>
        </EditorSection>

        <EditorSection title="FAQ" description="Scannable answers shown on the public FAQ section.">
          <SectionEnabledToggle
            label="Show FAQ section"
            value={sections.faq?.enabled !== false}
            onChange={(enabled) => updateSection('faq', { enabled })}
          />
          <label className="field-block">
            <span className="field-label">Section title</span>
            <input value={sections.faq?.title || ''} onChange={(e) => updateSection('faq', { title: e.target.value })} />
          </label>
          <ListEditor
            items={sections.faq?.items || []}
            onChange={(items) => updateList('faq', items)}
            fields={[
              { name: 'question', label: 'Question' },
              { name: 'answer', label: 'Answer', rich: true },
            ]}
          />
        </EditorSection>

        <EditorSection title="Policies" description="Service policies, expectations, and care notes.">
          <SectionEnabledToggle
            label="Show policies section"
            value={sections.policies?.enabled !== false}
            onChange={(enabled) => updateSection('policies', { enabled })}
          />
          <label className="field-block">
            <span className="field-label">Section title</span>
            <input value={sections.policies?.title || ''} onChange={(e) => updateSection('policies', { title: e.target.value })} />
          </label>
          <ListEditor
            items={sections.policies?.items || []}
            onChange={(items) => updateList('policies', items)}
            fields={[
              { name: 'title', label: 'Policy Title' },
              { name: 'body', label: 'Policy Body', rich: true },
            ]}
          />
        </EditorSection>

        <EditorSection title="Location & Contact" description="Contact section labels, helpful notes, and local guidance.">
          <SectionEnabledToggle
            label="Show location note"
            value={sections.location?.enabled !== false}
            onChange={(enabled) => updateSection('location', { enabled })}
          />
          <label className="field-block">
            <span className="field-label">Location title</span>
            <input value={sections.location?.title || ''} onChange={(e) => updateSection('location', { title: e.target.value })} />
          </label>
          <div className="field-block">
            <span className="field-label">Location description</span>
            <RichTextEditor value={sections.location?.note || ''} onChange={(value) => updateSection('location', { note: value })} />
          </div>
          <SectionEnabledToggle
            label="Show contact section"
            value={sections.contact?.enabled !== false}
            onChange={(enabled) => updateSection('contact', { enabled })}
          />
          <label className="field-block">
            <span className="field-label">Contact title</span>
            <input value={sections.contact?.title || ''} onChange={(e) => updateSection('contact', { title: e.target.value })} />
          </label>
          <div className="field-block">
            <span className="field-label">Contact helper text</span>
            <RichTextEditor value={sections.contact?.note || ''} onChange={(value) => updateSection('contact', { note: value })} />
          </div>
        </EditorSection>

        <EditorSection title="Products Section" description="Public heading and intro copy shown above the live product categories.">
          <SectionEnabledToggle
            label="Show products section"
            value={sections.retail?.enabled !== false}
            onChange={(enabled) => updateSection('retail', { enabled })}
          />
          <label className="field-block">
            <span className="field-label">Section title</span>
            <input value={sections.retail?.title || ''} onChange={(e) => updateSection('retail', { title: e.target.value })} />
          </label>
          <div className="field-block">
            <span className="field-label">Section intro</span>
            <RichTextEditor value={sections.retail?.body || ''} onChange={(value) => updateSection('retail', { body: value })} />
          </div>
        </EditorSection>

        <EditorSection title="Footer" description="Short footer tagline shown alongside the site quick links.">
          <SectionEnabledToggle
            label="Show footer"
            value={sections.footer?.enabled !== false}
            onChange={(enabled) => updateSection('footer', { enabled })}
          />
          <label className="field-block">
            <span className="field-label">Footer tagline</span>
            <input value={sections.footer?.tagline || ''} onChange={(e) => updateSection('footer', { tagline: e.target.value })} />
          </label>
        </EditorSection>

        <EditorSection title="Legal Pages" description="Manage privacy and terms content plus whether those links appear publicly.">
          <SectionEnabledToggle
            label="Show privacy page"
            value={sections.privacy?.enabled !== false}
            onChange={(enabled) => updateSection('privacy', { enabled })}
          />
          <label className="field-block">
            <span className="field-label">Privacy page title</span>
            <input value={sections.privacy?.title || ''} onChange={(e) => updateSection('privacy', { title: e.target.value })} />
          </label>
          <ListEditor
            items={sections.privacy?.items || []}
            onChange={(items) => updateList('privacy', items)}
            fields={[
              { name: 'title', label: 'Privacy heading' },
              { name: 'body', label: 'Privacy body', rich: true },
            ]}
          />

          <SectionEnabledToggle
            label="Show terms page"
            value={sections.terms?.enabled !== false}
            onChange={(enabled) => updateSection('terms', { enabled })}
          />
          <label className="field-block">
            <span className="field-label">Terms page title</span>
            <input value={sections.terms?.title || ''} onChange={(e) => updateSection('terms', { title: e.target.value })} />
          </label>
          <ListEditor
            items={sections.terms?.items || []}
            onChange={(items) => updateList('terms', items)}
            fields={[
              { name: 'title', label: 'Terms heading' },
              { name: 'body', label: 'Terms body', rich: true },
            ]}
          />
        </EditorSection>
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
    if (!window.confirm('Delete this media item? This can remove it from gallery, reviews, or other public sections that reference it.')) {
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
      <form className="card" onSubmit={upload}>
        <label className="field-block">
          <span className="field-label">File</span>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0])} />
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
            <MediaPicture media={item} alt={item.alt_text || item.title || `Media ${item.id}`} />
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
    return <div className="card">Loading system checks…</div>;
  }

  const rows = [
    { label: 'PHP Version', ok: true, value: data.php_version },
    { label: 'GD Extension', ok: data.extensions?.gd, tip: 'Enable the GD extension in your PHP settings.' },
    { label: 'Imagick Extension', ok: data.extensions?.imagick, tip: 'Enable Imagick in your hosting control panel if it is available.' },
    { label: 'WebP Support', ok: data.webp_support, tip: 'Make sure either GD or Imagick supports WebP.' },
    { label: 'Database Connectivity', ok: data.db_ok, tip: 'Check the database credentials and confirm the user has access.' },
    { label: 'SendGrid Config', ok: data.sendgrid_configured, tip: 'Add the SendGrid API key and sender details to your environment settings.' },
  ];

  const pathTips = {
    upload_dir_writable: 'Make the uploads folder writable in cPanel. A 775 permission mask usually works.',
    originals_writable: 'Make sure uploads/originals is writable.',
    variants_optimized_writable: 'Make sure uploads/variants/optimized is writable.',
    variants_webp_writable: 'Make sure uploads/variants/webp is writable.',
    manifests_writable: 'Make sure uploads/manifests is writable.',
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
      <p>Use these checks to confirm that uploads, image processing, database access, and email are ready on the current environment.</p>
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

function createCalendarIntegrationForm(provider = 'google') {
  return {
    id: null,
    provider,
    label: '',
    target_calendar_name: '',
    target_calendar_reference: '',
    notes: '',
    is_enabled: false,
    sync_confirmed_bookings: true,
  };
}

function CalendarSyncPage() {
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
    if (!window.confirm('Delete this calendar integration slot? Existing sync history for that slot will be removed too.')) {
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
    return <div className="card">Loading calendar sync foundation…</div>;
  }

  const providerLookup = Object.fromEntries((data.providers ?? []).map((provider) => [provider.key, provider]));
  const selectedProvider = providerLookup[form.provider] || data.providers?.[0] || null;
  const editingIntegration = form.id ? (data.integrations ?? []).find((item) => item.id === form.id) : null;

  return (
    <div>
      <h1>Calendar Sync</h1>
      <p>Foundation only for now. This stores future Google, Microsoft, or Apple sync targets and reserves the booking lifecycle hooks needed to sync confirmed appointments later.</p>
      {error ? <div className="card" style={{ marginBottom: '1rem' }}>{error}</div> : null}

      <div className="card">
        <h3>Current foundation</h3>
        <p>Calendar sync enabled: {data.config?.enabled ? 'Yes' : 'No'}</p>
        <p>Default timezone: {data.config?.default_timezone || 'Not set'}</p>
        <p>Max job attempts: {data.config?.max_job_attempts ?? 0}</p>
        <p className="muted">No provider-specific OAuth or event-writing code is active yet. Enabling a slot here will not create events until a provider implementation is added and connected.</p>
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

function humanizeCalendarConnectionStatus(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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

function StatusBadge({ status }) {
  const labels = {
    pending_confirmation: 'Pending',
    confirmed: 'Confirmed',
    completed: 'Completed',
    declined: 'Declined',
    cancelled: 'Cancelled',
    expired: 'Expired',
  };
  return <span className={`status-badge status-${status}`}>{labels[status] ?? status}</span>;
}

function getBookingActions(status) {
  if (status === 'pending_confirmation') {
    return [
      { key: 'confirm', label: 'Confirm', className: 'btn-success' },
      { key: 'decline', label: 'Decline', className: 'btn-warn' },
      { key: 'cancel', label: 'Cancel', className: 'btn-muted' },
    ];
  }

  if (status === 'confirmed') {
    return [
      { key: 'complete', label: 'Complete', className: 'btn-tertiary' },
      { key: 'cancel', label: 'Cancel', className: 'btn-muted' },
    ];
  }

  return [];
}

function parseServices(json) {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => {
          if (typeof entry === 'string') {
            return entry;
          }
          if (entry && typeof entry === 'object') {
            return entry.name || entry.title || '';
          }
          return '';
        })
        .filter(Boolean);
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

function summarizePets(pets = []) {
  if (!Array.isArray(pets) || pets.length === 0) {
    return '';
  }

  return pets
    .map((pet) => {
      if (!pet || typeof pet !== 'object') {
        return '';
      }
      const base = pet.pet_name || pet.name || '';
      const weight = pet.approximate_weight || pet.weight || '';
      if (!base) {
        return '';
      }
      return weight ? `${base} (${weight})` : base;
    })
    .filter(Boolean)
    .join(', ');
}

function RichTextEditor({ value, onChange }) {
  return (
    <Suspense fallback={<div className="rich-text-loading muted small-text">Loading editor…</div>}>
      <RichTextEditorImpl value={value} onChange={onChange} />
    </Suspense>
  );
}

function EditorSection({ title, description, children, initiallyOpen = false }) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const sectionKey = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return (
    <details
      className="editor-section card"
      data-editor-section={sectionKey}
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary>
        <div>
          <strong>{title}</strong>
          {description && <p className="muted small-text">{description}</p>}
        </div>
      </summary>
      <div className="editor-section__body stack gap-sm">{children}</div>
    </details>
  );
}

function SectionEnabledToggle({ label, value, onChange }) {
  return (
    <label className="section-toggle">
      <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
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
              <div key={field.name} className="field-block">
                <span className="field-label">{field.label}</span>
                <RichTextEditor value={item[field.name] || ''} onChange={(value) => updateItem(index, field.name, value)} />
              </div>
            ) : (
              <label key={field.name} className="field-block">
                <span className="field-label">{field.label}</span>
                <input
                  placeholder={field.label}
                  value={item[field.name] || ''}
                  onChange={(e) => updateItem(index, field.name, e.target.value)}
                />
              </label>
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

function MediaPicker({ label, media, onChange, libraryCategory = '', uploadCategory = '' }) {
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
      setItems(response.data.data.items);
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
