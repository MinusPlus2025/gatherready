/* ==========================================================================
   Organizer: set up the workshop facts and three candidate times.

   The fields start from `src/shared/sample.ts` (a clearly synthetic fictional
   workshop) so the demo is quick; everything is editable and the form sends
   either the draft or `{ sample: true }` to the server, which is authoritative
   about validation. Client validation only catches obvious mistakes early.
   ========================================================================== */

import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { buildSample } from '../../shared/sample.js';
import type { WorkshopDraftInput } from '../../shared/types.js';
import { apiFieldErrors, describeError } from '../lib/api.js';
import {
  formatCents,
  isIanaTimezone,
  isoFromZoneInput,
  parseDollarsToCents,
  zoneInputFromIso,
} from '../lib/format.js';
import { useApp } from '../lib/store.js';
import {
  ErrorSummary,
  InlineNotice,
  PageHeader,
  SelectField,
  StatusBadge,
  TextAreaField,
  TextField,
  type SummaryError,
} from '../components/ui.js';

const TIMEZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC',
];

interface SlotInput {
  start: string;
  end: string;
}

interface FormState {
  merchantName: string;
  title: string;
  description: string;
  venue: string;
  timezone: string;
  durationMinutes: string;
  priceDollars: string;
  inclusionsText: string;
  minParticipants: string;
  capacity: string;
  authDeadline: string;
  slots: SlotInput[];
}

function initialForm(): FormState {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const draft = buildSample(now, 9).draft;
  return {
    merchantName: draft.merchantName,
    title: draft.title,
    description: draft.description,
    venue: draft.venue,
    timezone: draft.timezone,
    durationMinutes: String(draft.durationMinutes),
    priceDollars: formatCents(draft.priceCents).replace('$', ''),
    inclusionsText: draft.inclusions.join('\n'),
    minParticipants: String(draft.minParticipants),
    capacity: String(draft.capacity),
    authDeadline: zoneInputFromIso(draft.authDeadlineUtc, draft.timezone),
    slots: draft.slots.map((slot) => ({
      start: zoneInputFromIso(slot.startUtc, draft.timezone),
      end: zoneInputFromIso(slot.endUtc, draft.timezone),
    })),
  };
}

