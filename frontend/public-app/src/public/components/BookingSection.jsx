import { useEffect, useRef, useState } from 'react';
import { BookingSteps, canIntakeContinue, createDog, formatDateLong, formatDuration, formatHoldRemaining, requiresNewSlot, richHtml, toPhoneHref, todayString } from '../bookingUtils';
import { keepBookingStageInView } from '../bookingScroll';
import { publicApi } from '../publicApi';
import { textHasContent } from '../siteConfig';

export function BookingSection({ settings, content, services }) {
  const bookingStageRef = useRef(null);
  const activeStepHeaderRef = useRef(null);
  const previousStepRef = useRef(1);
  const [step, setStep] = useState(1);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [dogCount, setDogCount] = useState(1);
  const [bookingDate, setBookingDate] = useState(todayString());
  const [availability, setAvailability] = useState([]);
  const [availabilityMeta, setAvailabilityMeta] = useState({ duration_minutes: 0, availability_status: 'ready', message: '' });
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [holdToken, setHoldToken] = useState(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState(null);
  const [holdClock, setHoldClock] = useState(Date.now());
  const [nextAvailableSuggestion, setNextAvailableSuggestion] = useState(null);
  const [slotError, setSlotError] = useState(null);
  const [flowStatus, setFlowStatus] = useState(null);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshingHold, setRefreshingHold] = useState(false);
  const [form, setForm] = useState({
    owner_name: '',
    phone: '',
    email: '',
    vet_name: '',
    vet_phone: '',
    notes: '',
    paperwork_notes: '',
    paperwork_upload: null,
    bowwow_hp: '',
    dogs: [createDog()],
  });

  const selectedServices = services.filter((service) => selectedServiceIds.includes(service.id));
  const durationSummary = selectedServices.reduce((sum, service) => sum + Number(service.duration_minutes || 0), 0) * dogCount;
  const appointmentNotice = content.notice || 'Our team will review it and confirm within 24 hours.';
  const availabilityMessage = content.availability_note || 'Available times update based on selected services and number of dogs.';
  const selectedServicesLabel = selectedServices.map((service) => service.name).join(', ');
  const maxReachableStep = selectedSlot ? (canIntakeContinue(form) ? 4 : 3) : (selectedServiceIds.length > 0 ? 2 : 1);
  const holdRemainingMs = holdExpiresAt ? Math.max(0, holdExpiresAt - holdClock) : 0;
  const holdRemainingLabel = holdToken && holdExpiresAt ? formatHoldRemaining(holdRemainingMs) : null;

  const clearSelectedTime = () => {
    setSelectedSlot(null);
    setHoldToken(null);
    setHoldExpiresAt(null);
  };

  const applyHoldState = (slot, hold) => {
    setSelectedSlot((current) => ({
      ...(current || {}),
      ...(slot || {}),
      end_time: hold?.end_time || slot?.end_time || current?.end_time || null,
    }));
    setHoldToken(hold?.hold_token || null);
    if (hold?.expires_in_minutes) {
      const now = Date.now();
      setHoldClock(now);
      setHoldExpiresAt(now + Number(hold.expires_in_minutes) * 60 * 1000);
    } else {
      setHoldExpiresAt(null);
    }
    setNextAvailableSuggestion(null);
  };

  const buildSlotConflictMessage = (message, nextAvailable) => {
    if (nextAvailable?.date && nextAvailable.date !== bookingDate) {
      setBookingDate(nextAvailable.date);
    }
    setNextAvailableSuggestion(nextAvailable);
    return nextAvailable ? `${message} Nearest available: ${formatSuggestionSummary(nextAvailable)}.` : message;
  };

  useEffect(() => {
    setForm((current) => {
      const nextDogs = [...current.dogs];
      while (nextDogs.length < dogCount) {
        nextDogs.push(createDog());
      }
      while (nextDogs.length > dogCount) {
        nextDogs.pop();
      }
      return { ...current, dogs: nextDogs };
    });
  }, [dogCount]);

  useEffect(() => {
    if (selectedServiceIds.length === 0) {
      setAvailability([]);
      setAvailabilityMeta({ duration_minutes: 0, availability_status: 'ready', message: '' });
      clearSelectedTime();
      setNextAvailableSuggestion(null);
      setSlotError(null);
      return;
    }

    let ignore = false;

    const loadAvailability = async () => {
      setLoadingAvailability(true);
      setSlotError(null);
      try {
        const response = await publicApi.get('/api/public/schedule', {
          params: {
            date: bookingDate,
            service_ids: selectedServiceIds,
            pet_count: dogCount,
            hold_token: holdToken || undefined,
          },
        });

        if (!ignore) {
          setAvailability(response.data.data.availability || []);
          setAvailabilityMeta({
            duration_minutes: response.data.data.duration_minutes || durationSummary || 0,
            availability_status: response.data.data.availability_status || 'ready',
            message: response.data.data.message || '',
          });
          setNextAvailableSuggestion(response.data.data.next_available || null);
          if (response.data.data.availability_status === 'contact_required') {
            setSlotError(response.data.data.message || 'Online availability is temporarily limited. Please contact us so we can confirm a safe appointment time.');
          }
        }
      } catch (error) {
        if (!ignore) {
          setAvailability([]);
          setNextAvailableSuggestion(null);
          setSlotError(error.response?.data?.error?.message || 'Unable to load availability right now.');
        }
      } finally {
        if (!ignore) {
          setLoadingAvailability(false);
        }
      }
    };

    loadAvailability();
    return () => {
      ignore = true;
    };
  }, [bookingDate, dogCount, durationSummary, holdToken, selectedServiceIds]);

  useEffect(() => {
    if (!holdToken || !holdExpiresAt) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setHoldClock(Date.now());
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [holdExpiresAt, holdToken]);

  useEffect(() => {
    if (!selectedSlot || loadingAvailability) {
      return;
    }

    const slotStillVisible = availability.some((slot) => slot.time === selectedSlot.time);
    if (!slotStillVisible) {
      clearSelectedTime();
      setSlotError('Available times updated. Please choose a new time that matches the current services and dog count.');
      setStep(2);
    }
  }, [availability, loadingAvailability, selectedSlot]);

  useEffect(() => {
    if (!holdToken || !holdExpiresAt || holdRemainingMs > 0 || step < 3) {
      return;
    }

    clearSelectedTime();
    setStep(2);
    setFlowStatus({
      tone: 'error',
      message: 'That reserved time expired while you were filling out the request. Please choose a fresh time before continuing.',
    });
  }, [holdExpiresAt, holdRemainingMs, holdToken, step]);

  useEffect(() => {
    if (previousStepRef.current === step) {
      return undefined;
    }

    previousStepRef.current = step;
    const timeoutId = window.setTimeout(() => {
      keepBookingStageInView(activeStepHeaderRef.current || bookingStageRef.current);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [step]);

  const toggleService = (serviceId) => {
    setFlowStatus(null);
    setSubmitStatus(null);
    clearSelectedTime();
    setNextAvailableSuggestion(null);
    setSelectedServiceIds((current) =>
      current.includes(serviceId) ? current.filter((id) => id !== serviceId) : [...current, serviceId],
    );
  };

  const formatSuggestionSummary = (suggestion) => {
    if (!suggestion) {
      return '';
    }

    const dateLabel = suggestion.date_label || formatDateLong(suggestion.date);
    return `${dateLabel} at ${suggestion.label}`;
  };

  const jumpToNextAvailable = async () => {
    if (!nextAvailableSuggestion) {
      return;
    }

    setFlowStatus(null);
    setSubmitStatus(null);
    clearSelectedTime();

    if (nextAvailableSuggestion.date && nextAvailableSuggestion.date !== bookingDate) {
      setBookingDate(nextAvailableSuggestion.date);
      setSlotError(`Showing the nearest available opening: ${formatSuggestionSummary(nextAvailableSuggestion)}.`);
      return;
    }

    await chooseSlot(nextAvailableSuggestion);
  };

  const chooseSlot = async (slot) => {
    setSlotError(null);
    setFlowStatus(null);
    setSubmitStatus(null);
    try {
      const response = await publicApi.post('/api/public/booking-hold', {
        date: bookingDate,
        time: slot.time,
        selected_services: selectedServiceIds,
        pet_count: dogCount,
        previous_hold_token: holdToken,
      });

      applyHoldState(slot, response.data.data);
      setStep(3);
    } catch (error) {
      const message = error.response?.data?.error?.message || 'That time is no longer available.';
      const nextAvailable = error.response?.data?.error?.next_available || null;
      setSlotError(buildSlotConflictMessage(message, nextAvailable));
    }
  };

  const refreshSelectedHold = async (targetStep = 4) => {
    if (!selectedSlot) {
      return false;
    }

    setRefreshingHold(true);
    setFlowStatus(null);
    setSubmitStatus(null);

    try {
      const response = await publicApi.post('/api/public/booking-hold', {
        date: bookingDate,
        time: selectedSlot.time,
        selected_services: selectedServiceIds,
        pet_count: dogCount,
        previous_hold_token: holdToken,
      });

      applyHoldState(selectedSlot, response.data.data);
      setStep(targetStep);
      setFlowStatus({
        tone: 'success',
        message: 'Time refreshed successfully. You can review and submit with the latest availability check already completed.',
      });
      return true;
    } catch (error) {
      const message = error.response?.data?.error?.message || 'That time is no longer available.';
      const nextAvailable = error.response?.data?.error?.next_available || null;
      clearSelectedTime();
      setStep(2);
      setFlowStatus({
        tone: 'error',
        message: buildSlotConflictMessage(message, nextAvailable),
      });
      return false;
    } finally {
      setRefreshingHold(false);
    }
  };

  const updateDog = (index, key, value) => {
    setFlowStatus(null);
    setForm((current) => ({
      ...current,
      dogs: current.dogs.map((dog, dogIndex) => (dogIndex === index ? { ...dog, [key]: value } : dog)),
    }));
  };

  const addAnotherDog = () => {
    setDogCount((count) => count + 1);
    clearSelectedTime();
    setNextAvailableSuggestion(null);
    setFlowStatus(null);
    setSubmitStatus(null);
    setSlotError('Dog count changed. Please choose a new time so availability matches the total appointment length.');
    setStep(2);
  };

  const changeStep = async (nextStep) => {
    setFlowStatus(null);
    setSubmitStatus(null);

    if (nextStep <= step) {
      setStep(nextStep);
      return;
    }

    if (nextStep >= 2 && selectedServiceIds.length === 0) {
      setStep(1);
      setFlowStatus({ tone: 'error', message: 'Select at least one service before continuing.' });
      return;
    }

    if (nextStep >= 3 && !selectedSlot) {
      setStep(2);
      setFlowStatus({ tone: 'error', message: 'Choose an available time before moving to intake details.' });
      return;
    }

    if (nextStep >= 4 && !canIntakeContinue(form)) {
      setStep(3);
      setFlowStatus({ tone: 'error', message: 'Complete the owner details plus each dog’s name and approximate weight before reviewing.' });
      return;
    }

    if (nextStep >= 4) {
      await refreshSelectedHold(nextStep);
      return;
    }

    setStep(nextStep);
  };

  const submitBooking = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFlowStatus(null);
    setSubmitStatus(null);

    try {
      const payload = new FormData();
      payload.append('owner_name', form.owner_name);
      payload.append('phone', form.phone);
      payload.append('email', form.email);
      payload.append('vet_name', form.vet_name);
      payload.append('vet_phone', form.vet_phone);
      payload.append('notes', form.notes);
      payload.append('paperwork_notes', form.paperwork_notes);
      payload.append('date', bookingDate);
      payload.append('time', selectedSlot?.time || '');
      payload.append('hold_token', holdToken || '');
      payload.append('pet_count', String(dogCount));
      payload.append('selected_services', JSON.stringify(selectedServiceIds));
      payload.append('dogs', JSON.stringify(form.dogs));
      payload.append('bowwow_hp', form.bowwow_hp);
      if (form.paperwork_upload) {
        payload.append('paperwork_upload', form.paperwork_upload);
      }

      await publicApi.post('/api/public/booking-request', payload, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSubmitStatus({
        tone: 'success',
        message: 'Request submitted. Our team will review it and confirm within 24 hours.',
      });
      setStep(1);
      setSelectedServiceIds([]);
      setDogCount(1);
      setBookingDate(todayString());
      setAvailability([]);
      clearSelectedTime();
      setNextAvailableSuggestion(null);
      setForm({
        owner_name: '',
        phone: '',
        email: '',
        vet_name: '',
        vet_phone: '',
        notes: '',
        paperwork_notes: '',
        paperwork_upload: null,
        bowwow_hp: '',
        dogs: [createDog()],
      });
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Unable to submit your request right now.';
      const nextAvailable = error.response?.data?.error?.next_available || null;
      if (requiresNewSlot(message)) {
        clearSelectedTime();
        setNextAvailableSuggestion(nextAvailable);
        if (nextAvailable?.date && nextAvailable.date !== bookingDate) {
          setBookingDate(nextAvailable.date);
        }
        setStep(2);
      }
      setSubmitStatus({
        tone: 'error',
        message: nextAvailable ? `${message} Nearest available: ${formatSuggestionSummary(nextAvailable)}.` : message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const canContinueToSlots = selectedServiceIds.length > 0;
  const bookingContactRequired = availabilityMeta.availability_status === 'contact_required';
  return (
    <section id="booking" className="section section--booking">
      <div className="container">
        <div className="section-heading">
          <p className="eyebrow">Request appointment</p>
          <h2>{content.title || 'Simple, service-aware booking built for phones'}</h2>
          {textHasContent(content.intro) && <div className="section-intro" dangerouslySetInnerHTML={richHtml(content.intro)} />}
        </div>

        <div className="booking-layout">
          <div className="booking-card">
            <BookingSteps step={step} onStepChange={changeStep} maxStep={maxReachableStep} />

            <div ref={bookingStageRef} className="booking-stage">
              {flowStatus && (
                <p
                  role={flowStatus.tone === 'error' ? 'alert' : 'status'}
                  aria-live={flowStatus.tone === 'error' ? 'assertive' : 'polite'}
                  aria-atomic="true"
                  className={`status-text ${flowStatus.tone === 'error' ? 'status-text--error' : 'status-text--success'}`}
                >
                  {flowStatus.message}
                </p>
              )}

              {step === 1 && (
                <>
                  <div ref={activeStepHeaderRef} className="booking-stage__header">
                    <h3>Step 1: Select services</h3>
                    <p>Choose one or more services, then tell us how many dogs you’re bringing.</p>
                  </div>

                  <div className="service-selector-grid">
                    {services.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        className={`service-chip-card ${selectedServiceIds.includes(service.id) ? 'is-active' : ''}`}
                        onClick={() => toggleService(service.id)}
                        aria-pressed={selectedServiceIds.includes(service.id)}
                      >
                        <span>{service.name}</span>
                        <strong>{service.price_label || formatDuration(service.duration_minutes)}</strong>
                        <small>{formatDuration(service.duration_minutes)}</small>
                      </button>
                    ))}
                  </div>

                  <div className="dog-count-card">
                    <div>
                      <strong>How many dogs are in this request?</strong>
                      <p>We use this to calculate the right appointment length before you pick a time.</p>
                    </div>
                    <div className="dog-count-controls">
                      <button
                        type="button"
                        aria-label="Remove one dog from this request"
                        onClick={() => {
                          setDogCount((count) => Math.max(1, count - 1));
                          clearSelectedTime();
                          setNextAvailableSuggestion(null);
                          setFlowStatus(null);
                          setSubmitStatus(null);
                        }}
                      >
                        −
                      </button>
                      <span>{dogCount}</span>
                      <button
                        type="button"
                        aria-label="Add one dog to this request"
                        onClick={() => {
                          setDogCount((count) => count + 1);
                          clearSelectedTime();
                          setNextAvailableSuggestion(null);
                          setFlowStatus(null);
                          setSubmitStatus(null);
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="booking-summary-banner">
                    <strong>Estimated appointment length:</strong> {formatDuration(availabilityMeta.duration_minutes || durationSummary || 30)}
                  </div>

                  {!canContinueToSlots && (
                    <p className="muted-text">Select at least one service to unlock available times.</p>
                  )}

                  <div className="step-actions">
                    <button className="btn btn-primary" type="button" onClick={() => changeStep(2)}>
                      Continue to available times
                    </button>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div ref={activeStepHeaderRef} className="booking-stage__header">
                    <h3>Step 2: Select date & time</h3>
                    <p>{availabilityMessage}</p>
                  </div>

                  <div className="booking-summary-banner booking-summary-banner--notice">
                    <strong>This is a request, not an instant booking.</strong> {appointmentNotice}
                  </div>

                  <div className="date-picker-card">
                    <label htmlFor="booking-date">Preferred date</label>
                    <input
                      id="booking-date"
                      type="date"
                      value={bookingDate}
                      min={todayString()}
                      onChange={(event) => {
                        setBookingDate(event.target.value);
                        clearSelectedTime();
                        setNextAvailableSuggestion(null);
                        setSubmitStatus(null);
                        setFlowStatus(null);
                      }}
                    />
                  </div>

                  <div className="booking-summary-banner">
                    <strong>Total duration:</strong> {formatDuration(availabilityMeta.duration_minutes || durationSummary || 30)} for {dogCount} dog{dogCount === 1 ? '' : 's'}
                    {selectedServicesLabel && <span className="summary-inline-copy"> · {selectedServicesLabel}</span>}
                  </div>

                  {bookingContactRequired ? (
                    <div className="empty-state booking-contact-required">
                      <strong>Contact us to choose a time</strong>
                      <p>{availabilityMeta.message || slotError || 'Online appointment times are paused right now. Please call or send a message and we will help find a safe appointment time.'}</p>
                      <div className="section-cta__actions">
                        {settings.phone && (
                          <a className="btn btn-primary" href={toPhoneHref(settings.phone)}>
                            Call {settings.phone}
                          </a>
                        )}
                        <a className="btn btn-outline" href="#contact">
                          Send a message
                        </a>
                      </div>
                    </div>
                  ) : loadingAvailability ? (
                    <p className="muted-text" role="status" aria-live="polite">
                      Loading available times…
                    </p>
                  ) : (
                    <div className="slot-grid">
                      {availability.map((slot) => (
                        <button
                          key={slot.time}
                          type="button"
                          className={`slot-button ${selectedSlot?.time === slot.time ? 'is-active' : ''}`}
                          data-slot-time={slot.time}
                          onClick={() => chooseSlot(slot)}
                          aria-pressed={selectedSlot?.time === slot.time}
                        >
                          <span>{slot.label}</span>
                          <small>{slot.range_label}</small>
                        </button>
                      ))}
                    </div>
                  )}

                  {!bookingContactRequired && !loadingAvailability && availability.length === 0 && (
                    <div className="empty-state">
                      <p>No appointment times are currently open for those services on that date.</p>
                      {nextAvailableSuggestion && (
                        <div className="next-available-card">
                          <strong>Nearest available opening</strong>
                          <p>{formatSuggestionSummary(nextAvailableSuggestion)}</p>
                          <button className="btn btn-primary" type="button" onClick={jumpToNextAvailable}>
                            {nextAvailableSuggestion.date === bookingDate ? `Use ${nextAvailableSuggestion.label}` : `Jump to ${nextAvailableSuggestion.date_label || formatDateLong(nextAvailableSuggestion.date)}`}
                          </button>
                        </div>
                      )}
                      {settings.phone && (
                        <a className="text-link" href={toPhoneHref(settings.phone)}>
                          Call for help finding the best next opening
                        </a>
                      )}
                    </div>
                  )}

                  {!bookingContactRequired && slotError && (
                    <p role="alert" aria-live="assertive" aria-atomic="true" className="status-text status-text--error">
                      {slotError}
                    </p>
                  )}

                  <div className="step-actions">
                    <button className="btn btn-outline" type="button" onClick={() => changeStep(1)}>
                      Back
                    </button>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div ref={activeStepHeaderRef} className="booking-stage__header">
                    <h3>Step 3: Intake details</h3>
                    <p>Share owner, dog, vet, and paperwork details. We keep the form focused and easy on mobile.</p>
                  </div>

                  <div className="booking-summary-banner">
                    <strong>Selected appointment:</strong> {formatDateLong(bookingDate)} · {selectedSlot?.range_label || selectedSlot?.label}
                  </div>

                  {holdRemainingLabel && (
                    <div className="booking-summary-banner booking-summary-banner--hold">
                      <strong>Reserved while you finish:</strong> about {holdRemainingLabel} left before this time needs to be refreshed again.
                    </div>
                  )}

                  <form className="booking-form-grid" onSubmit={(event) => event.preventDefault()}>
                    <div className="field-group">
                      <label htmlFor="booking-owner-name">Owner name</label>
                      <input
                        id="booking-owner-name"
                        name="ownerName"
                        autoComplete="name"
                        value={form.owner_name}
                        onChange={(event) => setForm((current) => ({ ...current, owner_name: event.target.value }))}
                        required
                      />
                    </div>
                    <div className="field-group">
                      <label htmlFor="booking-owner-phone">Phone</label>
                      <input
                        id="booking-owner-phone"
                        name="ownerPhone"
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        value={form.phone}
                        onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                        required
                      />
                    </div>
                    <div className="field-group">
                      <label htmlFor="booking-owner-email">Email</label>
                      <input
                        id="booking-owner-email"
                        name="ownerEmail"
                        type="email"
                        autoComplete="email"
                        spellCheck={false}
                        autoCapitalize="none"
                        value={form.email}
                        onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                        required
                      />
                    </div>
                    <div className="field-group">
                      <label htmlFor="booking-vet-name">Vet name</label>
                      <input
                        id="booking-vet-name"
                        name="vetName"
                        autoComplete="organization"
                        value={form.vet_name}
                        onChange={(event) => setForm((current) => ({ ...current, vet_name: event.target.value }))}
                      />
                    </div>
                    <div className="field-group">
                      <label htmlFor="booking-vet-phone">Vet phone</label>
                      <input
                        id="booking-vet-phone"
                        name="vetPhone"
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        value={form.vet_phone}
                        onChange={(event) => setForm((current) => ({ ...current, vet_phone: event.target.value }))}
                      />
                    </div>
                  </form>

                  <div className="dog-intake-list">
                    {form.dogs.map((dog, index) => (
                      <article key={`dog-${index}`} className="dog-intake-card">
                        <div className="booking-card__header">
                          <h4>Dog {index + 1}</h4>
                        </div>
                        <div className="booking-form-grid">
                          <div className="field-group">
                            <label htmlFor={`booking-dog-name-${index}`}>Name</label>
                            <input
                              id={`booking-dog-name-${index}`}
                              name={`dogName${index}`}
                              autoComplete="off"
                              value={dog.pet_name}
                              onChange={(event) => updateDog(index, 'pet_name', event.target.value)}
                              required
                            />
                          </div>
                          <div className="field-group">
                            <label htmlFor={`booking-dog-breed-${index}`}>Breed</label>
                            <input
                              id={`booking-dog-breed-${index}`}
                              name={`dogBreed${index}`}
                              autoComplete="off"
                              value={dog.breed}
                              onChange={(event) => updateDog(index, 'breed', event.target.value)}
                            />
                          </div>
                          <div className="field-group">
                            <label htmlFor={`booking-dog-weight-${index}`}>Approximate weight</label>
                            <input
                              id={`booking-dog-weight-${index}`}
                              name={`dogWeight${index}`}
                              autoComplete="off"
                              value={dog.approximate_weight}
                              onChange={(event) => updateDog(index, 'approximate_weight', event.target.value)}
                              required
                            />
                          </div>
                          <div className="field-group field-group--wide">
                            <label htmlFor={`booking-dog-temperament-${index}`}>Temperament notes</label>
                            <textarea
                              id={`booking-dog-temperament-${index}`}
                              name={`dogTemperament${index}`}
                              autoComplete="off"
                              placeholder="Handling notes, first-visit nerves, or anything that helps…"
                              value={dog.temperament_notes}
                              onChange={(event) => updateDog(index, 'temperament_notes', event.target.value)}
                            />
                          </div>
                          <div className="field-group field-group--wide">
                            <label htmlFor={`booking-dog-medical-${index}`}>Medical or grooming notes</label>
                            <textarea
                              id={`booking-dog-medical-${index}`}
                              name={`dogMedicalNotes${index}`}
                              autoComplete="off"
                              placeholder="Allergies, medications, mobility notes, or recent changes…"
                              value={dog.medical_or_grooming_notes}
                              onChange={(event) => updateDog(index, 'medical_or_grooming_notes', event.target.value)}
                            />
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>

                  <button type="button" className="btn btn-outline add-dog-button" onClick={addAnotherDog}>
                    Add another dog
                  </button>

                  <div className="booking-form-grid">
                    <div className="field-group field-group--wide">
                      <label htmlFor="booking-request-notes">Additional request notes</label>
                      <textarea
                        id="booking-request-notes"
                        name="requestNotes"
                        autoComplete="off"
                        placeholder="Preferred timing, grooming goals, or anything else to know…"
                        value={form.notes}
                        onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                      />
                    </div>
                    <div className="field-group field-group--wide upload-card">
                      <label htmlFor="booking-paperwork-upload">Upload paperwork (PDF, JPG, PNG)</label>
                      <input
                        id="booking-paperwork-upload"
                        name="paperworkUpload"
                        type="file"
                        accept=".pdf,image/jpeg,image/png"
                        aria-describedby="booking-paperwork-help"
                        onChange={(event) => {
                          setFlowStatus(null);
                          setSubmitStatus(null);
                          setForm((current) => ({ ...current, paperwork_upload: event.target.files?.[0] || null }));
                        }}
                      />
                      <small id="booking-paperwork-help">Accepted file types: PDF, JPG, PNG. If you do not upload a file, you can summarize the paperwork below.</small>
                      {form.paperwork_upload && (
                        <div className="file-chip-row">
                          <span className="file-chip">{form.paperwork_upload.name}</span>
                          <button
                            type="button"
                            className="text-link"
                            onClick={() => setForm((current) => ({ ...current, paperwork_upload: null }))}
                          >
                            Remove file
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="field-group field-group--wide">
                      <label htmlFor="booking-paperwork-summary">Paperwork summary</label>
                      <textarea
                        id="booking-paperwork-summary"
                        name="paperworkSummary"
                        autoComplete="off"
                        placeholder="Vaccines on file, paperwork details, or follow-up notes…"
                        value={form.paperwork_notes}
                        onChange={(event) => setForm((current) => ({ ...current, paperwork_notes: event.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="step-actions">
                    <button className="btn btn-outline" type="button" onClick={() => changeStep(2)}>
                      Back
                    </button>
                    <button className="btn btn-primary" type="button" onClick={() => changeStep(4)} disabled={refreshingHold}>
                      {refreshingHold ? 'Refreshing time…' : 'Review request'}
                    </button>
                  </div>
                </>
              )}

              {step === 4 && (
                <form onSubmit={submitBooking}>
                  <div className="form-spam-trap" aria-hidden="true">
                    <label htmlFor="booking-check">Leave this field blank</label>
                    <input
                      id="booking-check"
                      name="bowwow_hp"
                      tabIndex={-1}
                      autoComplete="new-password"
                      value={form.bowwow_hp}
                      onChange={(event) => setForm((current) => ({ ...current, bowwow_hp: event.target.value }))}
                    />
                  </div>
                  <div ref={activeStepHeaderRef} className="booking-stage__header">
                    <h3>Step 4: Review & submit</h3>
                    <p>This is a request. {appointmentNotice}</p>
                  </div>

                  <div className="booking-summary-banner booking-summary-banner--notice">
                    <strong>Request review window:</strong> Our team reviews requests and confirms within 24 hours.
                  </div>

                  {holdRemainingLabel && (
                    <div className="booking-summary-banner booking-summary-banner--hold">
                      <strong>Time currently reserved:</strong> about {holdRemainingLabel} left on this request window.
                    </div>
                  )}

                  <div className="review-grid">
                    <article className="review-card">
                      <h4>Selected services</h4>
                      <ul>
                        {selectedServices.map((service) => (
                          <li key={service.id}>
                            {service.name} · {formatDuration(service.duration_minutes)}
                          </li>
                        ))}
                      </ul>
                    </article>
                    <article className="review-card">
                      <h4>Requested time</h4>
                      <p>{formatDateLong(bookingDate)}</p>
                      <p>{selectedSlot?.range_label || selectedSlot?.label}</p>
                      <p className="muted-text">
                        {formatDuration(availabilityMeta.duration_minutes || durationSummary || 30)} total for {dogCount} dog{dogCount === 1 ? '' : 's'}
                      </p>
                    </article>
                    <article className="review-card">
                      <h4>Owner details</h4>
                      <p>{form.owner_name}</p>
                      <p>{form.phone}</p>
                      <p>{form.email}</p>
                    </article>
                    <article className="review-card">
                      <h4>Dogs</h4>
                      <ul>
                        {form.dogs.map((dog, index) => (
                          <li key={`${dog.pet_name}-${index}`}>
                            {dog.pet_name} {dog.breed ? `· ${dog.breed}` : ''} {dog.approximate_weight ? `· ${dog.approximate_weight}` : ''}
                          </li>
                        ))}
                      </ul>
                    </article>
                    <article className="review-card">
                      <h4>Paperwork</h4>
                      <p>{form.paperwork_upload?.name || 'No file uploaded'}</p>
                      <p className="muted-text">{form.paperwork_notes || 'No paperwork summary added.'}</p>
                    </article>
                  </div>

                  <div className="step-actions">
                    <button className="btn btn-outline" type="button" onClick={() => changeStep(3)}>
                      Back
                    </button>
                    <button className="btn btn-primary" type="submit" disabled={submitting}>
                      {submitting ? 'Submitting…' : 'Submit appointment request'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {submitStatus && (
              <p
                role={submitStatus.tone === 'error' ? 'alert' : 'status'}
                aria-live={submitStatus.tone === 'error' ? 'assertive' : 'polite'}
                aria-atomic="true"
                className={`status-text ${submitStatus.tone === 'error' ? 'status-text--error' : 'status-text--success'}`}
              >
                {submitStatus.message}
              </p>
            )}
          </div>

          <aside className="booking-sidebar">
            <div className="sidebar-card">
              <h3>What to expect</h3>
              <ul className="feature-list">
                <li>Choose services first so only valid time buttons appear.</li>
                <li>Requests are reviewed by staff before they are confirmed.</li>
                <li>We’ll follow up within 24 hours by email or phone.</li>
              </ul>
            </div>
            <div className="sidebar-card sidebar-card--accent">
              <h3>Need immediate help?</h3>
              {settings.phone ? (
                <a className="text-link" href={toPhoneHref(settings.phone)}>
                  Call {settings.phone}
                </a>
              ) : (
                <p>Use the contact form below and we’ll help you choose the right visit.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
