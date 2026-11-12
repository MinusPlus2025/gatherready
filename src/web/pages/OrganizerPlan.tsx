/* ==========================================================================
   Organizer home.

   One screen, one question: what is this workshop's true state, and what is the
   single next action? The page is built from the IA pass (docs/ia-redesign.md):

     workshop strip → computed status band + one action → three separate rails →
     candidate matrix (tap a row for people, quotes and the edit entry) →
     the one question (only when it exists) → technical details (collapsed).

   No combined "registered" number: availability, published terms, authorizations
   and captured money are different objects and are shown as such.
   ========================================================================== */

import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { apiFieldErrors, describeError } from '../lib/api.js';
import { money, organizerRails, organizerStatus, matrixRows, shortSlot } from '../lib/status.js';
import { useApp } from '../lib/store.js';
import { AuditTrail, EmptyState, InlineNotice, PageHeader } from '../components/ui.js';
import { Disclosure, Rails, SlotMatrix, StatusBand } from '../components/workshop.js';

export default function OrganizerPlan() {
  const { state, act } = useApp();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const questionRef = useRef<HTMLElement | null>(null);

  if (!state) return null;
  const workshop = state.workshop;
  if (!workshop) {
    return (
      <EmptyState
        title="No workshop yet"
        action={<Link className="btn btn-primary" to="/organizer/setup">Set up a workshop</Link>}
      >
        <p>The home screen appears once the activity facts exist.</p>
      </EmptyState>
    );
  }

  const status = organizerStatus(state);
  const rails = organizerRails(state);
  const rows = matrixRows(state);
  const plan = state.plan;
  const pending = (state.clarifications ?? []).filter((c) => c.status === 'PROPOSED' || c.status === 'SENT');
  const suggestion = plan?.suggestion ?? null;
  const bestRow = rows.slice().sort((a, b) => b.fits - a.fits)[0] ?? null;

  async function propose(participantId?: string): Promise<void> {
    setBusy('propose');
    setError(null);
    try {
      await act({ type: 'clarifications.propose', participantId });
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(null);
    }
    questionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function sendQuestion(clarificationId: string, participantName: string): Promise<void> {
    setBusy('send');
    setError(null);
    try {
      await act({ type: 'clarifications.send', id: clarificationId });
      setNotice(`Question sent to ${participantName}. This is the one question they will receive.`);
    } catch (caught) {
      const fields = apiFieldErrors(caught);
      setError(fields.length > 0 ? fields.map((field) => field.message).join(' ') : describeError(caught));
    } finally {
      setBusy(null);
    }
  }

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

  function primaryAction(): void {
    const action = status.action;
    if (!action) return;
    if (action.kind === 'publish' && action.to) navigate(action.to);
    else if (action.kind === 'fund' && action.to) navigate(action.to);
    else if (action.kind === 'result' && action.to) navigate(action.to);
    else if (action.kind === 'preferences' && action.to) navigate(action.to);
    else if (action.kind === 'ask') {
      // The question card already holds the reviewed wording and the send button.
      // The band action only brings it into view; creating the proposal is the
      // card's own explicit "Review question" step.
      if (singleQuestion || suggestion) questionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      else void propose();
    } else void recompute();
  }

  async function openParticipant(participantId: string): Promise<void> {
    try {
      await act({ type: 'demo.view', payload: { participantId } });
      navigate('/participant/preferences');
    } catch (caught) {
      setError(describeError(caught));
    }
  }

  const singleQuestion = pending[0] ?? null;
  const questionText = singleQuestion?.questionText ?? suggestion?.questionText ?? '';
  const questionFor = singleQuestion?.participantName ?? suggestion?.participantName ?? '';

  return (
    <div className="page org-home">
      <PageHeader
        eyebrow="Organizer"
        title="Workshop home"
        intro="What is true right now, who fits which time, and the one next action. Availability is not a payment: authorization is separate."
        actions={
          <button type="button" className="btn btn-ghost btn-small" onClick={() => void recompute()} disabled={busy !== null}>
            <RefreshCw size={14} strokeWidth={2} aria-hidden="true" /> {busy === 'recompute' ? 'Recomputing…' : 'Recompute'}
          </button>
        }
      />

      <section className="workshop-strip" aria-label="Workshop facts">
        <p className="workshop-strip__title">{workshop.title}</p>
        <p className="workshop-strip__facts">
          <span>{workshop.merchantName}</span>
          <span aria-hidden="true">·</span>
          <span>{workshop.slots.map((slot) => shortSlot(slot.rangeLabel)).join(' · ')}</span>
          <span aria-hidden="true">·</span>
          <span>{money(workshop.priceCents)} per person</span>
          <span aria-hidden="true">·</span>
          <span>minimum {workshop.minParticipants}</span>
        </p>
      </section>

      {notice ? (
        <InlineNotice kind="success" title="Done">
          {notice}
        </InlineNotice>
      ) : null}
      {error ? (
        <InlineNotice kind="error" title="That did not work">
          {error}
        </InlineNotice>
      ) : null}

      <div className="status-row">
        <StatusBand model={status} />
        {status.action ? (
          <button
            type="button"
            className={`btn ${status.action.kind === 'none' ? 'btn-secondary' : 'btn-primary'} status-row__action`}
            onClick={primaryAction}
            disabled={busy !== null}
          >
            {busy === 'propose' ? 'Preparing…' : status.action.label}
            {status.action.kind === 'none' ? null : <ArrowRight size={15} strokeWidth={2.2} aria-hidden="true" />}
          </button>
        ) : null}
      </div>

      <Rails rails={rails} />

      {singleQuestion || suggestion ? (
        <section className="question-card" ref={questionRef} aria-labelledby="question-title">
          <div className="question-card__head">
            <h2 id="question-title">Suggested question {questionFor ? `for ${questionFor}` : ''}</h2>
            <span className="question-card__meta">{singleQuestion ? (singleQuestion.status === 'SENT' ? 'Sent · waiting for an answer' : 'Proposed · not sent yet') : 'Not sent yet'}</span>
          </div>
          <p className="question-card__text">“{questionText}”</p>
          <p className="question-card__why">
            {suggestion
              ? `${suggestion.factLabel}: ${suggestion.factValue} · gap closes ${suggestion.gapClosed - 1} → ${suggestion.gapClosed} confirmed.`
              : 'Only this participant’s own yes counts toward the minimum.'}
          </p>
          <div className="question-card__actions">
            {singleQuestion ? (
              singleQuestion.status === 'PROPOSED' ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy !== null}
                  onClick={() => void sendQuestion(singleQuestion.id, singleQuestion.participantName)}
                >
                  {busy === 'send' ? 'Sending…' : `Send question to ${singleQuestion.participantName}`}
                </button>
              ) : (
                <span className="muted">Question is in their participant view. A “no” is final and is never re-asked.</span>
              )
            ) : (
              <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => void propose(suggestion?.participantId)}>
                {busy === 'propose' ? 'Preparing…' : 'Review question'}
              </button>
            )}
            {suggestion?.clarificationId ? <span className="muted">Wording source: AI or template, recorded in the audit trail.</span> : null}
          </div>
        </section>
      ) : null}

      <SlotMatrix rows={rows} state={state} onAsk={(participantId) => void propose(participantId)} asking={busy === 'propose'} onOpenParticipant={(participantId) => void openParticipant(participantId)} />

      {bestRow ? (
        <p className="matrix-summary">
          Best time so far: {bestRow.shortLabel} · {bestRow.fits} confirmed fits · ceiling {bestRow.ceiling}. A confirmed time
          is not a payment; each included person still reviews the frozen offer and authorizes separately.
        </p>
      ) : null}

      <Disclosure summary="Technical details (plan inputs hash, audit, why this order)">
        <p className="muted">
          Deterministic rules, not a model score: confirmed fits first, fewer pending conditions next, then preferred matches,
          then the earliest time. The same inputs always produce the same plan.
        </p>
        <p className="muted">
          Plan inputs hash: <code>{plan?.planInputsHash ?? '—'}</code>
        </p>
        <AuditTrail events={state.audit ?? []} />
      </Disclosure>
    </div>
  );
}