function positiveInt(value: string): number | null {
  if (!/^\d{1,4}$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function validate(form: FormState, nowUtc: string): { errors: SummaryError[]; draft: WorkshopDraftInput | null } {
  const errors: SummaryError[] = [];
  const require = (field: string, value: string, label: string): void => {
    if (!value.trim()) errors.push({ field, message: `${label} is required.` });
  };

  require('merchantName', form.merchantName, 'Merchant name');
  require('title', form.title, 'Workshop title');
  require('description', form.description, 'Description');
  require('venue', form.venue, 'Venue');

  if (!isIanaTimezone(form.timezone)) {
    errors.push({ field: 'timezone', message: 'Choose a valid IANA timezone.' });
  }

  const duration = positiveInt(form.durationMinutes);
  if (duration === null) {
    errors.push({ field: 'durationMinutes', message: 'Duration must be a whole number of minutes.' });
  }

  const priceCents = parseDollarsToCents(form.priceDollars);
  if (priceCents === null) {
    errors.push({ field: 'priceDollars', message: 'Price must be a dollar amount with at most two decimals.' });
  }

  const inclusions = form.inclusionsText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (inclusions.length === 0) {
    errors.push({ field: 'inclusionsText', message: 'List at least one thing the price includes.' });
  }

  const min = positiveInt(form.minParticipants);
  const capacity = positiveInt(form.capacity);
  if (min === null) errors.push({ field: 'minParticipants', message: 'Minimum must be a whole number.' });
  if (capacity === null) errors.push({ field: 'capacity', message: 'Capacity must be a whole number.' });
  if (min !== null && capacity !== null && capacity > 0 && min > capacity) {
    errors.push({ field: 'minParticipants', message: 'Minimum cannot be larger than capacity.' });
  }

  const authDeadline = isoFromZoneInput(form.authDeadline, form.timezone);
  if (!authDeadline) {
    errors.push({ field: 'authDeadline', message: 'Enter the authorization deadline as a date and time.' });
  } else if (Date.parse(authDeadline) <= Date.parse(nowUtc)) {
    errors.push({ field: 'authDeadline', message: 'The authorization deadline must be in the future.' });
  }

  const slots: Array<{ startUtc: string; endUtc: string }> = [];
  form.slots.forEach((slot, index) => {
    const fieldBase = `slot${index + 1}`;
    const start = isoFromZoneInput(slot.start, form.timezone);
    const end = isoFromZoneInput(slot.end, form.timezone);
    if (!start || !end) {
      errors.push({ field: `${fieldBase}-start`, message: `Time ${index + 1} needs a start and an end.` });
      return;
    }
    if (Date.parse(end) <= Date.parse(start)) {
      errors.push({ field: `${fieldBase}-end`, message: `Time ${index + 1} must end after it starts.` });
      return;
    }
    slots.push({ startUtc: start, endUtc: end });
  });

  slots.sort((a, b) => Date.parse(a.startUtc) - Date.parse(b.startUtc));
  for (let index = 1; index < slots.length; index += 1) {
    if (Date.parse(slots[index]!.startUtc) < Date.parse(slots[index - 1]!.endUtc)) {
      errors.push({ field: 'slots', message: 'Candidate times must not overlap.' });
      break;
    }
  }
  if (authDeadline && slots.length > 0) {
    const firstStart = slots[0]!.startUtc;
    if (Date.parse(authDeadline) >= Date.parse(firstStart)) {
      errors.push({ field: 'authDeadline', message: 'The authorization deadline must close before the first session starts.' });
    }
  }

  if (errors.length > 0 || !priceCents || !min || !capacity || !duration || !authDeadline) {
    return { errors, draft: null };
  }

  const draft: WorkshopDraftInput = {
    merchantName: form.merchantName.trim(),
    title: form.title.trim(),
    description: form.description.trim(),
    venue: form.venue.trim(),
    timezone: form.timezone,
    durationMinutes: duration,
    priceCents,
    inclusions,
    minParticipants: min,
    capacity,
    authDeadlineUtc: authDeadline,
    slots,
  };
  return { errors: [], draft };
}

export default function OrganizerSetup() {
  const { state, act } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<SummaryError[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'create' | 'sample'>(null);
  const timezoneOptions = useMemo(() => {
    const options = [...TIMEZONES];
    if (!options.includes(form.timezone)) options.unshift(form.timezone);
    return options;
  }, [form.timezone]);

  const workshop = state?.workshop ?? null;

  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateSlot(index: number, key: keyof SlotInput, value: string): void {
    setForm((current) => ({
      ...current,
      slots: current.slots.map((slot, slotIndex) => (slotIndex === index ? { ...slot, [key]: value } : slot)),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const result = validate(form, state?.nowUtc ?? new Date().toISOString());
    setErrors(result.errors);
    setApiError(null);
    if (!result.draft) return;
    setBusy('create');
    try {
      await act({ type: 'workshop.create', payload: { draft: result.draft } });
      navigate('/organizer/plan');
    } catch (caught) {
      const fields = apiFieldErrors(caught).map((field) => ({ field: field.field, message: field.message }));
      setErrors(fields);
      setApiError(describeError(caught));
    } finally {
      setBusy(null);
    }
  }

  async function loadSample(): Promise<void> {
    setBusy('sample');
    setErrors([]);
    setApiError(null);
    try {
      await act({ type: 'workshop.create', payload: { sample: true } });
      navigate('/organizer/plan');
    } catch (caught) {
      setApiError(describeError(caught));
    } finally {
      setBusy(null);
    }
  }

  if (workshop) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Organizer"
          title="Your workshop is set up"
          intro={`${workshop.merchantName} · ${formatCents(workshop.priceCents)} ${workshop.currency} per person · minimum ${workshop.minParticipants}, capacity ${workshop.capacity}.`}
          actions={
            <StatusBadge
              tone={workshop.status === 'OFFER_OPEN' ? 'success' : 'info'}
              word={
                workshop.status === 'OFFER_OPEN'
                  ? 'Offer open'
                  : workshop.status === 'CLARIFYING'
                    ? 'Clarifying conditions'
                    : 'Collecting interest'
              }
            />
          }
        />
        <section className="panel" aria-labelledby="created-details">
          <h2 id="created-details">Workshop facts</h2>
          <dl className="detail-grid">
            <div>
              <dt>Venue</dt>
              <dd>{workshop.venue}</dd>
            </div>
            <div>
              <dt>Timezone</dt>
              <dd>{workshop.timezone}</dd>
            </div>
            <div>
              <dt>Length</dt>
              <dd>{workshop.durationMinutes} minutes</dd>
            </div>
            <div>
              <dt>Includes</dt>
              <dd>{workshop.inclusions.join(' · ')}</dd>
            </div>
            <div>
              <dt>Authorization deadline</dt>
              <dd>{workshop.authDeadlineLabel}</dd>
            </div>
          </dl>
          <h3>Candidate times</h3>
          <ol className="slot-list">
            {workshop.slots.map((slot) => (
              <li key={slot.id}>
                <strong>{slot.dayLabel}</strong> · {slot.timeLabel} ({slot.timezone})
              </li>
            ))}
          </ol>
        </section>

        <section className="panel panel--next" aria-labelledby="next-steps">
          <h2 id="next-steps">Next step</h2>
          <p>
            Participants now see the big question and build a reviewable preference. Nothing counts until each
            person presses <strong>Confirm my preferences</strong>. Use the demo view switcher above to act as
            one of the synthetic participants.
          </p>
          <div className="button-row">
            <Link className="btn btn-primary" to="/organizer/plan">
              Open the plan
            </Link>
            <Link className="btn btn-secondary" to="/participant/preferences">
              Open a participant view
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Organizer · step 1"
        title="Set up your workshop"
        intro="One merchant, one two-hour workshop, three candidate times. These are the facts every participant will eventually see in a fixed offer."
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => void loadSample()} disabled={busy !== null}>
            {busy === 'sample' ? 'Loading sample…' : 'Load sample (synthetic demo data)'}
          </button>
        }
      />

      <p className="form-note">
        The fields start from the synthetic sample workshop so the demo is quick. Edit anything — nothing is
        created until you press <strong>Create workshop</strong>.
      </p>

      <ErrorSummary errors={errors} />
      {apiError ? (
        <InlineNotice kind="error" title="The workshop was not created">
          {apiError}
        </InlineNotice>
      ) : null}

      <form className="form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <fieldset className="fieldset">
          <legend>Workshop facts</legend>
          <div className="field-grid">
            <TextField
              chrome={{ id: 'merchantName', label: 'Merchant name', required: true, error: errorFor(errors, 'merchantName') }}
              value={form.merchantName}
              onChange={(event) => update('merchantName', event.target.value)}
              autoComplete="organization"
            />
            <TextField
              chrome={{ id: 'title', label: 'Workshop title', required: true, error: errorFor(errors, 'title') }}
              value={form.title}
              onChange={(event) => update('title', event.target.value)}
            />
          </div>
          <TextAreaField
            chrome={{
              id: 'description',
              label: 'Description',
              required: true,
              hint: 'What happens in the session. This appears verbatim in the offer.',
              error: errorFor(errors, 'description'),
            }}
            rows={3}
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
          />
          <TextField
            chrome={{ id: 'venue', label: 'Venue', required: true, error: errorFor(errors, 'venue') }}
            value={form.venue}
            onChange={(event) => update('venue', event.target.value)}
          />
          <div className="field-grid field-grid--three">
            <SelectField
              chrome={{ id: 'timezone', label: 'Timezone (IANA)', required: true, error: errorFor(errors, 'timezone') }}
              value={form.timezone}
              onChange={(event) => update('timezone', event.target.value)}
            >
              {timezoneOptions.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </SelectField>
            <TextField
              chrome={{
                id: 'durationMinutes',
                label: 'Duration (minutes)',
                required: true,
                error: errorFor(errors, 'durationMinutes'),
              }}
              inputMode="numeric"
              value={form.durationMinutes}
              onChange={(event) => update('durationMinutes', event.target.value)}
            />
            <TextField
              chrome={{
                id: 'priceDollars',
                label: 'Price per person (USD)',
                required: true,
                hint: 'Fixed and all-inclusive. Stored as integer cents.',
                error: errorFor(errors, 'priceDollars'),
              }}
              inputMode="decimal"
              value={form.priceDollars}
              onChange={(event) => update('priceDollars', event.target.value)}
            />
          </div>
          <TextAreaField
            chrome={{
              id: 'inclusionsText',
              label: 'What the price includes',
              required: true,
              hint: 'One item per line. These are listed in the offer.',
              error: errorFor(errors, 'inclusionsText'),
            }}
            rows={3}
            value={form.inclusionsText}
            onChange={(event) => update('inclusionsText', event.target.value)}
          />
          <div className="field-grid field-grid--three">
            <TextField
              chrome={{
                id: 'minParticipants',
                label: 'Minimum participants',
                required: true,
                error: errorFor(errors, 'minParticipants'),
              }}
              inputMode="numeric"
              value={form.minParticipants}
              onChange={(event) => update('minParticipants', event.target.value)}
            />
            <TextField
              chrome={{
                id: 'capacity',
                label: 'Capacity',
                required: true,
                error: errorFor(errors, 'capacity'),
              }}
              inputMode="numeric"
              value={form.capacity}
              onChange={(event) => update('capacity', event.target.value)}
            />
            <TextField
              chrome={{
                id: 'authDeadline',
                label: `Authorization deadline (${form.timezone})`,
                required: true,
                hint: 'When the authorization window closes. It must end before the first session.',
                error: errorFor(errors, 'authDeadline'),
              }}
              type="datetime-local"
              value={form.authDeadline}
              onChange={(event) => update('authDeadline', event.target.value)}
            />
          </div>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Candidate times (3)</legend>
          <p className="fieldset__hint">
            Enter the wall-clock times in {form.timezone}. The stored instant is UTC; every screen renders it
            back in this timezone.
          </p>
          {errors.some((error) => error.field === 'slots') ? (
            <p className="field__error" id="slots-error">
              {errors.find((error) => error.field === 'slots')?.message}
            </p>
          ) : null}
          {form.slots.map((slot, index) => {
            const base = `slot${index + 1}`;
            return (
              <div className="slot-input" key={base}>
                <p className="slot-input__title">Time {index + 1}</p>
                <div className="field-grid">
                  <TextField
                    chrome={{ id: `${base}-start`, label: 'Starts', required: true, error: errorFor(errors, `${base}-start`) }}
                    type="datetime-local"
                    value={slot.start}
                    onChange={(event) => updateSlot(index, 'start', event.target.value)}
                  />
                  <TextField
                    chrome={{ id: `${base}-end`, label: 'Ends', required: true, error: errorFor(errors, `${base}-end`) }}
                    type="datetime-local"
                    value={slot.end}
                    onChange={(event) => updateSlot(index, 'end', event.target.value)}
                  />
                </div>
              </div>
            );
          })}
        </fieldset>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy !== null}>
            {busy === 'create' ? 'Creating workshop…' : 'Create workshop'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void loadSample()} disabled={busy !== null}>
            Load sample (synthetic demo data)
          </button>
          <p className="form-actions__note">
            The server validates the draft again. It refuses an authorization deadline that has already passed, a
            minimum above capacity, or overlapping times.
          </p>
        </div>
      </form>
    </div>
  );
}

function errorFor(errors: SummaryError[], field: string): string | undefined {
  return errors.find((error) => error.field === field)?.message;
}
