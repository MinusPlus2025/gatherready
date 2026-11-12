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
import { useI18n, type Translate } from '../lib/i18n';
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

function validate(
  form: FormState,
  nowUtc: string,
  t: Translate,
): { errors: SummaryError[]; draft: WorkshopDraftInput | null } {
  const errors: SummaryError[] = [];
  const require = (field: string, value: string, label: string): void => {
    if (!value.trim()) errors.push({ field, message: t('onboard.setup.error.required', { label }) });
  };

  require('merchantName', form.merchantName, t('onboard.setup.field.merchantName'));
  require('title', form.title, t('onboard.setup.field.title'));
  require('description', form.description, t('onboard.setup.field.description'));
  require('venue', form.venue, t('onboard.setup.field.venue'));

  if (!isIanaTimezone(form.timezone)) {
    errors.push({ field: 'timezone', message: t('onboard.setup.error.timezone') });
  }

  const duration = positiveInt(form.durationMinutes);
  if (duration === null) {
    errors.push({ field: 'durationMinutes', message: t('onboard.setup.error.duration') });
  }

  const priceCents = parseDollarsToCents(form.priceDollars);
  if (priceCents === null) {
    errors.push({ field: 'priceDollars', message: t('onboard.setup.error.price') });
  }

  const inclusions = form.inclusionsText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (inclusions.length === 0) {
    errors.push({ field: 'inclusionsText', message: t('onboard.setup.error.inclusions') });
  }

  const min = positiveInt(form.minParticipants);
  const capacity = positiveInt(form.capacity);
  if (min === null) errors.push({ field: 'minParticipants', message: t('onboard.setup.error.min') });
  if (capacity === null) errors.push({ field: 'capacity', message: t('onboard.setup.error.capacity') });
  if (min !== null && capacity !== null && capacity > 0 && min > capacity) {
    errors.push({ field: 'minParticipants', message: t('onboard.setup.error.minOverCapacity') });
  }

  const authDeadline = isoFromZoneInput(form.authDeadline, form.timezone);
  if (!authDeadline) {
    errors.push({ field: 'authDeadline', message: t('onboard.setup.error.deadlineFormat') });
  } else if (Date.parse(authDeadline) <= Date.parse(nowUtc)) {
    errors.push({ field: 'authDeadline', message: t('onboard.setup.error.deadlineFuture') });
  }

  const slots: Array<{ startUtc: string; endUtc: string }> = [];
  form.slots.forEach((slot, index) => {
    const fieldBase = `slot${index + 1}`;
    const start = isoFromZoneInput(slot.start, form.timezone);
    const end = isoFromZoneInput(slot.end, form.timezone);
    if (!start || !end) {
      errors.push({ field: `${fieldBase}-start`, message: t('onboard.setup.error.slotRange', { n: index + 1 }) });
      return;
    }
    if (Date.parse(end) <= Date.parse(start)) {
      errors.push({ field: `${fieldBase}-end`, message: t('onboard.setup.error.slotOrder', { n: index + 1 }) });
      return;
    }
    slots.push({ startUtc: start, endUtc: end });
  });

  slots.sort((a, b) => Date.parse(a.startUtc) - Date.parse(b.startUtc));
  for (let index = 1; index < slots.length; index += 1) {
    if (Date.parse(slots[index]!.startUtc) < Date.parse(slots[index - 1]!.endUtc)) {
      errors.push({ field: 'slots', message: t('onboard.setup.error.slotOverlap') });
      break;
    }
  }
  if (authDeadline && slots.length > 0) {
    const firstStart = slots[0]!.startUtc;
    if (Date.parse(authDeadline) >= Date.parse(firstStart)) {
      errors.push({ field: 'authDeadline', message: t('onboard.setup.error.deadlineBeforeFirst') });
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
  const { t } = useI18n();
  const { state, act } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(initialForm);
  const [draftOpen, setDraftOpen] = useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 901px)').matches);
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
    const result = validate(form, state?.nowUtc ?? new Date().toISOString(), t);
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
          eyebrow={t('onboard.setup.created.eyebrow')}
          title={t('onboard.setup.created.title')}
          intro={t('onboard.setup.created.intro', {
            merchant: workshop.merchantName,
            price: formatCents(workshop.priceCents),
            currency: workshop.currency,
            min: workshop.minParticipants,
            capacity: workshop.capacity,
          })}
          actions={
            <StatusBadge
              tone={workshop.status === 'OFFER_OPEN' ? 'success' : 'info'}
              word={
                workshop.status === 'OFFER_OPEN'
                  ? t('onboard.setup.status.offerOpen')
                  : workshop.status === 'CLARIFYING'
                    ? t('onboard.setup.status.clarifying')
                    : t('onboard.setup.status.collecting')
              }
            />
          }
        />
        <section className="panel" aria-labelledby="created-details">
          <h2 id="created-details">{t('onboard.setup.created.facts')}</h2>
          <dl className="detail-grid">
            <div>
              <dt>{t('onboard.setup.created.venue')}</dt>
              <dd>{workshop.venue}</dd>
            </div>
            <div>
              <dt>{t('onboard.setup.created.timezone')}</dt>
              <dd>{workshop.timezone}</dd>
            </div>
            <div>
              <dt>{t('onboard.setup.created.length')}</dt>
              <dd>{t('onboard.setup.created.lengthValue', { n: workshop.durationMinutes })}</dd>
            </div>
            <div>
              <dt>{t('onboard.setup.created.includes')}</dt>
              <dd>{workshop.inclusions.join(' · ')}</dd>
            </div>
            <div>
              <dt>{t('onboard.setup.created.deadline')}</dt>
              <dd>{workshop.authDeadlineLabel}</dd>
            </div>
          </dl>
          <h3>{t('onboard.setup.created.candidateTimes')}</h3>
          <ol className="slot-list">
            {workshop.slots.map((slot) => (
              <li key={slot.id}>
                <strong>{slot.dayLabel}</strong> · {slot.timeLabel} ({slot.timezone})
              </li>
            ))}
          </ol>
        </section>

        <section className="panel panel--next" aria-labelledby="next-steps">
          <h2 id="next-steps">{t('onboard.setup.created.next')}</h2>
          <p>
            {t('onboard.setup.created.nextBefore')}
            <strong>{t('onboard.setup.created.nextConfirm')}</strong>
            {t('onboard.setup.created.nextAfter')}
          </p>
          <div className="button-row">
            <Link className="btn btn-primary" to="/organizer/plan">
              {t('onboard.setup.created.openPlan')}
            </Link>
            <Link className="btn btn-secondary" to="/participant/preferences">
              {t('onboard.setup.created.openParticipant')}
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page setup-create">
      <PageHeader
        eyebrow={t('onboard.setup.eyebrow')}
        title={t('onboard.setup.title')}
        intro={t('onboard.setup.compact.intro')}
      />
      <details className="setup-guide">
        <summary>{t('onboard.setup.compact.guide')}</summary>
        <div className="setup-guide__body">
          <p>{t('onboard.setup.intro')}</p>
          <p>{t('onboard.setup.formNoteBefore')}<strong>{t('onboard.setup.formNoteConfirm')}</strong>{t('onboard.setup.formNoteAfter')}</p>
          <button type="button" className="btn btn-secondary" onClick={() => void loadSample()} disabled={busy !== null}>
            {busy === 'sample' ? t('onboard.setup.loadingSample') : t('onboard.setup.compact.sample')}
          </button>
        </div>
      </details>

      <ErrorSummary errors={errors} />
      {apiError ? (
        <InlineNotice kind="error" title={t('onboard.setup.apiError')}>
          {apiError}
        </InlineNotice>
      ) : null}

      <div className="setup-studio">
      <aside className="draft-preview" aria-labelledby="draft-preview-title">
        <details open={draftOpen} onToggle={(event) => setDraftOpen(event.currentTarget.open)}>
          <summary id="draft-preview-title">{t('onboard.setup.preview.title')}</summary>
          <article className="draft-ticket">
            <header><span className="eyebrow">{t('onboard.setup.preview.draft')}</span><span className="draft-ticket__mark" aria-hidden="true">G</span></header>
            <p className="draft-ticket__merchant">{form.merchantName}</p>
            <h2>{form.title || t('onboard.setup.field.title')}</h2>
            <p className="draft-ticket__description">{form.description}</p>
            <dl>
              <div><dt>{t('onboard.setup.created.venue')}</dt><dd>{form.venue || '—'}</dd></div>
              <div><dt>{t('onboard.setup.created.length')}</dt><dd>{form.durationMinutes || '—'} min</dd></div>
              <div><dt>{t('onboard.setup.field.price')}</dt><dd key={form.priceDollars} className="draft-ticket__price">{parseDollarsToCents(form.priceDollars) !== null ? formatCents(parseDollarsToCents(form.priceDollars)!) : '—'} <small>USD</small></dd></div>
            </dl>
            <footer>{t('onboard.setup.preview.note')}</footer>
          </article>
        </details>
      </aside>
      <form className="form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <fieldset className="fieldset">
          <legend className="visually-hidden">{t('onboard.setup.factsLegend')}</legend>
          <h2 className="fieldset__title" aria-hidden="true">{t('onboard.setup.factsLegend')}</h2>
          <div className="field-grid">
            <TextField
              chrome={{ id: 'merchantName', label: t('onboard.setup.field.merchantName'), required: true, error: errorFor(errors, 'merchantName') }}
              value={form.merchantName}
              onChange={(event) => update('merchantName', event.target.value)}
              autoComplete="organization"
            />
            <TextField
              chrome={{ id: 'title', label: t('onboard.setup.field.title'), required: true, error: errorFor(errors, 'title') }}
              value={form.title}
              onChange={(event) => update('title', event.target.value)}
            />
          </div>
          <TextAreaField
            chrome={{
              id: 'description',
              label: t('onboard.setup.field.description'),
              required: true,
              hint: t('onboard.setup.field.descriptionHint'),
              error: errorFor(errors, 'description'),
            }}
            rows={3}
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
          />
          <TextField
            chrome={{ id: 'venue', label: t('onboard.setup.field.venue'), required: true, error: errorFor(errors, 'venue') }}
            value={form.venue}
            onChange={(event) => update('venue', event.target.value)}
          />
          <div className="field-grid field-grid--three">
            <SelectField
              chrome={{ id: 'timezone', label: t('onboard.setup.field.timezone'), required: true, error: errorFor(errors, 'timezone') }}
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
                label: t('onboard.setup.field.duration'),
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
                label: t('onboard.setup.field.price'),
                required: true,
                hint: t('onboard.setup.field.priceHint'),
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
              label: t('onboard.setup.field.inclusions'),
              required: true,
              hint: t('onboard.setup.field.inclusionsHint'),
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
                label: t('onboard.setup.field.minParticipants'),
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
                label: t('onboard.setup.field.capacity'),
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
                label: t('onboard.setup.field.authDeadline', { timezone: form.timezone }),
                required: true,
                hint: t('onboard.setup.field.authDeadlineHint'),
                error: errorFor(errors, 'authDeadline'),
              }}
              type="datetime-local"
              value={form.authDeadline}
              onChange={(event) => update('authDeadline', event.target.value)}
            />
          </div>
        </fieldset>

        <fieldset className="fieldset">
          <legend className="visually-hidden">{t('onboard.setup.slots.legend')}</legend>
          <h2 className="fieldset__title" aria-hidden="true">{t('onboard.setup.slots.legend')}</h2>
          <p className="fieldset__hint">{t('onboard.setup.slots.hint', { timezone: form.timezone })}</p>
          {errors.some((error) => error.field === 'slots') ? (
            <p className="field__error" id="slots-error">
              {errors.find((error) => error.field === 'slots')?.message}
            </p>
          ) : null}
          {form.slots.map((slot, index) => {
            const base = `slot${index + 1}`;
            return (
              <div className="slot-input" key={base}>
                <p className="slot-input__title">{t('onboard.setup.slot.title', { n: index + 1 })}</p>
                <div className="field-grid">
                  <TextField
                    chrome={{ id: `${base}-start`, label: t('onboard.setup.slot.start'), required: true, error: errorFor(errors, `${base}-start`) }}
                    type="datetime-local"
                    value={slot.start}
                    onChange={(event) => updateSlot(index, 'start', event.target.value)}
                  />
                  <TextField
                    chrome={{ id: `${base}-end`, label: t('onboard.setup.slot.end'), required: true, error: errorFor(errors, `${base}-end`) }}
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
            {busy === 'create' ? t('onboard.setup.creating') : t('onboard.setup.create')}
          </button>
          <p className="form-actions__note">{t('onboard.setup.actionsNote')}</p>
        </div>
      </form>

      </div>
    </div>
  );
}

function errorFor(errors: SummaryError[], field: string): string | undefined {
  return errors.find((error) => error.field === field)?.message;
}
