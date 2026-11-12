/* ==========================================================================
   Participant: the big question and the reviewable card.

   Two paths, both honest:
   - the structured path (three time checkboxes + an optional condition) works
     with no model at all;
   - the free-text path asks the server for an extraction and always shows HOW
     it was produced (live model / recorded sample / structured).
   Nothing counts until the person presses "Confirm my preferences"; the card is
   editable and every quote shown is a verbatim slice of their own sentence.

   All chrome goes through t(); workshop facts, slot labels, quotes and
   server-returned extraction errors stay in the language they were created in.
   ========================================================================== */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PreferenceView } from '../../shared/api.js';
import { formatInstantLabel } from '../../shared/time.js';
import { apiFieldErrors, describeError } from '../lib/api.js';
import { useI18n, type Translate } from '../lib/i18n.js';
import { useApp } from '../lib/store.js';
import { money, participantStatus, shortSlot } from '../lib/status.js';
import { ParticipantSteps, StatusBand } from '../components/workshop.js';
import {
  CheckboxField,
  EmptyState,
  ErrorSummary,
  InlineNotice,
  PageHeader,
  Quote,
  SelectField,
  StatusBadge,
  TextAreaField,
  type SummaryError,
} from '../components/ui.js';

interface EditableCondition {
  slotId: string;
  condition: string;
  sourceQuote: string;
}

interface EditablePreference {
  accepted: string[];
  preferred: string[];
  conditions: EditableCondition[];
  uncertainties: Array<{ field: string; question: string; sourceQuote: string }>;
}

function editableFrom(preference: PreferenceView): EditablePreference {
  return {
    accepted: [...preference.acceptedSlotIds],
    preferred: [...preference.preferredSlotIds],
    conditions: preference.conditions.map((condition) => ({
      slotId: condition.slotId,
      condition: condition.condition,
      sourceQuote: condition.sourceQuote,
    })),
    uncertainties: preference.uncertainties.map((uncertainty) => ({ ...uncertainty })),
  };
}

function extractionNote(preference: PreferenceView, t: Translate): string {
  switch (preference.extractionMode) {
    case 'live':
      return preference.extractionModel
        ? t('flow.preferences.extraction.liveWithModel', { model: preference.extractionModel })
        : t('flow.preferences.extraction.live');
    case 'recorded':
      return t('flow.preferences.extraction.recorded');
    case 'structured':
      return t('flow.preferences.extraction.structured');
    default:
      return t('flow.preferences.extraction.seeded');
  }
}

function extractionLabel(preference: PreferenceView, t: Translate): string {
  switch (preference.extractionMode) {
    case 'live':
      return t('flow.preferences.extraction.label.live');
    case 'recorded':
      return t('flow.preferences.extraction.label.recorded');
    case 'structured':
      return t('flow.preferences.extraction.label.structured');
    default:
      return t('flow.preferences.extraction.label.seeded');
  }
}

