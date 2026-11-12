/* ==========================================================================
   Organizer: result.

   Confirmed: every person has a receipt state and the captured total.
   Not confirmed: every charge shows what actually happened to it — voided,
   refunding (requested, NOT refunded), refunded, or needs manual attention.
   "Request sent" is never drawn as "refunded".
   ========================================================================== */

import { Link } from 'react-router-dom';
import type { BatchLineView } from '../../shared/api.js';
import { formatCents, paymentTone } from '../lib/format.js';
import { useApp } from '../lib/store.js';
import { AuditTrail, EmptyState, InlineNotice, PageHeader, StatusBadge } from '../components/ui.js';

function outcomeTone(outcome: 'CONFIRMED' | 'NOT_CONFIRMED' | 'PENDING' | 'NEEDS_ATTENTION') {
  switch (outcome) {
    case 'CONFIRMED':
      return 'success' as const;
    case 'NOT_CONFIRMED':
      return 'neutral' as const;
    case 'PENDING':
      return 'progress' as const;
    case 'NEEDS_ATTENTION':
      return 'danger' as const;
  }
}

function outcomeWord(outcome: 'CONFIRMED' | 'NOT_CONFIRMED' | 'PENDING' | 'NEEDS_ATTENTION'): string {
  switch (outcome) {
    case 'CONFIRMED':
      return 'Workshop confirmed';
    case 'NOT_CONFIRMED':
      return 'Workshop not confirmed';
    case 'PENDING':
      return 'Checking with PayPal';
    case 'NEEDS_ATTENTION':
      return 'Needs manual attention';
  }
}

function ReceiptLine({ line }: { line: BatchLineView }) {
  return (
    <li className="receipt-row">
      <div className="receipt-row__head">
        <span className="receipt-row__name">{line.participantName}</span>
        <StatusBadge tone={paymentTone(line.status)} word={line.statusLabel} />
        <span className="receipt-row__amount">{line.amountLabel}</span>
      </div>
      <p className="receipt-row__detail">{line.detail}</p>
      <p className="receipt-row__ids">
        {line.captureId ? <>Capture {line.captureId} · </> : null}
        {line.refundId ? <>Refund {line.refundId}</> : null}
        {!line.captureId && !line.refundId ? 'No capture or refund id — see status above.' : null}
      </p>
    </li>
  );
}

export default function OrganizerResult() {
  const { state } = useApp();
  const workshop = state?.workshop ?? null;
  const result = state?.result ?? null;
  const batch = state?.batch ?? null;

  if (!workshop) {
    return (
      <EmptyState title="No workshop yet" action={<Link className="btn btn-primary" to="/organizer/setup">Set up a workshop</Link>}>
        <p>The result appears after the workshop is confirmed or cancelled.</p>
      </EmptyState>
    );
  }

  if (!result) {
    return (
      <div className="page">
        <PageHeader eyebrow="Organizer" title="Result" intro="What actually happened to every charge." />
        <EmptyState
          title="Settlement has not run yet"
          action={<Link className="btn btn-primary" to="/organizer/funding">Go to funding</Link>}
        >
          <p>
            When the organizer confirms the workshop and collects, each charge’s real state appears here. A
            pending settlement shows “checking”, never a guess.
          </p>
        </EmptyState>
      </div>
    );
  }

  const notConfirmed = result.outcome !== 'CONFIRMED';

  return (
    <div className="page">
      <PageHeader
        eyebrow="Organizer · result"
        title={result.headline}
        intro={result.detail}
        actions={<StatusBadge tone={outcomeTone(result.outcome)} word={outcomeWord(result.outcome)} />}
      />

      <div className={`result-banner result-banner--${result.outcome === 'CONFIRMED' ? 'ok' : notConfirmed ? 'no' : 'pending'}`}>
        <div>
          <p className="result-banner__label">Captured (confirmed by PayPal)</p>
          <p className="result-banner__value">{result.capturedLabel}</p>
        </div>
        <div>
          <p className="result-banner__label">Refunded (confirmed by PayPal)</p>
          <p className="result-banner__value">{result.refundedLabel}</p>
        </div>
        <div>
          <p className="result-banner__label">Needs a person</p>
          <p className="result-banner__value">{result.pendingActionCount}</p>
        </div>
        <span className="chip chip--sim">Simulated PayPal — no real money</span>
      </div>

      {result.pendingActionCount > 0 ? (
        <InlineNotice kind="warn" title={`${result.pendingActionCount} charge${result.pendingActionCount === 1 ? '' : 's'} need a person to check PayPal`}>
          These outcomes are unclear and are never retried automatically. Check the PayPal sandbox dashboard for
          the listed capture or refund before deciding anything else.
        </InlineNotice>
      ) : null}

      {notConfirmed ? (
        <InlineNotice kind="error" title="No workshop, and no money kept">
          The plan did not come together. Holds that were never captured are released, captured charges are
          refunded, and anything uncertain is escalated to a person. Refunds appear as “refunded” only after
          PayPal confirms them.
        </InlineNotice>
      ) : null}

      <section className="panel" aria-labelledby="receipts-title">
        <h2 id="receipts-title">{notConfirmed ? 'Per-charge state' : 'Per-person receipt state'}</h2>
        <p className="muted">
          Each row is one person’s money, as reported by the server. A refund request is not a refund; we only
          say “refunded” once PayPal confirms it.
        </p>
        {result.lines.length === 0 ? (
          <p className="muted">No charges were involved.</p>
        ) : (
          <ul className="receipt-list">
            {result.lines.map((line) => (
              <ReceiptLine key={`${line.participantId}-${line.status}`} line={line} />
            ))}
          </ul>
        )}
      </section>

      <section className="panel" aria-labelledby="legend-title">
        <h2 id="legend-title">How to read these states</h2>
        <dl className="legend">
          <div>
            <dt>Authorized</dt>
            <dd>A temporary hold. No money has moved.</dd>
          </div>
          <div>
            <dt>Captured</dt>
            <dd>PayPal confirmed the merchant received the amount.</dd>
          </div>
          <div>
            <dt>Voided</dt>
            <dd>The hold was released. Nothing was captured.</dd>
          </div>
          <div>
            <dt>Refunding</dt>
            <dd>A refund has been requested but is not confirmed yet — not counted as refunded.</dd>
          </div>
          <div>
            <dt>Refunded</dt>
            <dd>PayPal confirmed the refund.</dd>
          </div>
          <div>
            <dt>Needs attention</dt>
            <dd>The outcome is unknown. A person must check it; nothing is retried automatically.</dd>
          </div>
        </dl>
      </section>

      {batch ? (
        <section className="panel" aria-labelledby="batch-result-title">
          <div className="panel__head">
            <div>
              <h2 id="batch-result-title">Settlement batch</h2>
              <p className="muted">
                {batch.expectedParticipantCount} participants · expected {batch.expectedLabel} · captured{' '}
                {batch.capturedLabel} · refunded {batch.refundedLabel}
              </p>
            </div>
            <span className="chip">{batch.status.replace('_', ' ')}</span>
          </div>
          {batch.reason ? <p className="muted">{batch.reason}</p> : null}
        </section>
      ) : null}

      <AuditTrail events={state?.audit ?? []} />

      <div className="button-row">
        <Link className="btn btn-secondary" to="/organizer/funding">
          Back to funding
        </Link>
        <Link className="btn btn-ghost" to="/organizer/plan">
          Back to the plan
        </Link>
      </div>
    </div>
  );
}
