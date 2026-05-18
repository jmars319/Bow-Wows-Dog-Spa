export function normalizeAdminTimeInput(value) {
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

export function normalizeAdminTimeParts(hour, minutes, suffix) {
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

export function sortScheduleTimes(times) {
  return Array.from(new Set((times || []).map((time) => normalizeAdminTimeInput(time)).filter(Boolean))).sort();
}

export function formatScheduleTime(value) {
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

export function timeValueToMinutes(value) {
  const normalized = normalizeAdminTimeInput(value);
  if (!normalized) {
    return null;
  }

  const [hourRaw, minuteRaw] = normalized.split(':');
  return Number(hourRaw) * 60 + Number(minuteRaw);
}

export function minutesToScheduleValue(totalMinutes) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

export function buildScheduleTimeOptions(slotMinutes, start = '07:00', end = '20:00') {
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

export function toggleScheduleTime(times, value) {
  const normalized = normalizeAdminTimeInput(value);
  if (!normalized) {
    return sortScheduleTimes(times);
  }

  return times.includes(normalized)
    ? times.filter((time) => time !== normalized)
    : sortScheduleTimes([...(times || []), normalized]);
}
