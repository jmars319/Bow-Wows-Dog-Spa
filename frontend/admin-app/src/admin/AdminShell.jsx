import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAdminConfirm } from './ConfirmProvider';

export const ADMIN_BASE = '/admin';

export const api = axios.create({
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
  { path: `${ADMIN_BASE}/calendar-sync`, label: 'Calendar Prep', section: 'system' },
  { path: `${ADMIN_BASE}/system`, label: 'System', section: 'system' },
];

export function AuthProvider({ children }) {
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

export function useAuth() {
  return useContext(AuthContext);
}

export function DirtyStateProvider({ children }) {
  const confirm = useAdminConfirm();
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

  const confirmNavigation = useCallback(async () => {
    if (!state.isDirty) {
      return true;
    }

    const shouldLeave = await confirm({
      title: 'Discard unsaved changes?',
      message: state.message || 'You have unsaved changes. Leave without saving?',
      confirmLabel: 'Leave',
      tone: 'danger',
    });
    if (shouldLeave) {
      setState((current) => ({ ...current, isDirty: false }));
    }

    return shouldLeave;
  }, [confirm, state.isDirty, state.message]);

  return (
    <DirtyStateContext.Provider value={{ ...state, setDirtyState, clearDirty, confirmNavigation }}>
      {children}
    </DirtyStateContext.Provider>
  );
}

export function useAdminDirtyState() {
  return useContext(DirtyStateContext);
}

export function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="card">Checking your session…</div>;
  }
  if (!user) {
    return <Navigate to={`${ADMIN_BASE}/login`} replace />;
  }
  return <Outlet />;
}

export function AdminLayout() {
  const { user, allowedSections, logout } = useAuth();
  const { confirmNavigation, isDirty } = useAdminDirtyState();
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
    if (!(await confirmNavigation())) {
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
              onClick={async (event) => {
                if (!isDirty) {
                  return;
                }
                event.preventDefault();
                if (await confirmNavigation()) {
                  navigate(item.path);
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
