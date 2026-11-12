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
   ========================================================================== */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { markAwaitingPaypal, useApp } from '../lib/store.js';
import { describeError } from '../lib/api.js';
import { formatCents, paymentStatusWord } from '../lib/format.js';
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
  const participantSummary = state ? participantStatus(state) : null;
  const moneyNotes = state ? offerMoneyNotes(state) : '';

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
        setError('The server did not return a checkout. Nothing was charged and no hold was created.');
        return;
      }
      if (mock) {
        // Dev mock only: the store stands in for the approval redirect and posts
        // the simulated result; this screen still renders only server state.
        setNotice('Dev mock: standing in for the PayPal approval step. No PayPal account is contacted.');
        return;
      }
      const destination = next.mode.paypal === 'sandbox' ? checkout.approveUrl : checkout.simulatedApprovePath;
      if (!destination) {
        setError('The server did not return an approval link. Nothing was charged.');
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
      setNotice('Your authorization was withdrawn and the hold is being released. Nothing was charged.');
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  if (!state) return null;
  if (!workshop) {
    return (
      <EmptyState title="No workshop yet">
        <p>The organizer has not set up a workshop. There is nothing to authorize.</p>
      </EmptyState>
    );
  }
  if (!me) {
    return (
      <EmptyState title="This page belongs to a participant">
        <p>Use the demo view switcher above to act as one of the synthetic participants.</p>
      </EmptyState>
    );
  }
  if (!offer) {
    return (
      <div className="page page--narrow">
        <PageHeader eyebrow={`Participant · ${me.displayName}`} title="No fixed offer yet" />
        <EmptyState title="Nothing to authorize right now">
          <p>
            The organizer has not published a fixed offer. Your confirmed preferences still count, and nothing
            can be charged before you review the full offer and agree.
          </p>
        </EmptyState>
        <div className="button-row">
          <Link className="btn btn-secondary" to="/participant/preferences">
            Your preferences
          </Link>
        </div>
      </div>
    );
  }
  if (!offer.viewerIncluded) {
    return (
      <div className="page page--narrow">
        <PageHeader eyebrow={`Participant · ${me.displayName}`} title="This offer does not include you" />
        <EmptyState title="You are not counted in this offer">
          <p>
            The organizer published an offer for <strong>{offer.slotLabel}</strong>, but your confirmed
            preference does not accept that time. Nothing will be charged and your preference stays as you set
            it.
          </p>
        </EmptyState>
        <div className="button-row">
          <Link className="btn btn-secondary" to="/participant/preferences">
            Review your preferences
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--narrow">
      <PageHeader
        eyebrow={`Participant · ${me.displayName}`}
        title="Review and authorize"
        intro="Read the whole summary below. Nothing is captured now — this creates a temporary PayPal authorization for the exact total, captured only if the workshop is confirmed."
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
        <InlineNotice kind="error" title="Nothing was charged">
          {error}
        </InlineNotice>
      ) : null}
      {notice ? <InlineNotice kind="info">{notice}</InlineNotice> : null}

      <section className="panel offer-panel" aria-labelledby="offer-summary-title">
        {workshop?.coverImageUrl ? (
          <img className="offer-cover" src={workshop.coverImageUrl} alt="" width={1024} height={420} loading="lazy" />
        ) : null}
        <div className="panel__head">
          <div>
            <h2 id="offer-summary-title">1 · The fixed offer</h2>
            <p className="muted">
              {offer.slotLabel} · offer version {offer.version}. Every row below is part of the offer, not a
              summary written afterwards.
            </p>
          </div>
          <span className="chip chip--sandbox">Sandbox · No real money</span>
        </div>

        <TermsList rows={offer.termsRows} />

        <div className="offer-total" aria-live="polite">
          <span className="offer-total__label">Total if the workshop is confirmed</span>
          <span className="offer-total__value">{amountLabel} {offer.terms.currency}</span>
          <span className="offer-total__note">
            Captured only once, only when at least {offer.terms.minParticipants} people are authorized and the
            authorization deadline has not passed.
          </span>
        </div>

        <Disclosure summary="Technical details (offer fingerprint)">
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
        <h2 id="consent-title">2 · Your agreement</h2>
        <p className="consent-text">{offer.consent.text}</p>
        <CheckboxField
          id="consent"
          checked={consent}
          onChange={setConsent}
          label={offer.consent.checkboxLabel}
          hint="This box starts unchecked on purpose. Nothing happens until you tick it and press the button."
        />
      </section>

      <section className="panel pay-panel" aria-labelledby="pay-title">
        <h2 id="pay-title">3 · Authorization</h2>

        {checking ? (
          <div className="checking-panel" role="status" aria-live="polite">
            <h3>Checking with PayPal</h3>
            <p>
              Your browser has come back from PayPal. This screen only shows what the server reports — a
              finished button is not a payment, so we wait for the authorization state to arrive.
            </p>
            <StatusBadge tone="progress" word={myPayment?.statusLabel ?? 'Waiting for the server'} />
            <p className="muted">This page refreshes every 4 seconds while the authorization is in flight.</p>
          </div>
        ) : authorized ? (
          <div className="status-panel status-panel--success" role="status" aria-live="polite">
            <h3>Authorized — not charged yet</h3>
            <p>
              Your PayPal account has a temporary authorization of {amountLabel}. The studio is paid only if the
              workshop is confirmed with enough people; otherwise the hold is released and nothing is charged.
            </p>
            <dl className="detail-grid detail-grid--tight">
              <div>
                <dt>Amount</dt>
                <dd>{amountLabel} {offer.terms.currency}</dd>
              </div>
              <div>
                <dt>Authorization</dt>
                <dd>{myPayment?.authorizationId ?? '—'}</dd>
              </div>
              <div>
                <dt>Payment mode</dt>
                <dd>
                  {myPayment?.simulated ? (
                    <span className="chip chip--sim">Simulated PayPal — no real money</span>
                  ) : (
                    'PayPal sandbox'
                  )}
                </dd>
              </div>
            </dl>
            <details className="danger-zone">
              <summary>Withdraw this authorization</summary>
              <p>
                You can withdraw before the organizer captures, and the hold is released. Nothing is charged. If
                the workshop is already settled, the outcome is shown on the result page instead.
              </p>
              <button type="button" className="btn btn-secondary" onClick={() => void withdraw()} disabled={busy}>
                {busy ? 'Withdrawing…' : 'Withdraw authorization'}
              </button>
            </details>
          </div>
        ) : settled ? (
          <div className="status-panel" role="status" aria-live="polite">
            <h3>{myPayment?.statusLabel ?? 'Your authorization changed'}</h3>
            <p>
              {paymentStatusWord[myPayment?.status ?? 'NONE']}. This status came from the server, not from a
              button click.
            </p>
            {myPayment?.status === 'VOIDED' ? (
              <p>The temporary hold was released. Nothing was charged.</p>
            ) : null}
            {myPayment?.status === 'REFUNDED' ? <p>The refund was confirmed by PayPal.</p> : null}
            {myPayment?.status === 'REFUNDING' ? (
              <p>A refund has been requested but is not confirmed yet — we do not call it refunded until PayPal says so.</p>
            ) : null}
            {myPayment?.status === 'MANUAL_REVIEW' || myPayment?.status === 'UNKNOWN' ? (
              <p>An uncertain outcome needs a person to check PayPal. Nothing is retried automatically.</p>
            ) : null}
          </div>
        ) : (
          <>
            <p className="muted" id="paypal-sim-note">
              {state.mode.paypal === 'simulated' ? (
                <>
                  <strong>Simulated PayPal — no real money.</strong> No PayPal account is contacted. The server
                  records a sandbox stand-in so the rest of the flow can be tested end to end.
                </>
              ) : (
                'You will be handed to PayPal sandbox to authorize the exact total. No live money is involved.'
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
              {consent
                ? 'When you press the button you will be handed to PayPal. Returning does not mark you paid — we read the authorization state back from the server.'
                : 'Tick the agreement box above to enable the payment control. It is disabled until you do.'}
            </p>
          </>
        )}
      </section>

      <p className="page__footnote">
        Changed your mind? You can withdraw before capture. If the workshop is not confirmed, every hold is
        released and nothing is charged.
      </p>
    </div>
  );
}
