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
import { useApp } from '../lib/store.js';
import { EmptyState, ErrorSummary, InlineNotice, PageHeader, Quote, StatusBadge, type SummaryError } from '../components/ui.js';

export default function ParticipantClarify() {
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
      <EmptyState title="This page belongs to a participant">
        <p>Use the demo view switcher above to act as one of the synthetic participants.</p>
      </EmptyState>
    );
  }

  if (!clarification) {
    return (
      <div className="page page--narrow">
        <PageHeader eyebrow={`Participant · ${me.displayName}`} title="No question for you" />
        <EmptyState title="Nothing to answer right now">
          <p>
            A question is only asked when one merchant fact could change whether a time works for you. Most
            people never get one, and you get at most one.
          </p>
          <p>
            Your confirmed preferences still count exactly as you set them.
          </p>
        </EmptyState>
        <div className="button-row">
          <Link className="btn btn-secondary" to="/participant/preferences">
            Your preferences
          </Link>
          {state.offer?.isOpen && state.offer.viewerIncluded ? (
            <Link className="btn btn-primary" to="/participant/authorize">
              Review the open offer
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
          eyebrow={`Participant · ${me.displayName}`}
          title={yes ? 'Thanks — that time now counts' : 'Your preference is unchanged'}
          intro="Nothing else is needed from you. This question is closed and will not be asked again."
          actions={<StatusBadge tone="success" word="Answered" />}
        />
        <section className="panel" aria-labelledby="answered-detail">
          <h2 id="answered-detail">Your answer</h2>
          <div className="answer-summary">
            <p>
              <strong>{yes ? 'Yes, this works.' : 'No, keep my preference.'}</strong>{' '}
              {yes
                ? 'Your preference was updated to include this time — subject to the same fixed offer and the same authorization step as everyone else.'
                : 'Your original preference stays exactly as you confirmed it. There is no penalty, no discount, and no re-asking.'}
            </p>
            <Quote label="What you originally wrote">{clarification.sourceQuote}</Quote>
          </div>
          <div className="button-row">
            {state.offer?.isOpen && state.offer.viewerIncluded ? (
              <Link className="btn btn-primary" to="/participant/authorize">
                Review the open offer
              </Link>
            ) : null}
            <Link className="btn btn-secondary" to="/participant/preferences">
              Your preferences
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (isProposed) {
    return (
      <div className="page page--narrow">
        <PageHeader eyebrow={`Participant · ${me.displayName}`} title="No question sent to you yet" />
        <EmptyState title="The organizer is still reviewing a possible question">
          <p>Nothing has been sent to you, and nothing counts until it is. Your confirmed preferences are unchanged.</p>
        </EmptyState>
        <div className="button-row">
          <Link className="btn btn-secondary" to="/participant/preferences">
            Your preferences
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--narrow">
      <PageHeader
        eyebrow={`Participant · ${me.displayName}`}
        title="One question about your condition"
        intro="Answer in one click. This is the only question you will be asked."
        actions={<StatusBadge tone="progress" word="Waiting for your answer" />}
      />

      {error ? (
        <InlineNotice kind="error" title="Your answer was not saved">
          {error}
        </InlineNotice>
      ) : null}
      <ErrorSummary errors={errors} />

      <section className="panel question-panel" aria-labelledby="the-question">
        <div className="question-block">
          <h2 className="question-block__heading">What you told us</h2>
          <Quote label={`${clarification.participantName} · verbatim`}>{clarification.sourceQuote}</Quote>
          <p className="muted">You wrote this when you confirmed your preference.</p>
        </div>

        <div className="question-block">
          <h2 className="question-block__heading">What it depends on</h2>
          <dl className="detail-grid detail-grid--tight">
            <div>
              <dt>{clarification.factLabel}</dt>
              <dd>{clarification.factValue}</dd>
            </div>
          </dl>
          <p className="muted">
            This is a merchant fact, not a promise from GatherReady or from the AI. The organizer checked it
            before sending the question.
          </p>
        </div>

        <div className="question-block question-block--ask">
          <h2 className="question-block__heading" id="the-question">
            The question
          </h2>
          <p className="big-question">“{clarification.questionText}”</p>
          <p className="muted">
            Wording source: {clarification.questionSource === 'ai' ? 'AI-written, then checked by the organizer' : 'template wording — no AI used'}.
            It concerns only <strong>{clarification.slotLabel}</strong>.
          </p>
        </div>

        <div className="answer-actions" role="group" aria-label="Answer the question">
          <button
            type="button"
            className="btn btn-primary btn--large"
            disabled={busy !== null}
            onClick={() => void answer('YES')}
          >
            {busy === 'YES' ? 'Saving…' : 'Yes, this works'}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn--large"
            disabled={busy !== null}
            onClick={() => void answer('NO')}
          >
            {busy === 'NO' ? 'Saving…' : 'No, keep my preference'}
          </button>
        </div>
        <p className="answer-note">
          <strong>No is a complete answer.</strong> Your preference stays exactly as it is, you are not asked
          again, and no one is charged on your behalf.
        </p>
      </section>
    </div>
  );
}
