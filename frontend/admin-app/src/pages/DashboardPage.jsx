import { useCallback, useEffect, useState } from 'react';
import { ManualBookingLauncher } from '../admin/ManualBooking';
import { api } from '../admin/AdminShell';
import { BOOKING_STAT_LABELS } from '../admin/bookingDisplay';
import { formatDateTime } from '../admin/formatters';

export function DashboardPage() {
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
