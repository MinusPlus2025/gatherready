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
  type Tone,
} from '../lib/format.js';
import { useI18n } from '../lib/i18n';
import { useApp } from '../lib/store.js';
import {
  AuditTrail,
  EmptyState,
  InlineNotice,
  PageHeader,
  StatusBadge,
} from '../components/ui.js';

const IN_FLIGHT: PaymentStatus[] = ['ORDER_CREATED', 'APPROVED', 'AUTHORIZING', 'CAPTURING', 'VOIDING', 'REFUNDING'];

const FUNDING_STEP_KEYS = [
  'money.funding.step.awaiting',
  'money.funding.step.authorized',
  'money.funding.step.collecting',
  'money.funding.step.captured',
] as const;

function FundingTimeline({ status }: { status: PaymentStatus }) {
  const { t } = useI18n();
  const stage = fundingStage(status);
  return (
    <div className="timeline-wrap">
      <ol className="timeline" aria-label={t('money.funding.timelineAria', { word: t(`pay.status.${status}`) })}>
        {FUNDING_STEPS.map((label, index) => {
          const stepState =
            index < stage.step ? 'done' : index === stage.step ? stage.state : 'todo';
          return (
            <li key={label} className={`timeline__step timeline__step--${stepState}`}>
              <span className="timeline__dot" aria-hidden="true" />
              <span className="timeline__label">{t(FUNDING_STEP_KEYS[index] ?? 'money.funding.step.awaiting')}</span>
            </li>
          );
        })}
      </ol>
      {stage.ended ? (
        <span className={`timeline__ended timeline__ended--${stage.ended}`}>
          {stage.ended === 'voided'
            ? t('money.funding.endedVoided')
            : stage.ended === 'refunding'
              ? t('money.funding.endedRefund')
              : t('money.funding.endedAttention')}
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
  const { t } = useI18n();
  const { state, act, fetchedAtMs } = useApp();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const simulated = state?.mode.paypal !== 'sandbox';
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
    blockers.push(t('money.funding.blockerNoOffer'));
  } else {
    if (!offer.isOpen || workshop.status !== 'OFFER_OPEN') {
      blockers.push(t('money.funding.blockerOfferClosed'));
    }
    const countdown = countdownFor(workshop.authDeadlineUtc, state?.nowUtc, fetchedAtMs);
    if (countdown.expired) blockers.push(t('money.funding.blockerExpired'));
    if (authorized.length < workshop.minParticipants) {
      const needed = Math.max(0, workshop.minParticipants - authorized.length);
      blockers.push(
        t(needed === 1 ? 'money.funding.blockerNeedOne' : 'money.funding.blockerNeedMany', {
          count: needed,
          min: workshop.minParticipants,
        }),
      );
    }
    if (inFlight.length > 0) blockers.push(t('money.funding.blockerInFlight'));
    if (authorized.length > workshop.capacity) blockers.push(t('money.funding.blockerTooMany'));
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
      <EmptyState
        title={t('money.shared.noWorkshopTitle')}
        action={
          <Link className="btn btn-primary" to="/organizer/setup">
            {t('money.shared.setupWorkshop')}
          </Link>
        }
      >
        <p>{t('money.funding.noWorkshopBody')}</p>
      </EmptyState>
    );
  }

  if (!offer) {
    return (
      <div className="page">
        <PageHeader
          eyebrow={t('money.funding.noOfferEyebrow')}
          title={t('money.funding.noOfferTitle')}
          intro={t('money.funding.noOfferIntro')}
        />
        <EmptyState
          title={t('money.funding.noOfferEmpty')}
          action={
            <Link className="btn btn-primary" to="/organizer/offer">
              {t('money.funding.publishOffer')}
            </Link>
          }
        >
          <p>{t('money.funding.noOfferBody')}</p>
        </EmptyState>
      </div>
    );
  }

  const authorizedTotalCents = authorized.reduce((sum, payment) => sum + payment.amountCents, 0);

  return (
    <div className="page">
      <PageHeader
        eyebrow={t('money.funding.eyebrow')}
        title={t('money.funding.title')}
        intro={t('money.funding.intro')}
        actions={undefined}
      />

      {error ? (
        <InlineNotice kind="error" title={t('money.funding.nothingCaptured')}>
          {error}
        </InlineNotice>
      ) : null}

      <section className="funding-summary" aria-label={t('money.funding.summaryAria')}>
        <div className="funding-summary__item">
          <p className="funding-summary__label">{t('money.funding.summaryAuthorized')}</p>
          <p className="funding-summary__value">
            {authorized.length}{' '}
            <span className="funding-summary__of">
              {t('money.funding.ofMinimum', { min: workshop.minParticipants })}
            </span>
          </p>
        </div>
        <div className="funding-summary__item">
          <p className="funding-summary__label">{t('money.funding.summaryHeld')}</p>
          <p className="funding-summary__value">{formatCents(authorizedTotalCents)}</p>
        </div>
        <div className="funding-summary__item">
          <p className="funding-summary__label">{t('money.funding.summaryCaptured')}</p>
          <p className="funding-summary__value">
            {formatCents(included.filter((payment) => payment.status === 'CAPTURED').reduce((sum, payment) => sum + payment.amountCents, 0))}
          </p>
        </div>
      </section>

      <section className="panel" aria-labelledby="people-title">
        <h2 id="people-title">{t('money.funding.peopleTitle')}</h2>
        <p className="muted">{t('money.funding.peopleIntro')}</p>
        {payments.length === 0 ? (
          <p className="muted">{t('money.funding.noPayments')}</p>
        ) : (
          <ul className="people-list">
            {payments.map((payment) => (
              <li key={payment.id} className="person-row">
                <div className="person-row__head">
                  <div>
                    <p className="person-row__name">
                      {payment.participantName}
                      {payment.isMine ? <span className="muted"> {t('money.funding.you')}</span> : null}
                    </p>
                    <p className="person-row__amount">
                      {payment.amountLabel} ·{' '}
                      {payment.simulated
                        ? t('money.funding.modeSimulated')
                        : t('money.funding.modeSandbox')}
                    </p>
                  </div>
                  <StatusBadge
                    tone={TONE_BY_STATUS[payment.status] ?? 'neutral'}
                    word={t(`pay.status.${payment.status}`)}
                  />
                </div>
                <FundingTimeline status={payment.status} />
                <p className="person-row__provider">
                  {t('money.funding.providerStatus', { status: payment.providerStatus ?? '—' })}
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
              <h2 id="batch-title">{t('money.funding.batchTitle')}</h2>
              <p className="muted">
                {t('money.funding.batchMeta', {
                  count: batch.expectedParticipantCount,
                  deadline: batch.deadlineLabel,
                })}
              </p>
            </div>
            <StatusBadge
              tone={batch.status === 'CONFIRMED' ? 'success' : batch.status === 'MANUAL_REVIEW' ? 'danger' : 'info'}
              word={t(`money.batch.status.${batch.status}`)}
            />
          </div>
          <dl className="detail-grid">
            <div>
              <dt>{t('money.funding.expectedTotal')}</dt>
              <dd>{batch.expectedLabel}</dd>
            </div>
            <div>
              <dt>{t('money.funding.captured')}</dt>
              <dd>{batch.capturedLabel}</dd>
            </div>
            <div>
              <dt>{t('money.funding.refundedConfirmed')}</dt>
              <dd>{batch.refundedLabel}</dd>
            </div>
          </dl>
          {batch.reason ? <p className="muted">{batch.reason}</p> : null}
          <p className="muted">{t('money.funding.batchImmutable')}</p>
          {settled ? (
            <Link className="btn btn-secondary" to="/organizer/result">
              {t('money.funding.seeResult')}
            </Link>
          ) : null}
        </section>
      ) : (
        <section className="panel batch-empty" aria-labelledby="batch-empty-title">
          <h2 id="batch-empty-title">{t('money.funding.noBatchTitle')}</h2>
          <p className="muted">
            {t('money.funding.noBatchBody', {
              min: workshop.minParticipants,
              capacity: workshop.capacity,
            })}
          </p>
        </section>
      )}

      <section className="panel collect-panel" aria-labelledby="collect-title">
        <h2 id="collect-title">{t('money.funding.collectTitle')}</h2>
        {settled ? (
          <p>{t('money.funding.settledBody')}</p>
        ) : (
          <>
            <p>
              {t(simulated ? 'money.funding.simulatedCollectPre' : 'money.funding.collectPre')}
              <strong>
                {t(
                  authorized.length === 1
                    ? 'money.funding.collectAmountOne'
                    : 'money.funding.collectAmountMany',
                  { count: authorized.length, total: formatCents(authorizedTotalCents) },
                )}
              </strong>
              {t('money.funding.collectPost')}
            </p>
            {blockers.length > 0 ? (
              <ul className="blocker-list" id="collect-blockers" aria-describedby="collect-blockers">
                {blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t('money.funding.allClear')}</p>
            )}
            <button
              type="button"
              className="btn btn-primary btn--large"
              onClick={() => void collect()}
              disabled={!canCollect || busy}
              aria-describedby={blockers.length > 0 ? 'collect-blockers' : undefined}
            >
              {busy ? t('money.funding.collecting') : t(simulated ? 'money.funding.simulatedCollect' : 'money.funding.collect')}
            </button>
            {!canCollect ? <p className="muted">{t('money.funding.disabledHint')}</p> : null}
          </>
        )}
      </section>

      <AuditTrail events={state?.audit ?? []} />
    </div>
  );
}
