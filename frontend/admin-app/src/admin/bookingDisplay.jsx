export const BOOKING_STAT_LABELS = {
  new_requests: 'New Requests',
  pending_confirmation: 'Pending Confirmation',
  confirmed_today: 'Confirmed Today',
  confirmed_week: 'Confirmed This Week',
};

export const BOOKING_STAT_ORDER = ['new_requests', 'pending_confirmation', 'confirmed_today', 'confirmed_week'];

export function StatusBadge({ status }) {
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

export function getBookingActions(status) {
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

export function parseServices(json) {
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

export function summarizeServices(json) {
  const services = parseServices(json);
  if (!services.length) {
    return 'No services selected';
  }
  return services.join(', ');
}

export function summarizePets(pets = []) {
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
