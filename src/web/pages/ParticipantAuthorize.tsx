/* ==========================================================================
   Participant: review the fixed offer, consent, then authorize.

   Safety rules visible here:
   - the complete summary (every term, in the offer's fixed order) renders
     BEFORE any PayPal control;
   - the consent sentence is the server's exact `offer.consent.text`, with an
     unchecked box state that lives in this component and resets when the offer
     changes;
   - a clicked button is never money. After the browser returns we render
     "Checking with PayPal" from the server snapshot, and an AUTHORIZED hold is
     labelled "not charged yet".

   All chrome goes through t(); the offer's terms rows, consent sentence and
   payment status labels are server data and stay as the server wrote them.
   ========================================================================== */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { markAwaitingPaypal, useApp } from '../lib/store.js';
import { describeError } from '../lib/api.js';
import { formatCents, paymentStatusWord } from '../lib/format.js';
import { useI18n } from '../lib/i18n.js';
import { offerMoneyNotes, participantStatus } from '../lib/status.js';
import { Disclosure, ParticipantSteps } from '../components/workshop.js';
import {
  CheckboxField,
  Countdown,
  EmptyState,
  Fingerprint,
  InlineNotice,
  PageHeader,
  StatusBadge,
  TermsList,
} from '../components/ui.js';
import { PaypalButton } from '../components/PayPalButton.js';

const IN_FLIGHT = ['ORDER_CREATED', 'APPROVED', 'AUTHORIZING'];

