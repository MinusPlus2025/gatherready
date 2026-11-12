/* ==========================================================================
   Organizer: the plan.

   Three deliberately separate numbers — Interested, Fits this plan, Payment
   authorized — because collapsing them into "registered" would be the lie this
   product exists to avoid. Conditions are shown as constraints only; the
   participant's private sentence is never shown to the organizer.

   At most one suggested question is ever displayed, with the concrete gap it
   would close, and the organizer has to review it before it is sent.
   ========================================================================== */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { PlanView } from '../../shared/api.js';
import { apiFieldErrors, describeError } from '../lib/api.js';
import { clarificationStatusWord, type Tone } from '../lib/format.js';
import { useApp } from '../lib/store.js';
import { AuditTrail, EmptyState, InlineNotice, PageHeader, StatusBadge } from '../components/ui.js';

const STATUS_TONE: Record<string, Tone> = {
  PROPOSED: 'info',
  SENT: 'progress',
  ANSWERED_YES: 'success',
  ANSWERED_NO: 'neutral',
  CANCELLED: 'neutral',
};

export default function OrganizerPlan() {
  const { state, act } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const workshop = state?.workshop ?? null;
  const plan = state?.plan ?? null;
  const preferences = state?.preferences ?? [];
  const clarifications = state?.clarifications ?? [];
  const confirmedCount = preferences.filter((preference) => preference.status === 'CONFIRMED').length;
  const authorizedCount = state?.payments.filter((payment) => payment.status === 'AUTHORIZED').length ?? 0;

  async function recompute(): Promise<void> {
    setBusy('recompute');
    setError(null);
    try {
      await act({ type: 'plans.compute' });
      setNotice('Plan recomputed from the latest confirmed preferences.');
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(null);
    }
  }

  async function sendQuestion(clarificationId: string, participantName: string): Promise<void> {
    setBusy('send');
    setError(null);
    try {
      await act({ type: 'clarifications.send', id: clarificationId });
      setReviewing(false);
      setNotice(`Question sent to ${participantName}. This is the one question they will receive.`);
    } catch (caught) {
      const fields = apiFieldErrors(caught);
      setError(fields.length > 0 ? fields.map((field) => field.message).join(' ') : describeError(caught));
    } finally {
      setBusy(null);
    }
  }

  if (!workshop) {
    return (
      <EmptyState
        title="No workshop yet"
        action={
          <Link className="btn btn-primary" to="/organizer/setup">
            Set up a workshop
          </Link>
        }
      >
        <p>The plan appears once the workshop exists and people have confirmed their preferences.</p>
      </EmptyState>
    );
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Organizer"
        title="The plan"
        intro="Who is interested, who actually fits a single time, and who has authorized money — three different numbers, never collapsed into “registered”."
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => void recompute()} disabled={busy !== null}>
            {busy === 'recompute' ? 'Recomputing…' : 'Recompute plan'}
          </button>
        }
      />

      {notice ? (
        <InlineNotice kind="success" title="Updated">
          {notice}
        </InlineNotice>
      ) : null}
      {error ? (
        <InlineNotice kind="error" title="That did not work">
          {error}
        </InlineNotice>
      ) : null}

      <section className="counts" aria-label="Three different counts">
        <div className="count-card">
          <p className="count-card__label">Interested</p>
          <p className="count-card__value">{plan?.counts.interested ?? state?.participants.length ?? 0}</p>
          <p className="count-card__detail">People who wrote a preference</p>
        </div>
        <div className="count-card count-card--accent">
          <p className="count-card__label">Fits this plan</p>
          <p className="count-card__value">{plan?.counts.fitsThisPlan ?? confirmedCount}</p>
          <p className="count-card__detail">Confirmed preferences that fit one time</p>
        </div>
        <div className="count-card">
          <p className="count-card__label">Payment authorized</p>
          <p className="count-card__value">{plan?.counts.authorized ?? authorizedCount}</p>
          <p className="count-card__detail">Authorized, not captured — no money has moved</p>
        </div>
      </section>

      {!plan ? (
        <EmptyState title="The plan is not computed yet" action={
          <button type="button" className="btn btn-secondary" onClick={() => void recompute()} disabled={busy !== null}>
            Recompute plan
          </button>
        }>
          <p>
            {confirmedCount > 0
              ? `${confirmedCount} confirmed ${confirmedCount === 1 ? 'preference is' : 'preferences are'} waiting. Recompute the plan to see which time can work.`
              : 'No one has confirmed a preference yet. Use the demo view switcher above to act as a participant and confirm one.'}
          </p>
        </EmptyState>
      ) : (
        <>
          <div className="plan-grid">
            <section className="panel plan-panel" aria-labelledby="candidate-times">
              <h2 id="candidate-times">Candidate times</h2>
              <p className="muted">
                Minimum {plan.minimum} · capacity {plan.capacity}. Confirmed fit counts only; a conditional
                participant is shown separately and never counted as fitting.
              </p>
              <ul className="slot-cards">
                {plan.slots.map((slot) => (
                  <li
                    key={slot.slotId}
                    className={`slot-card${slot.slotId === plan.workableSlotId ? ' slot-card--workable' : ''}`}
                  >
                    <div className="slot-card__top">
                      <p className="slot-card__label">{slot.label}</p>
                      <StatusBadge
                        tone={slot.meetsMinimum ? 'success' : slot.reachableMax >= plan.minimum ? 'warning' : 'neutral'}
                        word={
                          slot.meetsMinimum
                            ? 'Meets minimum'
                            : slot.reachableMax >= plan.minimum
                              ? 'Reachable with a yes'
                              : 'Below minimum'
                        }
                      />
                    </div>
                    <p className="slot-card__fits">
                      <strong>{slot.fits}</strong> confirmed fit{slot.fits === 1 ? '' : 's'}
                      {slot.fitNames.length > 0 ? <span className="slot-card__names"> — {slot.fitNames.join(', ')}</span> : null}
                    </p>
                    <p className="slot-card__meta">
                      {slot.conditionalCount > 0
                        ? `+${slot.conditionalCount} reachable only with a yes (${slot.conditionalNames.join(', ')}) · ceiling ${slot.reachableMax}`
                        : `No pending conditions · ceiling ${slot.reachableMax}`}
                      {slot.preferredSatisfiedCount > 0
                        ? ` · ${slot.preferredSatisfiedCount} preferred ${slot.preferredSatisfiedCount === 1 ? 'match' : 'matches'}`
                        : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel plan-panel" aria-labelledby="pending-conditions">
              <h2 id="pending-conditions">Pending conditions</h2>
              <p className="muted">What would have to be true before someone could fit. Constraints only, never private reasons.</p>
              {preferences.every((preference) => preference.conditions.length === 0) ? (
                <p className="muted">No pending conditions.</p>
              ) : (
                <ul className="condition-list">
                  {preferences.flatMap((preference) =>
                    preference.conditions.map((condition) => {
                      const clarification = clarifications.find(
                        (item) => item.participantId === preference.participantId && item.slotId === condition.slotId,
                      );
                      return (
                        <li key={`${preference.participantId}-${condition.slotId}`} className="condition-item">
                          <div className="condition-item__head">
                            <strong>{preference.displayName}</strong>
                            <StatusBadge
                              tone={clarification ? STATUS_TONE[clarification.status] ?? 'info' : 'info'}
                              word={
                                clarification
                                  ? clarificationStatusWord[clarification.status]
                                  : 'Condition on file'
                              }
                            />
                          </div>
                          <p className="condition-item__text">
                            Only if {condition.condition}.
                          </p>
                          <p className="condition-item__slot">For {condition.slotLabel}</p>
                          {clarification && (clarification.status === 'ANSWERED_YES' || clarification.status === 'ANSWERED_NO') ? (
                            <p className="condition-item__answer">
                              Answer: {clarification.answer === 'YES' ? 'Yes' : 'No'} — the preference was updated on their side.
                            </p>
                          ) : null}
                        </li>
                      );
                    }),
                  )}
                </ul>
              )}
            </section>

            <section className="panel plan-panel" aria-labelledby="suggested-question">
              <h2 id="suggested-question">Suggested question</h2>
              {plan.suggestion ? (
                <>
                  <p className="muted">
                    At most one question is sent per participant. It closes exactly one concrete gap.
                  </p>
                  <div className="suggestion-card">
                    <p className="suggestion-card__who">For {plan.suggestion.participantName}</p>
                    <p className="suggestion-card__question">“{plan.suggestion.questionText}”</p>
                    <dl className="detail-grid detail-grid--tight">
                      <div>
                        <dt>{plan.suggestion.factLabel}</dt>
                        <dd>{plan.suggestion.factValue}</dd>
                      </div>
                      <div>
                        <dt>Gap it closes</dt>
                        <dd>{gapSentence(plan)}</dd>
                      </div>
                    </dl>
                    {!reviewing ? (
                      <button type="button" className="btn btn-primary" onClick={() => setReviewing(true)}>
                        Review question
                      </button>
                    ) : (
                      <div className="review-question" role="group" aria-label="Review the question before sending">
                        <p className="review-question__title">Review before sending</p>
                        <p className="review-question__text">“{plan.suggestion.questionText}”</p>
                        <p className="muted">
                          {plan.suggestion.clarificationId
                            ? 'The question is recorded as proposed. Sending it uses up this participant’s single question.'
                            : 'The server has not stored this question yet. Recompute the plan so it can be sent.'}
                          {(() => {
                            const stored = clarifications.find(
                              (item) => item.id === plan.suggestion?.clarificationId,
                            );
                            return stored ? ` Wording source: ${stored.questionSource === 'ai' ? 'AI-written' : 'template'}.` : '';
                          })()}
                        </p>
                        <div className="button-row">
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={!plan.suggestion.clarificationId || busy !== null}
                            onClick={() =>
                              plan.suggestion?.clarificationId
                                ? void sendQuestion(plan.suggestion.clarificationId, plan.suggestion.participantName)
                                : undefined
                            }
                          >
                            {busy === 'send' ? 'Sending…' : `Send question to ${plan.suggestion.participantName}`}
                          </button>
                          <button type="button" className="btn btn-secondary" onClick={() => setReviewing(false)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="muted">
                    A “no” answer is final: that participant keeps their preference and is never asked again.
                  </p>
                </>
              ) : plan.workableSlotId ? (
                <>
                  <p className="muted">No question needed — the plan already works.</p>
                  <Link className="btn btn-primary" to="/organizer/offer">
                    Publish the offer
                  </Link>
                </>
              ) : (
                <p className="muted">{plan.reason}</p>
              )}
            </section>
          </div>

          <section className="panel plan-reason" aria-labelledby="plan-reason">
            <h2 id="plan-reason">Why this plan</h2>
            <p>{plan.reason}</p>
            <p className="muted">
              Deterministic rules, not a model score: confirmed fit first, fewer pending conditions next, then
              preferred matches, then the earliest time. Same inputs always produce the same plan.
            </p>
            <p className="muted">Plan inputs hash: <code>{plan.planInputsHash}</code></p>
          </section>

          <AuditTrail events={state?.audit ?? []} />
        </>
      )}
    </div>
  );
}

function gapSentence(plan: PlanView): string {
  const slot = plan.suggestion ? plan.slots.find((item) => item.slotId === plan.suggestion?.slotId) : undefined;
  if (!slot) return `One extra confirmed fit toward the minimum of ${plan.minimum}.`;
  return `Raises ${slot.label} from ${slot.fits} to ${slot.fits + 1} confirmed fit${slot.fits + 1 === 1 ? '' : 's'} — minimum ${plan.minimum}.`;
}
