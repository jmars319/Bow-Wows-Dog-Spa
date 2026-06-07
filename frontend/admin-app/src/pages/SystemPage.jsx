import { useEffect, useState } from 'react';
import { SystemCheckCard } from '@jamarq/cpanel-admin-kit';
import { api } from '../admin/AdminShell';

export function SystemPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get('/system-checks')
      .then((response) => setData(response.data.data))
      .catch((err) => setError(err.response?.data?.error?.message ?? err.message));
  }, []);

  if (error) {
    return <div className="card">{error}</div>;
  }

  if (!data) {
    return <div className="card">Loading system checks…</div>;
  }

  if (Array.isArray(data.checks) && data.checks.length > 0) {
    const checkMap = new Map(data.checks.map((check) => [check.id, check]));
    const groups = Array.isArray(data.sections) && data.sections.length
      ? data.sections.map((section) => ({
          ...section,
          checks: (section.checks || []).map((id) => checkMap.get(id)).filter(Boolean),
        })).filter((section) => section.checks.length)
      : [{ id: 'all', label: 'System Checks', checks: data.checks }];

    return (
      <div>
        <h1>System Checks</h1>
        <p>Use these checks after deploys and before staff review. Details stay folded unless something needs troubleshooting.</p>
        {groups.map((section) => (
          <section className="card" key={section.id}>
            <h2>{section.label}</h2>
            <div className="system-check-grid">
              {section.checks.map((check) => (
                <SystemCheckCard key={check.id} check={{ ...check, status: check.status || 'info' }} />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
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