export default function ParticipantAuthorize() {
  const { state, act, mock, fetchedAtMs } = useApp();
  const { t, locale } = useI18n();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const workshop = state?.workshop ?? null;
  const offer = state?.offer ?? null;
  const participants = state?.participants ?? [];
  const viewerId = state?.session.viewParticipantId ?? participants.find((participant) => participant.isMe)?.id ?? null;
  const me = participants.find((participant) => participant.id === viewerId) ?? null;
  const myPayment = state?.payments.find((payment) => payment.isMine) ?? null;

  // The consent box must never stay ticked across offers.
  useEffect(() => {
    setConsent(false);
  }, [offer?.id, offer?.offerHash]);

  const checking = Boolean(myPayment && IN_FLIGHT.includes(myPayment.status));
  const authorized = myPayment?.status === 'AUTHORIZED';
  const settled =
    myPayment &&
    !IN_FLIGHT.includes(myPayment.status) &&
    !['NONE', 'AUTHORIZED'].includes(myPayment.status);
  const amountLabel = offer ? formatCents(offer.terms.priceCents) : '';
  const participantSummary = state ? participantStatus(state, locale) : null;
  const moneyNotes = state ? offerMoneyNotes(state, locale) : '';

  async function startCheckout(): Promise<void> {
    if (!offer || !consent || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await act({
        type: 'checkout.start',
        payload: { participantId: viewerId ?? undefined, consent: true },
      });
      const checkout = next.checkout;
      if (!checkout) {
        setError(t('flow.authorize.error.noCheckout'));
        return;
      }
      if (mock) {
        // Dev mock only: the store stands in for the approval redirect and posts
        // the simulated result; this screen still renders only server state.
        setNotice(t('flow.authorize.notice.mock'));
        return;
      }
      const destination = next.mode.paypal === 'sandbox' ? checkout.approveUrl : checkout.simulatedApprovePath;
      if (!destination) {
        setError(t('flow.authorize.error.noApproveLink'));
        return;
      }
      markAwaitingPaypal();
      window.location.assign(destination);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(): Promise<void> {
    if (!viewerId) return;
    setBusy(true);
    setError(null);
    try {
      await act({ type: 'participants.withdraw', id: viewerId });
      setNotice(t('flow.authorize.notice.withdrawn'));
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  if (!state) return null;
  if (!workshop) {
    return (
      <EmptyState title={t('flow.authorize.empty.noWorkshop.title')}>
        <p>{t('flow.authorize.empty.noWorkshop.body')}</p>
      </EmptyState>
    );
  }
  if (!me) {
    return (
      <EmptyState title={t('flow.authorize.empty.organizer.title')}>
        <p>{t('flow.authorize.empty.organizer.body')}</p>
      </EmptyState>
    );
  }
  if (!offer) {
    return (
      <div className="page page--narrow">
        <PageHeader eyebrow={t('flow.participant.eyebrow', { name: me.displayName })} title={t('flow.authorize.noOffer.title')} />
        <EmptyState title={t('flow.authorize.noOffer.emptyTitle')}>
          <p>{t('flow.authorize.noOffer.body')}</p>
        </EmptyState>
        <div className="button-row">
          <Link className="btn btn-secondary" to="/participant/preferences">
            {t('flow.authorize.noOffer.link')}
          </Link>
        </div>
      </div>
    );
  }
  if (!offer.viewerIncluded) {
    return (
      <div className="page page--narrow">
        <PageHeader eyebrow={t('flow.participant.eyebrow', { name: me.displayName })} title={t('flow.authorize.notIncluded.title')} />
        <EmptyState title={t('flow.authorize.notIncluded.emptyTitle')}>
          <p>
            {t('flow.authorize.notIncluded.leadBefore')}<strong>{offer.slotLabel}</strong>{t('flow.authorize.notIncluded.leadAfter')}
          </p>
        </EmptyState>
        <div className="button-row">
          <Link className="btn btn-secondary" to="/participant/preferences">
            {t('flow.authorize.notIncluded.link')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--narrow">
      <PageHeader
        eyebrow={t('flow.participant.eyebrow', { name: me.displayName })}
        title={t('flow.authorize.title')}
        intro={t('flow.authorize.intro')}
        actions={
          myPayment && myPayment.status !== 'NONE' ? (
            <StatusBadge
              tone={authorized ? 'success' : checking ? 'progress' : settled ? 'warning' : 'neutral'}
              word={myPayment.statusLabel}
            />
          ) : undefined
        }
      />

      {participantSummary ? <ParticipantSteps steps={participantSummary.steps} /> : null}

      {error ? (
        <InlineNotice kind="error" title={t('flow.authorize.errorTitle')}>
          {error}
        </InlineNotice>
      ) : null}
      {notice ? <InlineNotice kind="info">{notice}</InlineNotice> : null}

      <section className="panel offer-panel" aria-labelledby="offer-summary-title">
        {workshop?.coverImageUrl ? (
          <img className="offer-cover" src={workshop.coverImageUrl} alt=""
            onError={(event) => { event.currentTarget.style.display = 'none'; }} width={1024} height={420} loading="lazy" />
        ) : null}
        <div className="panel__head">
          <div>
            <h2 id="offer-summary-title">{t('flow.authorize.offer.title')}</h2>
            <p className="muted">
              {t('flow.authorize.offer.meta', { slot: offer.slotLabel, version: offer.version })}
            </p>
          </div>
        </div>

        <TermsList rows={offer.termsRows} />

        <div className="offer-total" aria-live="polite">
          <span className="offer-total__label">{t('flow.authorize.offer.totalLabel')}</span>
          <span className="offer-total__value">{amountLabel} {offer.terms.currency}</span>
          <span className="offer-total__note">
            {t('flow.authorize.offer.totalNote', { minimum: offer.terms.minParticipants })}
          </span>
        </div>

        <Disclosure summary={t('flow.authorize.offer.techSummary')}>
          <Fingerprint shortHash={offer.shortHash} fullHash={offer.offerHash} />
        </Disclosure>
        <p className="muted">
          <Countdown
            deadlineUtc={offer.terms.authDeadlineUtc}
            serverNowUtc={state.nowUtc}
            fetchedAtMs={fetchedAtMs}
          />
        </p>
      </section>

      <section className="panel consent-panel" aria-labelledby="consent-title">
        <h2 id="consent-title">{t('flow.authorize.consent.title')}</h2>
        <p className="consent-text">{offer.consent.text}</p>
        <CheckboxField
          id="consent"
          checked={consent}
          onChange={setConsent}
          label={offer.consent.checkboxLabel}
          hint={t('flow.authorize.consent.hint')}
        />
      </section>

      <section className="panel pay-panel" aria-labelledby="pay-title">
        <h2 id="pay-title">{t('flow.authorize.pay.title')}</h2>

        {checking ? (
          <div className="checking-panel" role="status" aria-live="polite">
            <h3>{t('flow.authorize.checking.headline')}</h3>
            <p>{t('flow.authorize.checking.body')}</p>
            <StatusBadge tone="progress" word={myPayment?.statusLabel ?? t('flow.authorize.checking.waitingServer')} />
            <p className="muted">{t('flow.authorize.checking.refresh')}</p>
          </div>
        ) : authorized ? (
          <div className="status-panel status-panel--success" role="status" aria-live="polite">
            <h3>{t('flow.authorize.authorized.headline')}</h3>
            <p>
              {t('flow.authorize.authorized.body', { amount: amountLabel })}
            </p>
            <dl className="detail-grid detail-grid--tight">
              <div>
                <dt>{t('flow.authorize.authorized.amount')}</dt>
                <dd>{amountLabel} {offer.terms.currency}</dd>
              </div>
              <div>
                <dt>{t('flow.authorize.authorized.authorization')}</dt>
                <dd>{myPayment?.authorizationId ?? '—'}</dd>
              </div>
              <div>
                <dt>{t('flow.authorize.authorized.mode')}</dt>
                <dd>
                  {myPayment?.simulated ? (
                    <span className="chip chip--sim">{t('flow.authorize.authorized.simulated')}</span>
                  ) : (
                    t('flow.authorize.authorized.sandbox')
                  )}
                </dd>
              </div>
            </dl>
            <details className="danger-zone">
              <summary>{t('flow.authorize.withdraw.summary')}</summary>
              <p>{t('flow.authorize.withdraw.body')}</p>
              <button type="button" className="btn btn-secondary" onClick={() => void withdraw()} disabled={busy}>
                {busy ? t('flow.authorize.withdraw.withdrawing') : t('flow.authorize.withdraw.button')}
              </button>
            </details>
          </div>
        ) : settled ? (
          <div className="status-panel" role="status" aria-live="polite">
            <h3>{myPayment?.statusLabel ?? t('flow.authorize.settled.changed')}</h3>
            <p>
              {t('flow.authorize.settled.statusFromServer', { status: paymentStatusWord[myPayment?.status ?? 'NONE'] })}
            </p>
            {myPayment?.status === 'VOIDED' ? (
              <p>{t('flow.authorize.settled.voided')}</p>
            ) : null}
            {myPayment?.status === 'REFUNDED' ? <p>{t('flow.authorize.settled.refunded')}</p> : null}
            {myPayment?.status === 'REFUNDING' ? (
              <p>{t('flow.authorize.settled.refunding')}</p>
            ) : null}
            {myPayment?.status === 'MANUAL_REVIEW' || myPayment?.status === 'UNKNOWN' ? (
              <p>{t('flow.authorize.settled.manual')}</p>
            ) : null}
          </div>
        ) : (
          <>
            <p className="muted" id="paypal-sim-note">
              {state.mode.paypal === 'simulated' ? (
                <>
                  <strong>{t('flow.authorize.pay.simulatedStrong')}</strong> {t('flow.authorize.pay.simulatedRest')}
                </>
              ) : (
                t('flow.authorize.pay.sandboxNote')
              )}
            </p>
            <PaypalButton
              simulated={state.mode.paypal === 'simulated' || Boolean(state.checkout?.simulated)}
              amountLabel={`${amountLabel} ${offer.terms.currency}`}
              disabled={!consent || busy}
              busy={busy}
              onClick={() => void startCheckout()}
            />
            <p className="pay-help pay-help--money">{moneyNotes}</p>
            <p className="pay-help" aria-live="polite">
              {consent ? t('flow.authorize.pay.afterConsent') : t('flow.authorize.pay.beforeConsent')}
            </p>
          </>
        )}
      </section>

      <p className="page__footnote">{t('flow.authorize.footnote')}</p>
    </div>
  );
}
