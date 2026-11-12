/* ==========================================================================
   Organizer home.

   One screen, one question: what is this workshop's true state, and what is the
   single next action? The page is built from the IA pass (docs/ia-redesign.md):

     workshop strip → computed status band + one action → three separate rails →
     candidate matrix (tap a row for people, quotes and the edit entry) →
     the one question (only when it exists) → technical details (collapsed).

   No combined "registered" number: availability, published terms, authorizations
   and captured money are different objects and are shown as such.

   All chrome goes through t(); workshop facts, slot labels and AI question text
   stay in the language the server created them in.
   ========================================================================== */

import { useRef, useState } from 'react';
import { InviteParticipants } from '../components/InviteParticipants.js';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { apiFieldErrors, describeError } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { money, organizerRails, organizerStatus, matrixRows, shortSlot } from '../lib/status.js';
import { useApp } from '../lib/store.js';
import { webpSrcSet } from '../lib/images.js';
import { AuditTrail, EmptyState, InlineNotice, PageHeader } from '../components/ui.js';
import { Disclosure, Rails, SlotMatrix } from '../components/workshop.js';

export default function OrganizerPlan() {
  const { state, act } = useApp();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const questionRef = useRef<HTMLElement | null>(null);

  if (!state) return null;
  if (state.session.role === 'participant') return <Navigate to="/participant/preferences" replace />;
  const workshop = state.workshop;
  if (!workshop) {
    return (
      <EmptyState
        title={t('flow.status.organizer.noWorkshop.headline')}
        action={<Link className="btn btn-primary" to="/organizer/setup">{t('flow.action.setUpWorkshop')}</Link>}
      >
        <p>{t('flow.plan.empty.body')}</p>
      </EmptyState>
    );
  }

  const status = organizerStatus(state, locale);
  const rails = organizerRails(state, locale);
  const rows = matrixRows(state, locale);
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
      setNotice(t('flow.plan.notice.questionSent', { name: participantName }));
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
      setNotice(t('flow.plan.notice.recomputed'));
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
        eyebrow={t('flow.plan.eyebrow')}
        title={t('flow.plan.title')}
        intro={t('flow.plan.intro')}
        actions={
          <button type="button" className="btn btn-ghost btn-small" onClick={() => void recompute()} disabled={busy !== null}>
            <RefreshCw size={14} strokeWidth={2} aria-hidden="true" /> {busy === 'recompute' ? t('flow.plan.recomputing') : t('flow.plan.recompute')}
          </button>
        }
      />

      <section className="workshop-strip" aria-label={t('flow.plan.strip.aria')}>
        {workshop.coverImageUrl ? (
          <picture>
            <source type="image/webp" srcSet={webpSrcSet(workshop.coverImageUrl)} sizes="168px" />
            <img
              className="workshop-strip__cover"
              onError={(event) => { event.currentTarget.style.display = 'none'; }}
              src={workshop.coverImageUrl}
              alt=""
              width={168}
              height={126}
              loading="lazy"
            />
          </picture>
        ) : null}
        <div className="workshop-strip__body">
        <p className="workshop-strip__title">{workshop.title}</p>
        <p className="workshop-strip__facts">
          <span>{workshop.merchantName}</span>
          <span aria-hidden="true">·</span>
          <span>{workshop.slots.map((slot) => shortSlot(slot.rangeLabel)).join(' · ')}</span>
          <span aria-hidden="true">·</span>
          <span>{t('flow.plan.strip.perPerson', { amount: money(workshop.priceCents) })}</span>
          <span aria-hidden="true">·</span>
          <span>{t('flow.strip.minimum', { count: workshop.minParticipants })}</span>
        </p>
        </div>
      </section>

      {notice ? (
        <InlineNotice kind="success" title={t('flow.action.done')}>
          {notice}
        </InlineNotice>
      ) : null}
      {error ? (
        <InlineNotice kind="error" title={t('flow.plan.notice.errorTitle')}>
          {error}
        </InlineNotice>
      ) : null}

      <section className={`plan-decisions plan-decisions--${status.tone}`} aria-label={t('flow.plan.decisions.aria')}>
        <div className="plan-decision">
          <span className="plan-decision__label">{t('flow.plan.decisions.closest')}</span>
          <strong className="plan-decision__value">{bestRow ? bestRow.shortLabel : '—'}</strong>
          <p className="plan-decision__detail">
            {bestRow ? `${bestRow.fits} / ${workshop.minParticipants}` : t('flow.plan.decisions.none')}
          </p>
        </div>
        <div className="plan-decision">
          <span className="plan-decision__label">{t('flow.plan.decisions.missing')}</span>
          <p className="plan-decision__detail">
            <strong>{status.headline}</strong> {status.detail}
          </p>
        </div>
        <div className="plan-decision">
          <span className="plan-decision__label">{t('flow.plan.decisions.next')}</span>
          {status.action && status.action.kind !== 'none' ? (
            <button
              type="button"
              className="btn btn-primary plan-decision__action"
              onClick={primaryAction}
              disabled={busy !== null}
            >
              {busy === 'propose' ? t('flow.plan.preparing') : status.action.label}
              <ArrowRight size={15} strokeWidth={2.2} aria-hidden="true" />
            </button>
          ) : (
            <p className="plan-decision__detail">
              {status.action?.kind === 'none' ? t('flow.plan.decisions.wait') : t('flow.plan.decisions.none')}
            </p>
          )}
        </div>
      </section>

      <InviteParticipants />

      <Rails rails={rails} />

      {singleQuestion || suggestion ? (
        <section className="question-card" ref={questionRef} aria-labelledby="question-title">
          <div className="question-card__head">
            <h2 id="question-title">
              {questionFor
                ? t('flow.plan.question.titleFor', { name: questionFor })
                : t('flow.plan.question.title')}
            </h2>
            <span className="question-card__meta">{singleQuestion ? (singleQuestion.status === 'SENT' ? t('flow.plan.question.sent') : t('flow.plan.question.proposed')) : t('flow.plan.question.notSent')}</span>
          </div>
          <p className="question-card__text">“{questionText}”</p>
          <p className="question-card__why">
            {suggestion
              ? t('flow.plan.question.why', {
                  label: suggestion.factLabel,
                  value: suggestion.factValue,
                  before: suggestion.gapClosed - 1,
                  after: suggestion.gapClosed,
                })
              : t('flow.plan.question.whyOnly')}
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
                  {busy === 'send' ? t('flow.plan.question.sending') : t('flow.plan.question.send', { name: singleQuestion.participantName })}
                </button>
              ) : (
                <span className="muted">{t('flow.plan.question.sentNote')}</span>
              )
            ) : (
              <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => void propose(suggestion?.participantId)}>
                {busy === 'propose' ? t('flow.plan.preparing') : t('flow.plan.question.review')}
              </button>
            )}
            {suggestion?.clarificationId ? <span className="muted">{t('flow.plan.question.source')}</span> : null}
          </div>
        </section>
      ) : null}

      <SlotMatrix rows={rows} state={state} onAsk={(participantId) => void propose(participantId)} asking={busy === 'propose'} onOpenParticipant={(participantId) => void openParticipant(participantId)} />

      {bestRow ? (
        <p className="matrix-summary">
          {t('flow.plan.matrix.best', { slot: bestRow.shortLabel, count: bestRow.fits, ceiling: bestRow.ceiling })}
        </p>
      ) : null}

      <Disclosure summary={t('flow.plan.tech.summary')}>
        <p className="muted">{t('flow.plan.tech.rules')}</p>
        <p className="muted">
          {t('flow.plan.tech.hashLabel')} <code>{plan?.planInputsHash ?? '—'}</code>
        </p>
        <AuditTrail events={state.audit ?? []} />
      </Disclosure>
    </div>
  );
}
