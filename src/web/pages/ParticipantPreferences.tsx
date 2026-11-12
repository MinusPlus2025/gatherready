/* ==========================================================================
   Participant: the big question and the reviewable card.

   Two paths, both honest:
   - the structured path (three time checkboxes + an optional condition) works
     with no model at all;
   - the free-text path asks the server for an extraction and always shows HOW
     it was produced (live model / recorded sample / structured).
   Nothing counts until the person presses "Confirm my preferences"; the card is
   editable and every quote shown is a verbatim slice of their own sentence.
   ========================================================================== */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PreferenceView } from '../../shared/api.js';
import { formatInstantLabel } from '../../shared/time.js';
import { apiFieldErrors, describeError } from '../lib/api.js';
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

function extractionNote(preference: PreferenceView): string {
  switch (preference.extractionMode) {
    case 'live':
      return `Extracted by a live model${preference.extractionModel ? ` (${preference.extractionModel})` : ''}. Check and edit it before confirming — the model never gets the last word.`;
    case 'recorded':
      return 'Recorded sample: a checked-in demo fixture, not a live model answer for arbitrary text. Check and edit it before confirming.';
    case 'structured':
      return 'Structured: built only from the times you ticked and the condition you typed. No AI was used.';
    default:
      return 'Seeded demo preference. Check and edit it before confirming.';
  }
}

function extractionLabel(preference: PreferenceView): string {
  switch (preference.extractionMode) {
    case 'live':
      return 'Live model extraction';
    case 'recorded':
      return 'Recorded sample extraction';
    case 'structured':
      return 'Structured — no AI';
    default:
      return 'Seed extraction';
  }
}

