/* ==========================================================================
   Organizer: funding.

   One row per person with the four-step money timeline, a word for every state,
   and a batch summary that only appears once the server has locked a batch.

   The only money-moving control on this screen is "Confirm workshop and
   collect". It asks the server to try; the server re-validates every
   authorization, amount and deadline before anything moves. No model is ever in
   this path.
   ========================================================================== */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { PaymentStatus } from '../../shared/types.js';
import { describeError } from '../lib/api.js';
import {
  countdownFor,
  formatCents,
  FUNDING_STEPS,
  fundingStage,
  paymentStatusWord,
  type Tone,
} from '../lib/format.js';
import { useApp } from '../lib/store.js';
import {
  AuditTrail,
  EmptyState,
  InlineNotice,
  PageHeader,
  StatusBadge,
} from '../components/ui.js';

const IN_FLIGHT: PaymentStatus[] = ['ORDER_CREATED', 'APPROVED', 'AUTHORIZING', 'CAPTURING', 'VOIDING', 'REFUNDING'];

function FundingTimeline({ status }: { status: PaymentStatus }) {
  const stage = fundingStage(status);
  return (
    <div className="timeline-wrap">
      <ol className="timeline" aria-label={`Money timeline: ${stage.word}`}>
        {FUNDING_STEPS.map((label, index) => {
          const stepState =
            index < stage.step ? 'done' : index === stage.step ? stage.state : 'todo';
          return (
            <li key={label} className={`timeline__step timeline__step--${stepState}`}>
              <span className="timeline__dot" aria-hidden="true" />
              <span className="timeline__label">{label}</span>
            </li>
          );
        })}
      </ol>
      {stage.ended ? (
        <span className={`timeline__ended timeline__ended--${stage.ended}`}>
          {stage.ended === 'voided'
            ? 'Ended: hold released'
            : stage.ended === 'refunding'
              ? 'Ended: refund path'
              : 'Ended: needs attention'}
        </span>
      ) : null}
    </div>
  );
}

const TONE_BY_STATUS: Partial<Record<PaymentStatus, Tone>> = {
  NONE: 'neutral',
  ORDER_CREATED: 'progress',
  APPROVED: 'progress',
  AUTHORIZING: 'progress',
  AUTHORIZED: 'success',
  CAPTURING: 'progress',
  CAPTURED: 'success',
  VOIDING: 'progress',
  VOIDED: 'neutral',
  REFUNDING: 'progress',
  REFUNDED: 'success',
  FAILED: 'danger',
  UNKNOWN: 'warning',
  MANUAL_REVIEW: 'danger',
};

