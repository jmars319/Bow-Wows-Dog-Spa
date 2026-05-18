import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ADMIN_BASE, useAuth } from '../admin/AdminShell';

export function LoginPage() {
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