export default function ParticipantPreferences() {
  const { state, act } = useApp();
  const { t, locale } = useI18n();
  const [freeText, setFreeText] = useState('');
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [conditionText, setConditionText] = useState('');
  const [conditionSlot, setConditionSlot] = useState('');
  const [draft, setDraft] = useState<EditablePreference | null>(null);
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<SummaryError[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const workshop = state?.workshop ?? null;
  const participants = state?.participants ?? [];
  const viewerId = state?.session.viewParticipantId ?? participants.find((p) => p.isMe)?.id ?? null;
  const me = viewerId ? participants.find((p) => p.id === viewerId) ?? null : null;
  const preference = viewerId ? state?.preferences.find((p) => p.participantId === viewerId) ?? null : null;
  const slots = workshop?.slots ?? [];

  useEffect(() => {
    setDraft(preference ? editableFrom(preference) : null);
    if (!preference) return;
    setTicks(Object.fromEntries(preference.acceptedSlotIds.map((slotId) => [slotId, true])));
    setConditionText(preference.conditions[0]?.condition ?? '');
    if (preference.conditions[0]) setConditionSlot(preference.conditions[0].slotId);
    setFreeText(preference.sourceText ?? '');
  }, [preference?.participantId, preference?.version, preference?.status]);

  useEffect(() => {
    if (conditionSlot || slots.length === 0) return;
    setConditionSlot(slots[0]!.id);
  }, [conditionSlot, slots]);

  async function parseFreeText(): Promise<void> {
    if (!viewerId) return;
    const text = freeText.trim();
    const structuredTicks = slots.filter((slot) => ticks[slot.id]);
    if (!text && structuredTicks.length === 0) {
      setErrors([{ field: 'sourceText', message: t('flow.preferences.error.needSomething') }]);
      return;
    }
    const structuredCondition = conditionText.trim();
    const composedParts = [
      text ||
        t('flow.preferences.compose.times', {
          times: structuredTicks.map((slot) => slot.rangeLabel).join('; '),
        }),
    ];
    if (structuredCondition && !composedParts[0]!.includes(structuredCondition)) {
      composedParts.push(t('flow.preferences.compose.condition', { condition: structuredCondition }));
    }
    setBusy('parse');
    setErrors([]);
    setApiError(null);
    setNotice(null);
    try {
      await act({
        type: 'preferences.parse',
        payload: {
          sourceText: composedParts.join(' ').slice(0, 600),
          structured:
            structuredTicks.length > 0
              ? {
                  acceptedSlotIds: structuredTicks.map((slot) => slot.id),
                  preferredSlotIds: [],
                  conditions: structuredCondition
                    ? [{ slotId: conditionSlot || slots[0]!.id, condition: structuredCondition.slice(0, 200) }]
                    : [],
                }
              : undefined,
        },
      });
    } catch (caught) {
      setErrors(apiFieldErrors(caught).map((field) => ({ field: field.field, message: field.message })));
      setApiError(describeError(caught));
    } finally {
      setBusy(null);
    }
  }

  async function confirmPreferences(): Promise<void> {
    if (!preference || !draft) return;
    if (draft.accepted.length === 0) {
      setErrors([
        {
          field: 'must-have',
          message: t('flow.preferences.error.needTime'),
        },
      ]);
      return;
    }
    if (draft.preferred.some((slotId) => !draft.accepted.includes(slotId))) {
      setErrors([{ field: 'preferred', message: t('flow.preferences.error.preferredMustBeAccepted') }]);
      return;
    }
    setBusy('confirm');
    setErrors([]);
    setApiError(null);
    try {
      await act({
        type: 'preferences.confirm',
        payload: {
          version: preference.version,
          acceptedSlotIds: draft.accepted,
          preferredSlotIds: draft.preferred,
          conditions: draft.conditions
            .filter((condition) => condition.condition.trim().length > 0)
            .map((condition) => ({
              slotId: condition.slotId,
              condition: condition.condition.trim().slice(0, 200),
              sourceQuote: condition.sourceQuote.slice(0, 400),
            })),
          uncertainties: draft.uncertainties.map((uncertainty) => ({
            field: uncertainty.field,
            question: uncertainty.question,
            sourceQuote: uncertainty.sourceQuote,
          })),
        },
      });
      setEditing(false);
      setNotice(t('flow.preferences.notice.confirmed'));
    } catch (caught) {
      setErrors(apiFieldErrors(caught).map((field) => ({ field: field.field, message: field.message })));
      setApiError(describeError(caught));
    } finally {
      setBusy(null);
    }
  }

  async function withdraw(): Promise<void> {
    if (!viewerId) return;
    setBusy('withdraw');
    setApiError(null);
    try {
      await act({ type: 'participants.withdraw', id: viewerId });
      setNotice(t('flow.preferences.notice.withdrawn'));
    } catch (caught) {
      setApiError(describeError(caught));
    } finally {
      setBusy(null);
    }
  }

  if (!state) return null;
  if (!workshop) {
    return (
      <EmptyState title={t('flow.preferences.empty.noWorkshop.title')} action={<Link className="btn btn-secondary" to="/organizer/setup">{t('flow.preferences.empty.noWorkshop.action')}</Link>}>
        <p>{t('flow.preferences.empty.noWorkshop.body')}</p>
      </EmptyState>
    );
  }
  if (!me) {
    return (
      <EmptyState title={t('flow.preferences.empty.organizer.title')}>
        <p>{t('flow.preferences.empty.organizer.body')}</p>
      </EmptyState>
    );
  }

  const status = preference?.status ?? null;
  const confirmed = status === 'CONFIRMED' && !editing;
  const withdrawn = status === 'WITHDRAWN';
  const participantSummary = participantStatus(state, locale);

  return (
    <div className="page page--narrow">
      <PageHeader
        eyebrow={t('flow.participant.eyebrow', { name: me.displayName })}
        title={t('flow.preferences.title')}
        intro={t('flow.preferences.intro')}
        actions={
          preference ? (
            <StatusBadge
              tone={confirmed ? 'success' : withdrawn ? 'neutral' : 'warning'}
              word={
                confirmed
                  ? t('flow.preferences.badge.confirmed')
                  : withdrawn
                    ? t('flow.preferences.badge.withdrawn')
                    : t('flow.preferences.badge.unconfirmed')
              }
            />
          ) : undefined
        }
      />

      {workshop ? (
        <section className="workshop-strip workshop-strip--participant" aria-label={t('flow.preferences.strip.aria')}>
          {workshop.coverImageUrl ? (
            <img className="workshop-strip__cover" src={workshop.coverImageUrl} alt=""
            onError={(event) => { event.currentTarget.style.display = 'none'; }} width={132} height={99} loading="lazy" />
          ) : null}
          <div className="workshop-strip__body">
            <p className="workshop-strip__title">{workshop.title}</p>
            <p className="workshop-strip__facts">
              <span>{workshop.merchantName}</span>
              <span aria-hidden="true">·</span>
              <span>{workshop.slots.map((slot) => shortSlot(slot.rangeLabel)).join(' · ')}</span>
              <span aria-hidden="true">·</span>
              <span>{money(workshop.priceCents)}</span>
              <span aria-hidden="true">·</span>
              <span>{t('flow.strip.minimum', { count: workshop.minParticipants })}</span>
            </p>
          </div>
        </section>
      ) : null}

      {participantSummary ? (
        <>
          <StatusBand model={participantSummary} />
          <ParticipantSteps steps={participantSummary.steps} />
        </>
      ) : null}

      {notice ? (
        <InlineNotice kind="success" title={t('flow.action.done')}>
          {notice}
        </InlineNotice>
      ) : null}
      {apiError ? (
        <InlineNotice kind="error" title={t('flow.preferences.notice.errorTitle')}>
          {apiError}
        </InlineNotice>
      ) : null}
      <ErrorSummary errors={errors} />

      {confirmed && preference ? (
        <ConfirmedView
          preference={preference}
          offerOpen={Boolean(state?.offer?.isOpen && state.offer.viewerIncluded)}
          onEdit={() => {
            setEditing(true);
            setNotice(null);
          }}
          onWithdraw={() => void withdraw()}
          withdrawing={busy === 'withdraw'}
        />
      ) : (
        <>
          {!confirmed ? (
            <section className="panel" aria-labelledby="answer-panel">
              <h2 id="answer-panel">{preference ? t('flow.preferences.answer.changeTitle') : t('flow.preferences.answer.title')}</h2>
              <p className="muted">{t('flow.preferences.answer.equalPaths')}</p>
              <p className="muted">{t('flow.preferences.answer.purpose')}</p>

              <div className="answer-grid">
                <div className="answer-path">
                  <h3>{t('flow.preferences.free.heading')}</h3>
                  <TextAreaField
                    chrome={{
                      id: 'sourceText',
                      label: t('flow.preferences.free.label'),
                      hint: t('flow.preferences.free.hint', { count: freeText.length }),
                      error: errorFor(errors, 'sourceText'),
                    }}
                    rows={4}
                    maxLength={600}
                    value={freeText}
                    onChange={(event) => setFreeText(event.target.value)}
                    placeholder={t('flow.preferences.free.placeholder')}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void parseFreeText()}
                    disabled={busy !== null}
                  >
                    {busy === 'parse' ? t('flow.preferences.free.extracting') : t('flow.preferences.free.extract')}
                  </button>
                </div>

                <div className="answer-path answer-path--structured">
                  <h3>{t('flow.preferences.structured.heading')}</h3>
                  <fieldset className="fieldset fieldset--plain">
                    <legend className="visually-hidden">{t('flow.preferences.structured.legend')}</legend>
                    {slots.map((slot) => (
                      <CheckboxField
                        key={slot.id}
                        id={`tick-${slot.id}`}
                        checked={Boolean(ticks[slot.id])}
                        onChange={(checked) => setTicks((current) => ({ ...current, [slot.id]: checked }))}
                        label={slot.rangeLabel}
                      />
                    ))}
                  </fieldset>
                  <TextAreaField
                    chrome={{
                      id: 'conditionText',
                      label: t('flow.preferences.structured.conditionLabel'),
                      hint: t('flow.preferences.structured.conditionHint'),
                    }}
                    rows={2}
                    value={conditionText}
                    onChange={(event) => setConditionText(event.target.value)}
                    placeholder={t('flow.preferences.structured.conditionPlaceholder')}
                  />
                  <SelectField
                    chrome={{ id: 'conditionSlot', label: t('flow.preferences.structured.conditionSlot') }}
                    value={conditionSlot}
                    onChange={(event) => setConditionSlot(event.target.value)}
                  >
                    {slots.map((slot) => (
                      <option key={slot.id} value={slot.id}>
                        {slot.rangeLabel}
                      </option>
                    ))}
                  </SelectField>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void parseFreeText()}
                    disabled={busy !== null}
                  >
                    {busy === 'parse' ? t('flow.preferences.structured.building') : t('flow.preferences.structured.useTimes')}
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {preference && draft ? (
            <ReviewCard
              preference={preference}
              draft={draft}
              onChange={setDraft}
              busy={busy === 'confirm'}
              onConfirm={() => void confirmPreferences()}
              onWithdraw={() => void withdraw()}
              withdrawing={busy === 'withdraw'}
            />
          ) : null}
        </>
      )}

      <p className="page__footnote">{t('flow.preferences.footnote')}</p>
    </div>
  );
}

function errorFor(errors: SummaryError[], field: string): string | undefined {
  return errors.find((error) => error.field === field)?.message;
}

function ReviewCard({
  preference,
  draft,
  onChange,
  busy,
  onConfirm,
  onWithdraw,
  withdrawing,
}: {
  preference: PreferenceView;
  draft: EditablePreference;
  onChange: (next: EditablePreference) => void;
  busy: boolean;
  onConfirm: () => void;
  onWithdraw: () => void;
  withdrawing: boolean;
}) {
  const { t } = useI18n();
  const workshop = useApp().state?.workshop;
  const slots = workshop?.slots ?? [];
  const preferredAvailable = draft.accepted;
  const slotLabel = (slotId: string): string => slots.find((slot) => slot.id === slotId)?.rangeLabel ?? slotId;
  const sourceQuote = preference.sourceText ?? '';
  const sharedTimes = draft.accepted.map(slotLabel).join(', ') || t('flow.preferences.review.nothingYet');
  const sharedLine =
    draft.conditions.length > 0
      ? t('flow.preferences.review.sharedWithConditions', {
          times: sharedTimes,
          conditions: draft.conditions.map((condition) => condition.condition).join('; '),
        })
      : t('flow.preferences.review.shared', { times: sharedTimes });

  function toggleAccepted(slotId: string, checked: boolean): void {
    const accepted = checked ? [...new Set([...draft.accepted, slotId])] : draft.accepted.filter((id) => id !== slotId);
    onChange({
      ...draft,
      accepted,
      preferred: draft.preferred.filter((id) => accepted.includes(id)),
    });
  }

  function togglePreferred(slotId: string, checked: boolean): void {
    onChange({
      ...draft,
      preferred: checked ? [...new Set([...draft.preferred, slotId])] : draft.preferred.filter((id) => id !== slotId),
    });
  }

  return (
    <section className="panel panel--card" aria-labelledby="review-card-title">
      <div className="panel__head">
        <div>
          <h2 id="review-card-title">{t('flow.preferences.review.title')}</h2>
          <p className="muted">{extractionNote(preference, t)}</p>
        </div>
        <span className="chip chip--mode">{extractionLabel(preference, t)}</span>
      </div>

      {sourceQuote ? <Quote label={t('flow.preferences.review.sourceLabel')}>{sourceQuote}</Quote> : null}

      <div className="review-group" id="must-have">
        <h3>
          {t('flow.preferences.review.mustHave')} <span className="review-group__hint">{t('flow.preferences.review.mustHaveHint')}</span>
        </h3>
        {slots.map((slot) => (
          <CheckboxField
            key={slot.id}
            id={`accept-${slot.id}`}
            checked={draft.accepted.includes(slot.id)}
            onChange={(checked) => toggleAccepted(slot.id, checked)}
            label={slot.rangeLabel}
            description={
              preference.conditions.some((condition) => condition.slotId === slot.id) ? (
                <span className="inline-note">{t('flow.preferences.review.dependsOnCondition')}</span>
              ) : undefined
            }
          />
        ))}
        {sourceQuote ? <RowQuote quote={sourceQuote} /> : null}
      </div>

      <div className="review-group" id="preferred">
        <h3>
          {t('flow.preferences.review.preferred')} <span className="review-group__hint">{t('flow.preferences.review.preferredHint')}</span>
        </h3>
        {preferredAvailable.length === 0 ? (
          <p className="muted">{t('flow.preferences.review.tickFirst')}</p>
        ) : (
          slots
            .filter((slot) => draft.accepted.includes(slot.id))
            .map((slot) => (
              <CheckboxField
                key={slot.id}
                id={`prefer-${slot.id}`}
                checked={draft.preferred.includes(slot.id)}
                onChange={(checked) => togglePreferred(slot.id, checked)}
                label={slot.rangeLabel}
              />
            ))
        )}
        {sourceQuote ? <RowQuote quote={sourceQuote} /> : null}
      </div>

      <div className="review-group" id="clarify">
        <h3>
          {t('flow.preferences.review.clarify')} <span className="review-group__hint">{t('flow.preferences.review.clarifyHint')}</span>
        </h3>
        {draft.conditions.length === 0 && draft.uncertainties.length === 0 ? (
          <p className="muted">{t('flow.preferences.review.nothingToClarify')}</p>
        ) : null}
        {draft.conditions.map((condition, index) => (
          <div className="condition-row" key={`${condition.slotId}-${index}`}>
            <TextAreaField
              chrome={{
                id: `condition-${index}`,
                label: t('flow.preferences.review.conditionLabel', { index: index + 1 }),
                hint: t('flow.preferences.review.conditionHint'),
              }}
              rows={2}
              value={condition.condition}
              onChange={(event) =>
                onChange({
                  ...draft,
                  conditions: draft.conditions.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, condition: event.target.value } : entry,
                  ),
                })
              }
            />
            <SelectField
              chrome={{ id: `condition-slot-${index}`, label: t('flow.preferences.review.appliesTo') }}
              value={condition.slotId}
              onChange={(event) =>
                onChange({
                  ...draft,
                  conditions: draft.conditions.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, slotId: event.target.value } : entry,
                  ),
                })
              }
            >
              {slots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.rangeLabel}
                </option>
              ))}
            </SelectField>
            <Quote label={t('flow.preferences.review.conditionQuoteLabel')}>{condition.sourceQuote}</Quote>
            <button
              type="button"
              className="btn btn-ghost btn--small"
              onClick={() =>
                onChange({ ...draft, conditions: draft.conditions.filter((_, entryIndex) => entryIndex !== index) })
              }
            >
              {t('flow.preferences.review.removeCondition')}
            </button>
          </div>
        ))}
        {draft.uncertainties.map((uncertainty, index) => (
          <div className="uncertainty" key={`${uncertainty.field}-${index}`}>
            <StatusBadge tone="warning" word={t('flow.preferences.review.needsClarificationBadge')} />
            <p>{uncertainty.question}</p>
            <RowQuote quote={uncertainty.sourceQuote} />
          </div>
        ))}
        <p className="muted">{t('flow.preferences.review.questionPolicy')}</p>
      </div>

      <div className="confirm-block">
        <p className="confirm-block__promise">
          <strong>{t('flow.preferences.review.promiseTitle')}</strong> {t('flow.preferences.review.promiseRest')}
        </p>
        <button type="button" className="btn btn-primary btn--large" onClick={onConfirm} disabled={busy || withdrawing}>
          {busy ? t('flow.preferences.review.confirming') : t('flow.preferences.review.confirm')}
        </button>
      </div>

      <details className="danger-zone">
        <summary>{t('flow.preferences.withdraw.summary')}</summary>
        <p>{t('flow.preferences.withdraw.bodyDraft')}</p>
        <button type="button" className="btn btn-secondary" onClick={onWithdraw} disabled={busy || withdrawing}>
          {withdrawing ? t('flow.preferences.withdraw.withdrawing') : t('flow.preferences.withdraw.button')}
        </button>
      </details>

      <p className="muted">{sharedLine}</p>
    </section>
  );
}

