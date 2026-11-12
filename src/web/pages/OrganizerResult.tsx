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
import { useI18n, type Translate } from '../lib/i18n';
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

function outcomeWord(
  t: Translate,
  outcome: 'CONFIRMED' | 'NOT_CONFIRMED' | 'PENDING' | 'NEEDS_ATTENTION',
): string {
  switch (outcome) {
    case 'CONFIRMED':
      return t('money.result.outcome.confirmed');
    case 'NOT_CONFIRMED':
      return t('money.result.outcome.notConfirmed');
    case 'PENDING':
      return t('money.result.outcome.pending');
    case 'NEEDS_ATTENTION':
      return t('money.result.outcome.attention');
  }
}

function ReceiptLine({ line }: { line: BatchLineView }) {
  const { t } = useI18n();
  return (
    <li className="receipt-row">
      <div className="receipt-row__head">
        <span className="receipt-row__name">{line.participantName}</span>
        <StatusBadge tone={paymentTone(line.status)} word={t(`pay.status.${line.status}`)} />
        <span className="receipt-row__amount">{line.amountLabel}</span>
      </div>
      <p className="receipt-row__detail">{line.detail}</p>
      <p className="receipt-row__ids">
        {line.captureId ? <>{t('money.result.captureId', { id: line.captureId })}</> : null}
        {line.refundId ? <>{t('money.result.refundId', { id: line.refundId })}</> : null}
        {!line.captureId && !line.refundId ? t('money.result.noIds') : null}
      </p>
    </li>
  );
}

export default function OrganizerResult() {
  const { t } = useI18n();
  const { state } = useApp();
  const workshop = state?.workshop ?? null;
  const result = state?.result ?? null;
  const batch = state?.batch ?? null;

  if (!workshop) {
    return (
      <EmptyState
        title={t('money.shared.noWorkshopTitle')}
        action={
          <Link className="btn btn-primary" to="/organizer/setup">
            {t('money.shared.setupWorkshop')}
          </Link>
        }
      >
        <p>{t('money.result.noWorkshopBody')}</p>
      </EmptyState>
    );
  }

  if (!result) {
    return (
      <div className="page">
        <PageHeader
          eyebrow={t('money.shared.organizer')}
          title={t('money.result.title')}
          intro={t('money.result.intro')}
        />
        <EmptyState
          title={t('money.result.noSettlementTitle')}
          action={
            <Link className="btn btn-primary" to="/organizer/funding">
              {t('money.result.goFunding')}
            </Link>
          }
        >
          <p>{t('money.result.noSettlementBody')}</p>
        </EmptyState>
      </div>
    );
  }

  const notConfirmed = result.outcome !== 'CONFIRMED';

  return (
    <div className="page">
      <PageHeader
        eyebrow={t('money.result.eyebrow')}
        title={result.headline}
        intro={result.detail}
        actions={<StatusBadge tone={outcomeTone(result.outcome)} word={outcomeWord(t, result.outcome)} />}
      />

      <div className={`result-banner result-banner--${result.outcome === 'CONFIRMED' ? 'ok' : notConfirmed ? 'no' : 'pending'}`}>
        <div>
          <p className="result-banner__label">{t('money.result.bannerCaptured')}</p>
          <p className="result-banner__value">{result.capturedLabel}</p>
        </div>
        <div>
          <p className="result-banner__label">{t('money.result.bannerRefunded')}</p>
          <p className="result-banner__value">{result.refundedLabel}</p>
        </div>
        <div>
          <p className="result-banner__label">{t('money.result.bannerNeedsPerson')}</p>
          <p className="result-banner__value">{result.pendingActionCount}</p>
        </div>
      </div>

      {result.pendingActionCount > 0 ? (
        <InlineNotice
          kind="warn"
          title={t(
            result.pendingActionCount === 1 ? 'money.result.pendingOne' : 'money.result.pendingMany',
            { count: result.pendingActionCount },
          )}
        >
          {t('money.result.pendingBody')}
        </InlineNotice>
      ) : null}

      {notConfirmed ? (
        <InlineNotice kind="error" title={t('money.result.notConfirmedTitle')}>
          {t('money.result.notConfirmedBody')}
        </InlineNotice>
      ) : null}

      <section className="panel" aria-labelledby="receipts-title">
        <h2 id="receipts-title">
          {notConfirmed ? t('money.result.perChargeTitle') : t('money.result.perPersonTitle')}
        </h2>
        <p className="muted">{t('money.result.receiptIntro')}</p>
        {result.lines.length === 0 ? (
          <p className="muted">{t('money.result.noCharges')}</p>
        ) : (
          <ul className="receipt-list">
            {result.lines.map((line) => (
              <ReceiptLine key={`${line.participantId}-${line.status}`} line={line} />
            ))}
          </ul>
        )}
      </section>

      <section className="panel" aria-labelledby="legend-title">
        <h2 id="legend-title">{t('money.result.legendTitle')}</h2>
        <dl className="legend">
          <div>
            <dt>{t('money.result.legend.authorized')}</dt>
            <dd>{t('money.result.legend.authorizedDetail')}</dd>
          </div>
          <div>
            <dt>{t('money.result.legend.captured')}</dt>
            <dd>{t('money.result.legend.capturedDetail')}</dd>
          </div>
          <div>
            <dt>{t('money.result.legend.voided')}</dt>
            <dd>{t('money.result.legend.voidedDetail')}</dd>
          </div>
          <div>
            <dt>{t('money.result.legend.refunding')}</dt>
            <dd>{t('money.result.legend.refundingDetail')}</dd>
          </div>
          <div>
            <dt>{t('money.result.legend.refunded')}</dt>
            <dd>{t('money.result.legend.refundedDetail')}</dd>
          </div>
          <div>
            <dt>{t('money.result.legend.attention')}</dt>
            <dd>{t('money.result.legend.attentionDetail')}</dd>
          </div>
        </dl>
      </section>

      {batch ? (
        <section className="panel" aria-labelledby="batch-result-title">
          <div className="panel__head">
            <div>
              <h2 id="batch-result-title">{t('money.result.batchTitle')}</h2>
              <p className="muted">
                {t('money.result.batchMeta', {
                  count: batch.expectedParticipantCount,
                  expected: batch.expectedLabel,
                  captured: batch.capturedLabel,
                  refunded: batch.refundedLabel,
                })}
              </p>
            </div>
            <span className="chip">{t(`money.batch.status.${batch.status}`)}</span>
          </div>
          {batch.reason ? <p className="muted">{batch.reason}</p> : null}
        </section>
      ) : null}

      <AuditTrail events={state?.audit ?? []} />

      <div className="button-row">
        <Link className="btn btn-secondary" to="/organizer/funding">
          {t('money.result.backToFunding')}
        </Link>
        <Link className="btn btn-ghost" to="/organizer/plan">
          {t('money.shared.backToPlan')}
        </Link>
      </div>
    </div>
  );
}
