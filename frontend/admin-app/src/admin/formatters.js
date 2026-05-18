export function todayString() {
  return new Date().toISOString().slice(0, 10);
}


export function buildServiceList(input) {
  if (!input) return [];
  return input
    .split(/\r?\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);
}


export function formatDateLabel(date) {
  if (!date) return '';
  const value = new Date(`${date}T00:00:00`);
  if (Number.isNaN(value.getTime())) {
    return date;
  }
  return value.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}


export function formatTimeLabel(date, time) {
  if (!time) return '—';
  const value = new Date(`${date || '1970-01-01'}T${time}`);
  if (Number.isNaN(value.getTime())) {
    return time;
  }
  return value.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}


export function calcDurationMinutes(start, end) {
  if (!start || !end) return null;
  const base = '1970-01-01T';
  const startDate = new Date(base + start);
  const endDate = new Date(base + end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }
  return Math.round((endDate.getTime() - startDate.getTime()) / 60000);
}


export function formatTimeRange(date, start, end) {
  const startLabel = formatTimeLabel(date, start);
  if (!end) {
    return startLabel;
  }
  const endLabel = formatTimeLabel(date, end);
  const duration = calcDurationMinutes(start, end);
  return `${startLabel} – ${endLabel}${duration ? ` (${duration} min)` : ''}`;
}


export function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}


export function formatTimeAgo(value) {
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


export function truncateText(value, max = 90) {
  if (!value) return '';
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}


export function getHoldInfo(createdAt, pendingHours) {
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


export function renderHoldExpiry(createdAt, pendingHours) {
  const info = getHoldInfo(createdAt, pendingHours);
  if (!info) {
    return 'soon';
  }
  return `${formatDateTime(info.expires.toISOString())} (~${info.hoursRemaining}h remaining)`;
}


export function formatMetadata(value) {
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
