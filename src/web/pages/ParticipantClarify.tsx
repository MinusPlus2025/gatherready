/* ==========================================================================
   Participant: the single clarification.

   Shows only the three things this person needs: their own sentence, the
   merchant fact the question depends on, and the one question. Yes updates the
   preference; no keeps it exactly as it was. Either way they are never asked
   again, and this screen moves on immediately.
   ========================================================================== */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ClarificationView } from '../../shared/api.js';
import { apiFieldErrors, describeError } from '../lib/api.js';
import { useI18n } from '../lib/i18n';
import { useApp } from '../lib/store.js';
import { EmptyState, ErrorSummary, InlineNotice, PageHeader, Quote, StatusBadge, type SummaryError } from '../components/ui.js';

export default function ParticipantClarify() {
  const { t } = useI18n();
  const { state, act } = useApp();
  const [busy, setBusy] = useState<null | 'YES' | 'NO'>(null);
  const [errors, setErrors] = useState<SummaryError[]>([]);
  const [error, setError] = useState<string | null>(null);

  const participants = state?.participants ?? [];
  const viewerId = state?.session.viewParticipantId ?? participants.find((p) => p.isMe)?.id ?? null;
  const me = participants.find((participant) => participant.id === viewerId) ?? null;
  const mine = (state?.clarifications ?? []).filter(
    (clarification) => clarification.participantId === viewerId && clarification.isMine !== false,
  );
  const answered = mine.find((clarification) => clarification.status === 'ANSWERED_YES' || clarification.status === 'ANSWERED_NO');
  const sent = mine.find((clarification) => clarification.status === 'SENT');
  const proposed = mine.find((clarification) => clarification.status === 'PROPOSED');
  const clarification: ClarificationView | null = sent ?? answered ?? proposed ?? null;

  async function answer(value: 'YES' | 'NO'): Promise<void> {
    if (!clarification) return;
    setBusy(value);
    setErrors([]);
    setError(null);
    try {
      await act({ type: 'clarifications.answer', id: clarification.id, payload: { answer: value } });
    } catch (caught) {
      setErrors(apiFieldErrors(caught).map((field) => ({ field: field.field, message: field.message })));
      setError(describeError(caught));
    } finally {
      setBusy(null);
    }
  }

  if (!state) return null;

  if (!me) {
    return (
      <EmptyState title={t('onboard.clarify.noParticipant.title')}>
        <p>{t('onboard.clarify.noParticipant.body')}</p>
      </EmptyState>
    );
  }

  if (!clarification) {
    return (
      <div className="page page--narrow">
        <PageHeader eyebrow={t('onboard.clarify.eyebrow', { name: me.displayName })} title={t('onboard.clarify.none.title')} />
        <EmptyState title={t('onboard.clarify.none.emptyTitle')}>
          <p>{t('onboard.clarify.none.body1')}</p>
          <p>{t('onboard.clarify.none.body2')}</p>
        </EmptyState>
        <div className="button-row">
          <Link className="btn btn-secondary" to="/participant/preferences">
            {t('onboard.clarify.preferences')}
          </Link>
          {state.offer?.isOpen && state.offer.viewerIncluded ? (
            <Link className="btn btn-primary" to="/participant/authorize">
              {t('onboard.clarify.openOffer')}
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  const isAnswered = clarification.status === 'ANSWERED_YES' || clarification.status === 'ANSWERED_NO';
  const isProposed = clarification.status === 'PROPOSED';

  if (isAnswered) {
    const yes = clarification.answer === 'YES' || clarification.status === 'ANSWERED_YES';
    return (
      <div className="page page--narrow">
        <PageHeader
          eyebrow={t('onboard.clarify.eyebrow', { name: me.displayName })}
          title={yes ? t('onboard.clarify.answered.titleYes') : t('onboard.clarify.answered.titleNo')}
          intro={t('onboard.clarify.answered.intro')}
          actions={<StatusBadge tone="success" word={t('onboard.clarify.answered.badge')} />}
        />
        <section className="panel" aria-labelledby="answered-detail">
          <h2 id="answered-detail">{t('onboard.clarify.answered.heading')}</h2>
          <div className="answer-summary">
            <p>
              <strong>{yes ? t('onboard.clarify.answered.yesStrong') : t('onboard.clarify.answered.noStrong')}</strong>
              {yes ? t('onboard.clarify.answered.yesBody') : t('onboard.clarify.answered.noBody')}
            </p>
            <Quote label={t('onboard.clarify.answered.quoteLabel')}>{clarification.sourceQuote}</Quote>
          </div>
          <div className="button-row">
            {state.offer?.isOpen && state.offer.viewerIncluded ? (
              <Link className="btn btn-primary" to="/participant/authorize">
                {t('onboard.clarify.openOffer')}
              </Link>
            ) : null}
            <Link className="btn btn-secondary" to="/participant/preferences">
              {t('onboard.clarify.preferences')}
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (isProposed) {
    return (
      <div className="page page--narrow">
        <PageHeader eyebrow={t('onboard.clarify.eyebrow', { name: me.displayName })} title={t('onboard.clarify.proposed.title')} />
        <EmptyState title={t('onboard.clarify.proposed.emptyTitle')}>
          <p>{t('onboard.clarify.proposed.body')}</p>
        </EmptyState>
        <div className="button-row">
          <Link className="btn btn-secondary" to="/participant/preferences">
            {t('onboard.clarify.preferences')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--narrow">
      <PageHeader
        eyebrow={t('onboard.clarify.eyebrow', { name: me.displayName })}
        title={t('onboard.clarify.ask.title')}
        intro={t('onboard.clarify.ask.intro')}
        actions={<StatusBadge tone="progress" word={t('onboard.clarify.ask.badge')} />}
      />

      {error ? (
        <InlineNotice kind="error" title={t('onboard.clarify.ask.saveError')}>
          {error}
        </InlineNotice>
      ) : null}
      <ErrorSummary errors={errors} />

      <section className="panel question-panel" aria-labelledby="the-question">
        <div className="question-block">
          <h2 className="question-block__heading">{t('onboard.clarify.ask.toldHeading')}</h2>
          <Quote label={t('onboard.clarify.ask.verbatim', { name: clarification.participantName })}>{clarification.sourceQuote}</Quote>
          <p className="muted">{t('onboard.clarify.ask.toldNote')}</p>
        </div>

        <div className="question-block">
          <h2 className="question-block__heading">{t('onboard.clarify.ask.dependsHeading')}</h2>
          <dl className="detail-grid detail-grid--tight">
            <div>
              <dt>{clarification.factLabel}</dt>
              <dd>{clarification.factValue}</dd>
            </div>
          </dl>
          <p className="muted">{t('onboard.clarify.ask.dependsNote')}</p>
        </div>

        <div className="question-block question-block--ask">
          <h2 className="question-block__heading" id="the-question">
            {t('onboard.clarify.ask.heading')}
          </h2>
          <p className="big-question">“{clarification.questionText}”</p>
          <p className="muted">
            {t('onboard.clarify.ask.sourcePrefix', {
              source:
                clarification.questionSource === 'ai'
                  ? t('onboard.clarify.ask.sourceAi')
                  : t('onboard.clarify.ask.sourceTemplate'),
            })}
            <strong>{clarification.slotLabel}</strong>
            {t('onboard.clarify.ask.sourceSuffix')}
          </p>
        </div>

        <div className="answer-actions" role="group" aria-label={t('onboard.clarify.ask.answerGroupAria')}>
          <button
            type="button"
            className="btn btn-primary btn--large"
            disabled={busy !== null}
            onClick={() => void answer('YES')}
          >
            {busy === 'YES' ? t('onboard.clarify.ask.saving') : t('onboard.clarify.ask.yes')}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn--large"
            disabled={busy !== null}
            onClick={() => void answer('NO')}
          >
            {busy === 'NO' ? t('onboard.clarify.ask.saving') : t('onboard.clarify.ask.no')}
          </button>
        </div>
        <p className="answer-note">
          <strong>{t('onboard.clarify.ask.noStrong')}</strong>
          {t('onboard.clarify.ask.noNote')}
        </p>
      </section>
    </div>
  );
}