export default function ParticipantPreferences() {
  const { state, act } = useApp();
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
      setErrors([{ field: 'sourceText', message: 'Write a sentence or tick at least one time.' }]);
      return;
    }
    const structuredCondition = conditionText.trim();
    const composedParts = [
      text || `These times work for me: ${structuredTicks.map((slot) => slot.rangeLabel).join('; ')}.`,
    ];
    if (structuredCondition && !composedParts[0]!.includes(structuredCondition)) {
      composedParts.push(`My condition: ${structuredCondition}.`);
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
          message: 'Choose at least one time that works for you — or withdraw instead.',
        },
      ]);
      return;
    }
    if (draft.preferred.some((slotId) => !draft.accepted.includes(slotId))) {
      setErrors([{ field: 'preferred', message: 'A preferred time must also be a time that works for you.' }]);
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
      setNotice('Preferences confirmed. Nothing was shared with other participants; the organizer sees only your constraints.');
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
      setNotice('You withdrew. You are not counted in the plan and you will not be asked again.');
    } catch (caught) {
      setApiError(describeError(caught));
    } finally {
      setBusy(null);
    }
  }

  if (!state) return null;
  if (!workshop) {
    return (
      <EmptyState title="No workshop to answer yet" action={<Link className="btn btn-secondary" to="/organizer/setup">Set up the demo workshop</Link>}>
        <p>The organizer has not published a workshop. Once they do, this page will show the three candidate times.</p>
      </EmptyState>
    );
  }
  if (!me) {
    return (
      <EmptyState title="This page belongs to a participant">
        <p>
          The current session is an organizer view. Use the demo view switcher above to act as one of the
          synthetic participants.
        </p>
      </EmptyState>
    );
  }

  const status = preference?.status ?? null;
  const confirmed = status === 'CONFIRMED' && !editing;
  const withdrawn = status === 'WITHDRAWN';
  const participantSummary = state ? participantStatus(state) : null;

  return (
    <div className="page page--narrow">
      <PageHeader
        eyebrow={`Participant · ${me.displayName}`}
        title="What would make this workshop work for you?"
        intro="Answer in your own words, or just tick the times that work. We turn it into a short, reviewable card — nothing counts until you confirm it."
        actions={
          preference ? (
            <StatusBadge
              tone={confirmed ? 'success' : withdrawn ? 'neutral' : 'warning'}
              word={confirmed ? 'Confirmed' : withdrawn ? 'Withdrawn' : 'Not confirmed yet'}
            />
          ) : undefined
        }
      />

      {workshop ? (
        <section className="workshop-strip workshop-strip--participant" aria-label="The workshop">
          {workshop.coverImageUrl ? (
            <img className="workshop-strip__cover" src={workshop.coverImageUrl} alt="" width={132} height={99} loading="lazy" />
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
              <span>minimum {workshop.minParticipants}</span>
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
        <InlineNotice kind="success" title="Done">
          {notice}
        </InlineNotice>
      ) : null}
      {apiError ? (
        <InlineNotice kind="error" title="Nothing was saved">
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
              <h2 id="answer-panel">{preference ? 'Change your answer' : 'Your answer'}</h2>
              <p className="muted">
                Both paths are equal: if you would rather not write free text, the checkboxes below work without
                any AI. Start from either one to rebuild the card underneath.
              </p>
              <p className="muted">
                Purpose notice: your sentence is sent only to the configured model service to extract these
                constraints. It is not written to logs, and synthetic demo text is deleted within 7 days. This is
                a sandbox prototype — no real money moves.
              </p>

              <div className="answer-grid">
                <div className="answer-path">
                  <h3>In your own words</h3>
                  <TextAreaField
                    chrome={{
                      id: 'sourceText',
                      label: 'Your sentence',
                      hint: `${freeText.length}/600 characters. Kept only for this workshop; the organizer sees constraints, not your private reasons.`,
                      error: errorFor(errors, 'sourceText'),
                    }}
                    rows={4}
                    maxLength={600}
                    value={freeText}
                    onChange={(event) => setFreeText(event.target.value)}
                    placeholder="Saturday morning works for me if all the materials are included…"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void parseFreeText()}
                    disabled={busy !== null}
                  >
                    {busy === 'parse' ? 'Extracting…' : 'Extract conditions'}
                  </button>
                </div>

                <div className="answer-path answer-path--structured">
                  <h3>Or just tick what works</h3>
                  <fieldset className="fieldset fieldset--plain">
                    <legend className="visually-hidden">Times that work for you</legend>
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
                      label: 'Optional: what has to be true?',
                      hint: 'One condition at most. The organizer may ask the merchant exactly one yes/no question about it.',
                    }}
                    rows={2}
                    value={conditionText}
                    onChange={(event) => setConditionText(event.target.value)}
                    placeholder="If all the materials are included…"
                  />
                  <SelectField
                    chrome={{ id: 'conditionSlot', label: 'Which time does the condition apply to?' }}
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
                    {busy === 'parse' ? 'Building…' : 'Use these times'}
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

      <p className="page__footnote">
        Changed your mind? You can confirm a new version until the offer closes, and withdraw without a reason.
      </p>
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
  const workshop = useApp().state?.workshop;
  const slots = workshop?.slots ?? [];
  const preferredAvailable = draft.accepted;
  const slotLabel = (slotId: string): string => slots.find((slot) => slot.id === slotId)?.rangeLabel ?? slotId;
  const sourceQuote = preference.sourceText ?? '';

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
          <h2 id="review-card-title">Review what we understood</h2>
          <p className="muted">{extractionNote(preference)}</p>
        </div>
        <span className="chip chip--mode">{extractionLabel(preference)}</span>
      </div>

      {sourceQuote ? <Quote label="Your sentence, verbatim">{sourceQuote}</Quote> : null}

      <div className="review-group" id="must-have">
        <h3>
          Must have <span className="review-group__hint">times that work for you</span>
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
                <span className="inline-note">This time depends on the condition below.</span>
              ) : undefined
            }
          />
        ))}
        {sourceQuote ? <RowQuote quote={sourceQuote} /> : null}
      </div>

      <div className="review-group" id="preferred">
        <h3>
          Preferred <span className="review-group__hint">a nice-to-have, never a requirement</span>
        </h3>
        {preferredAvailable.length === 0 ? (
          <p className="muted">Tick a time under “Must have” first.</p>
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
          Needs clarification <span className="review-group__hint">at most one question per person</span>
        </h3>
        {draft.conditions.length === 0 && draft.uncertainties.length === 0 ? (
          <p className="muted">Nothing needs clarifying from your answer.</p>
        ) : null}
        {draft.conditions.map((condition, index) => (
          <div className="condition-row" key={`${condition.slotId}-${index}`}>
            <TextAreaField
              chrome={{
                id: `condition-${index}`,
                label: `Condition ${index + 1}`,
                hint: 'Plain language, one condition. The organizer may ask the merchant one yes/no question about it.',
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
              chrome={{ id: `condition-slot-${index}`, label: 'Applies to' }}
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
            <Quote label="From your sentence, verbatim">{condition.sourceQuote}</Quote>
            <button
              type="button"
              className="btn btn-ghost btn--small"
              onClick={() =>
                onChange({ ...draft, conditions: draft.conditions.filter((_, entryIndex) => entryIndex !== index) })
              }
            >
              Remove condition
            </button>
          </div>
        ))}
        {draft.uncertainties.map((uncertainty, index) => (
          <div className="uncertainty" key={`${uncertainty.field}-${index}`}>
            <StatusBadge tone="warning" word="Needs clarification" />
            <p>{uncertainty.question}</p>
            <RowQuote quote={uncertainty.sourceQuote} />
          </div>
        ))}
        <p className="muted">
          A question is asked only when one merchant fact could change whether this time works. You can answer
          yes or no, and a no is respected.
        </p>
      </div>

      <div className="confirm-block">
        <p className="confirm-block__promise">
          <strong>Nothing counts until you confirm.</strong> Until then your answer is a draft only you can see.
        </p>
        <button type="button" className="btn btn-primary btn--large" onClick={onConfirm} disabled={busy || withdrawing}>
          {busy ? 'Confirming…' : 'Confirm my preferences'}
        </button>
      </div>

      <details className="danger-zone">
        <summary>Withdraw from this workshop</summary>
        <p>
          Withdrawing removes you from the plan immediately. You are not counted, you are not asked again, and no
          one is charged on your behalf.
        </p>
        <button type="button" className="btn btn-secondary" onClick={onWithdraw} disabled={busy || withdrawing}>
          {withdrawing ? 'Withdrawing…' : 'Withdraw my preferences'}
        </button>
      </details>

      <p className="muted">
        Shared with the merchant: {draft.accepted.map(slotLabel).join(', ') || 'nothing yet'}
        {draft.conditions.length > 0 ? `; conditions: ${draft.conditions.map((condition) => condition.condition).join('; ')}` : ''}.
      </p>
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
  const timezone = state?.workshop?.timezone ?? 'UTC';
  return (
    <section className="panel panel--card" aria-labelledby="confirmed-title">
      <div className="panel__head">
        <div>
          <h2 id="confirmed-title">Preferences confirmed</h2>
          <p className="muted">
            {preference.confirmedAt
              ? `Confirmed ${formatInstantLabel(preference.confirmedAt, timezone)}. Version ${preference.version}.`
              : `Version ${preference.version}.`}
          </p>
        </div>
        <StatusBadge tone="success" word="Confirmed" />
      </div>

      <dl className="detail-grid">
        <div>
          <dt>Must have</dt>
          <dd>{preference.acceptedSlotLabels.join(' · ') || '—'}</dd>
        </div>
        <div>
          <dt>Preferred</dt>
          <dd>{preference.preferredSlotLabels.join(' · ') || 'No preference between them'}</dd>
        </div>
      </dl>

      {preference.conditions.length > 0 ? (
        <div className="confirmed-conditions">
          <h3>Still needs a merchant fact</h3>
          {preference.conditions.map((condition) => (
            <div key={condition.slotId} className="confirmed-condition">
              <p>
                <strong>{condition.slotLabel}</strong> only works if {condition.condition}.
              </p>
              <Quote label="Your words, verbatim">{condition.sourceQuote}</Quote>
            </div>
          ))}
          <p className="muted">At most one yes/no question may be sent to you about this. It is not a commitment.</p>
        </div>
      ) : null}

      <div className="button-row">
        {offerOpen ? (
          <Link className="btn btn-primary" to="/participant/authorize">
            Review the open offer
          </Link>
        ) : null}
        <button type="button" className="btn btn-secondary" onClick={onEdit}>
          Review and update preferences
        </button>
      </div>

      <details className="danger-zone">
        <summary>Withdraw from this workshop</summary>
        <p>Withdrawing removes you from the plan immediately and releases any hold. No one is charged on your behalf.</p>
        <button type="button" className="btn btn-secondary" onClick={onWithdraw} disabled={withdrawing}>
          {withdrawing ? 'Withdrawing…' : 'Withdraw my preferences'}
        </button>
      </details>
    </section>
  );
}