function RowQuote({ quote }: { quote: string }) {
  return <p className="row-quote">“{quote}”</p>;
}

function ConfirmedView({
  preference,
  offerOpen,
  onEdit,
  onWithdraw,
  withdrawing,
}: {
  preference: PreferenceView;
  offerOpen: boolean;
  onEdit: () => void;
  onWithdraw: () => void;
  withdrawing: boolean;
}) {
  const { state } = useApp();
  const { t } = useI18n();
  const timezone = state?.workshop?.timezone ?? 'UTC';
  return (
    <section className="panel panel--card" aria-labelledby="confirmed-title">
      <div className="panel__head">
        <div>
          <h2 id="confirmed-title">{t('flow.preferences.confirmed.title')}</h2>
          <p className="muted">
            {preference.confirmedAt
              ? t('flow.preferences.confirmed.meta', {
                  when: formatInstantLabel(preference.confirmedAt, timezone),
                  version: preference.version,
                })
              : t('flow.preferences.confirmed.version', { version: preference.version })}
          </p>
        </div>
        <StatusBadge tone="success" word={t('flow.preferences.badge.confirmed')} />
      </div>

      <dl className="detail-grid">
        <div>
          <dt>{t('flow.preferences.confirmed.mustHave')}</dt>
          <dd>{preference.acceptedSlotLabels.join(' · ') || '—'}</dd>
        </div>
        <div>
          <dt>{t('flow.preferences.confirmed.preferred')}</dt>
          <dd>{preference.preferredSlotLabels.join(' · ') || t('flow.preferences.confirmed.noPreference')}</dd>
        </div>
      </dl>

      {preference.conditions.length > 0 ? (
        <div className="confirmed-conditions">
          <h3>{t('flow.preferences.confirmed.needsFact')}</h3>
          {preference.conditions.map((condition) => (
            <div key={condition.slotId} className="confirmed-condition">
              <p>
                <strong>{condition.slotLabel}</strong>{' '}
                {t('flow.preferences.confirmed.conditionSuffix', { condition: condition.condition })}
              </p>
              <Quote label={t('flow.preferences.confirmed.quoteLabel')}>{condition.sourceQuote}</Quote>
            </div>
          ))}
          <p className="muted">{t('flow.preferences.confirmed.questionNote')}</p>
        </div>
      ) : null}

      <div className="button-row">
        {offerOpen ? (
          <Link className="btn btn-primary" to="/participant/authorize">
            {t('flow.preferences.confirmed.reviewOffer')}
          </Link>
        ) : null}
        <button type="button" className="btn btn-secondary" onClick={onEdit}>
          {t('flow.preferences.confirmed.update')}
        </button>
      </div>

      <details className="danger-zone">
        <summary>{t('flow.preferences.withdraw.summary')}</summary>
        <p>{t('flow.preferences.confirmed.withdrawBody')}</p>
        <button type="button" className="btn btn-secondary" onClick={onWithdraw} disabled={withdrawing}>
          {withdrawing ? t('flow.preferences.withdraw.withdrawing') : t('flow.preferences.withdraw.button')}
        </button>
      </details>
    </section>
  );
}
