export function createCalendarIntegrationForm(provider = 'google') {
  return {
    id: null,
    provider,
    label: '',
    target_calendar_name: '',
    target_calendar_reference: '',
    notes: '',
    is_enabled: false,
    sync_confirmed_bookings: true,
    is_primary_write_target: false,
    blocks_availability: true,
  };
}

export function humanizeCalendarConnectionStatus(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
