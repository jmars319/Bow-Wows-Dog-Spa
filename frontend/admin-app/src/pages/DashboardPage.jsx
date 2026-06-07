import { useCallback, useEffect, useState } from 'react';
import { QuickActionSearch, SetupTaskList } from '@jamarq/cpanel-admin-kit/convenience';
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
          {data.content_completeness && (
            <div className="card content-score-card" style={{ marginTop: '2rem' }}>
              <div className="booking-card__header">
                <div>
                  <h3>Launch Readiness</h3>
                  <p className="muted small-text">{data.content_completeness.label}</p>
                </div>
                <strong>{data.content_completeness.score}%</strong>
              </div>
              <div className="progress-track" aria-hidden="true">
                <span style={{ width: `${Math.max(0, Math.min(100, data.content_completeness.score))}%` }} />
              </div>
              <p className="muted small-text">
                {data.content_completeness.complete} of {data.content_completeness.total} required and helpful launch items are complete.
              </p>
            </div>
          )}
          <div style={{ marginTop: '2rem' }}>
            {Array.isArray(data.task_groups) && data.task_groups.length > 0 ? (
              <div className="stack gap-md">
                {data.task_groups.map((group) => (
                  <SetupTaskList key={group.id} title={group.label} tasks={group.tasks || []} />
                ))}
              </div>
            ) : (
              <SetupTaskList title="Launch setup checklist" tasks={data.tasks || []} />
            )}
          </div>
          <div className="card" style={{ marginTop: '2rem' }}>
            <QuickActionSearch
              label="Quick actions"
              placeholder="Search setup actions..."
              actions={[
                { id: 'booking', label: 'Review booking requests', description: 'Open the appointment queue.', href: '/admin/booking', keywords: ['requests', 'appointments'] },
                { id: 'services', label: 'Edit services', description: 'Update durations, prices, and visibility.', href: '/admin/services', keywords: ['pricing', 'duration'] },
                { id: 'media', label: 'Upload or reuse media', description: 'Manage hero, gallery, retail, and default images.', href: '/admin/media', keywords: ['images', 'photos', 'hero'] },
                { id: 'calendar', label: 'Check Google Calendar', description: 'Confirm availability sync is ready.', href: '/admin/calendar-sync', keywords: ['availability', 'calendar'] },
                { id: 'content', label: 'Preview site content', description: 'Update public copy and hero settings.', href: '/admin/content', keywords: ['copy', 'hero', 'footer'] },
              ]}
            />
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
