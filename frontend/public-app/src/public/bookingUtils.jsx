export function BookingSteps({ step, onStepChange, maxStep = 1 }) {
  const steps = [
    { id: 1, label: 'Services' },
    { id: 2, label: 'Time' },
    { id: 3, label: 'Intake' },
    { id: 4, label: 'Review' },
  ];

  return (
    <div className="booking-steps">
      {steps.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className={`booking-step ${step === entry.id ? 'is-active' : ''} ${step > entry.id ? 'is-complete' : ''} ${entry.id > maxStep ? 'is-locked' : ''}`}
          onClick={() => onStepChange(entry.id)}
          aria-current={step === entry.id ? 'step' : undefined}
          aria-disabled={entry.id > maxStep}
        >
          <span>{entry.id}</span>
          <strong>{entry.label}</strong>
        </button>
      ))}
    </div>
  );
}

export function createDog() {
  return {
    pet_name: '',
    breed: '',
    approximate_weight: '',
    temperament_notes: '',
    medical_or_grooming_notes: '',
  };
}

export function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export function canIntakeContinue(form) {
  return Boolean(
    form.owner_name &&
      form.phone &&
      form.email &&
      Array.isArray(form.dogs) &&
      form.dogs.length > 0 &&
      form.dogs.every((dog) => dog.pet_name.trim() && dog.approximate_weight.trim()),
  );
}

export function toPhoneHref(value) {
  return `tel:${String(value).replace(/[^\d+]/g, '')}`;
}

export function requiresNewSlot(message) {
  const normalized = String(message || '').toLowerCase();
  return [
    'no longer reserved',
    'no longer available',
    'selected time',
    'choose another time',
    'currently being requested',
  ].some((needle) => normalized.includes(needle));
}

export function formatHoldRemaining(milliseconds) {
  const totalMinutes = Math.max(1, Math.ceil(milliseconds / 60000));
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return `${totalMinutes}m`;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function formatDuration(minutes) {
  const total = Number(minutes) || 0;
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  if (hours === 0) {
    return `${remainder} min`;
  }
  if (remainder === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${remainder} min`;
}

export function formatDateLong(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}