export default function OrganizerFunding() {
  const { state, act, fetchedAtMs } = useApp();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workshop = state?.workshop ?? null;
  const offer = state?.offer ?? null;
  const batch = state?.batch ?? null;
  const payments = state?.payments ?? [];
  const included = payments.filter((payment) => payment.status !== 'NONE');
  const authorized = payments.filter((payment) => payment.status === 'AUTHORIZED');
  const inFlight = payments.filter((payment) => IN_FLIGHT.includes(payment.status));
  const settled = batch && ['CONFIRMED', 'CANCELLED', 'MANUAL_REVIEW'].includes(batch.status);

  const blockers: string[] = [];
  if (!workshop || !offer) {
    blockers.push('No offer is open yet.');
  } else {
    if (!offer.isOpen || workshop.status !== 'OFFER_OPEN') {
      blockers.push('The offer is no longer open for authorization.');
    }
    const countdown = countdownFor(workshop.authDeadlineUtc, state?.nowUtc, fetchedAtMs);
    if (countdown.expired) blockers.push('The authorization window has closed.');
    if (authorized.length < workshop.minParticipants) {
      blockers.push(
        `${Math.max(0, workshop.minParticipants - authorized.length)} more authorization${
          workshop.minParticipants - authorized.length === 1 ? '' : 's'
        } needed to reach the minimum of ${workshop.minParticipants}.`,
      );
    }
    if (inFlight.length > 0) blockers.push('An authorization or capture is still in progress.');
    if (authorized.length > workshop.capacity) blockers.push('There are more authorizations than seats.');
  }
  const canCollect = blockers.length === 0 && authorized.length > 0;

  async function collect(): Promise<void> {
    if (!workshop || !canCollect) return;
    setBusy(true);
    setError(null);
    try {
      await act({ type: 'workshops.settle', id: workshop.id });
      navigate('/organizer/result');
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  if (!workshop) {
    return (
      <EmptyState title="No workshop yet" action={<Link className="btn btn-primary" to="/organizer/setup">Set up a workshop</Link>}>
        <p>Funding appears once an offer is open and people have authorized.</p>
      </EmptyState>
    );
  }

  if (!offer) {
    return (
      <div className="page">
        <PageHeader eyebrow="Organizer" title="Funding" intro="Money only moves after people authorize a fixed offer." />
        <EmptyState
          title="No offer is open yet"
          action={<Link className="btn btn-primary" to="/organizer/offer">Publish the offer</Link>}
        >
          <p>There is nothing to collect until a fixed offer is published and participants authorize it.</p>
        </EmptyState>
      </div>
    );
  }

  const authorizedTotalCents = authorized.reduce((sum, payment) => sum + payment.amountCents, 0);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Organizer · step 4"
        title="Funding"
        intro="Authorized is a hold, not money received. Capture happens once, only when the whole plan is real — and the server re-checks every row before it does."
        actions={<span className="chip chip--sim">Simulated PayPal — no real money</span>}
      />

      {error ? (
        <InlineNotice kind="error" title="Nothing was captured">
          {error}
        </InlineNotice>
      ) : null}

      <section className="funding-summary" aria-label="Authorization summary">
        <div className="funding-summary__item">
          <p className="funding-summary__label">Authorized</p>
          <p className="funding-summary__value">
            {authorized.length} <span className="funding-summary__of">of {workshop.minParticipants} minimum</span>
          </p>
        </div>
        <div className="funding-summary__item">
          <p className="funding-summary__label">Held (not captured)</p>
          <p className="funding-summary__value">{formatCents(authorizedTotalCents)}</p>
        </div>
        <div className="funding-summary__item">
          <p className="funding-summary__label">Captured</p>
          <p className="funding-summary__value">
            {formatCents(included.filter((payment) => payment.status === 'CAPTURED').reduce((sum, payment) => sum + payment.amountCents, 0))}
          </p>
        </div>
      </section>

      <section className="panel" aria-labelledby="people-title">
        <h2 id="people-title">Money timeline per person</h2>
        <p className="muted">
          Awaiting approval → Authorized → Collecting → Captured. A hold that ends without capture is shown as
          released; a refund is shown only once PayPal confirms it.
        </p>
        {payments.length === 0 ? (
          <p className="muted">No one has started an authorization yet.</p>
        ) : (
          <ul className="people-list">
            {payments.map((payment) => (
              <li key={payment.id} className="person-row">
                <div className="person-row__head">
                  <div>
                    <p className="person-row__name">
                      {payment.participantName}
                      {payment.isMine ? <span className="muted"> (you)</span> : null}
                    </p>
                    <p className="person-row__amount">
                      {payment.amountLabel} · {payment.simulated ? 'Simulated PayPal' : 'PayPal sandbox'}
                    </p>
                  </div>
                  <StatusBadge tone={TONE_BY_STATUS[payment.status] ?? 'neutral'} word={payment.statusLabel} />
                </div>
                <FundingTimeline status={payment.status} />
                <p className="person-row__provider">
                  Provider status: {payment.providerStatus ?? '—'}
                  {payment.authorizationId ? ` · ${payment.authorizationId}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {batch ? (
        <section className="panel batch-panel" aria-labelledby="batch-title">
          <div className="panel__head">
            <div>
              <h2 id="batch-title">Settlement batch</h2>
              <p className="muted">
                {batch.expectedParticipantCount} participants · locked before any capture · deadline{' '}
                {batch.deadlineLabel}
              </p>
            </div>
            <StatusBadge tone={batch.status === 'CONFIRMED' ? 'success' : batch.status === 'MANUAL_REVIEW' ? 'danger' : 'info'} word={batch.status.replace('_', ' ')} />
          </div>
          <dl className="detail-grid">
            <div>
              <dt>Expected total</dt>
              <dd>{batch.expectedLabel}</dd>
            </div>
            <div>
              <dt>Captured</dt>
              <dd>{batch.capturedLabel}</dd>
            </div>
            <div>
              <dt>Refunded (confirmed)</dt>
              <dd>{batch.refundedLabel}</dd>
            </div>
          </dl>
          {batch.reason ? <p className="muted">{batch.reason}</p> : null}
          <p className="muted">
            The batch membership is immutable. A second “collect” request returns this same batch instead of
            creating another one.
          </p>
          {settled ? (
            <Link className="btn btn-secondary" to="/organizer/result">
              See the result
            </Link>
          ) : null}
        </section>
      ) : (
        <section className="panel batch-empty" aria-labelledby="batch-empty-title">
          <h2 id="batch-empty-title">No batch locked yet</h2>
          <p className="muted">
            A batch is created only when the server verifies that the offer is open, the deadline has not
            passed, the number of authorizations is between {workshop.minParticipants} and {workshop.capacity},
            and every authorization matches the offer’s amount and fingerprint. Until then there is no batch and
            no total to show.
          </p>
        </section>
      )}

      <section className="panel collect-panel" aria-labelledby="collect-title">
        <h2 id="collect-title">Confirm the workshop and collect</h2>
        {settled ? (
          <p>
            Settlement has already run. The server’s outcome is on the result page; captured money is never
            guessed in the browser.
          </p>
        ) : (
          <>
            <p>
              This is the only button in GatherReady that moves money. It asks the server to capture{' '}
              <strong>
                {authorized.length} authorization{authorized.length === 1 ? '' : 's'} for{' '}
                {formatCents(authorizedTotalCents)}
              </strong>
              . The AI cannot click it and does not have a way to trigger it.
            </p>
            {blockers.length > 0 ? (
              <ul className="blocker-list" id="collect-blockers">
                {blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                Everything the server checks is currently satisfied. It will still re-validate every row before
                capturing.
              </p>
            )}
            <button
              type="button"
              className="btn btn-primary btn--large"
              onClick={() => void collect()}
              disabled={!canCollect || busy}
              aria-describedby={blockers.length > 0 ? 'collect-blockers' : undefined}
            >
              {busy ? 'Confirming with PayPal…' : 'Confirm workshop and collect'}
            </button>
            {!canCollect ? (
              <p className="muted">The button stays disabled until every blocker above is cleared.</p>
            ) : null}
          </>
        )}
      </section>

      <AuditTrail events={state?.audit ?? []} />
    </div>
  );
}
