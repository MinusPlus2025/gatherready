/* ==========================================================================
   Organizer: publish exactly one fixed offer.

   Before publishing the merchant must affirm the terms; after publishing the
   terms are immutable and shown with their fingerprint. Any change requires a
   new offer and fresh consent from every participant, which the screen says in
   plain words instead of hiding behind a version number.
   ========================================================================== */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SlotView, WorkshopView } from '../../shared/api.js';
import { apiFieldErrors, describeError } from '../lib/api.js';
import { useApp } from '../lib/store.js';
import {
  AuditTrail,
  CheckboxField,
  EmptyState,
  ErrorSummary,
  Fingerprint,
  InlineNotice,
  PageHeader,
  StatusBadge,
  TermsList,
  type SummaryError,
} from '../components/ui.js';

function termsRowsFor(workshop: WorkshopView, slot: SlotView): Array<{ label: string; value: string }> {
  return [
    { label: 'Merchant', value: workshop.merchantName },
    { label: 'Workshop', value: workshop.title },
    { label: 'Date & time', value: `${slot.dayLabel} · ${slot.timeLabel}` },
    { label: 'Timezone', value: workshop.timezone },
    { label: 'Venue', value: workshop.venue },
    { label: 'Includes', value: workshop.inclusions.join(' · ') },
    { label: 'Total', value: `${workshop.priceLabel} ${workshop.currency}` },
    { label: 'Minimum', value: `${workshop.minParticipants} participants (maximum ${workshop.capacity})` },
    { label: 'Authorization deadline', value: workshop.authDeadlineLabel },
    { label: 'Cancellation', value: workshop.cancellationSummary },
    { label: 'If collection fails', value: workshop.failureHandlingSummary },
  ];
}

export default function OrganizerOffer() {
  const { state, act } = useApp();
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [merchantConfirmed, setMerchantConfirmed] = useState(false);
  const [errors, setErrors] = useState<SummaryError[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const workshop = state?.workshop ?? null;
  const plan = state?.plan ?? null;
  const offer = state?.offer ?? null;
  const slots = workshop?.slots ?? [];

  const workable = useMemo(() => plan?.slots.filter((slot) => slot.meetsMinimum) ?? [], [plan]);
  const effectiveSlotId = selectedSlotId ?? plan?.workableSlotId ?? plan?.slots[0]?.slotId ?? slots[0]?.id ?? null;
  const selectedSlot = slots.find((slot) => slot.id === effectiveSlotId) ?? null;
  const selectedPlanSlot = plan?.slots.find((slot) => slot.slotId === effectiveSlotId) ?? null;

  async function publish(): Promise<void> {
    if (!selectedSlot) {
      setErrors([{ field: 'offer-slot', message: 'Choose a time for the offer.' }]);
      return;
    }
    if (!selectedPlanSlot?.meetsMinimum) {
      setErrors([{ field: 'offer-slot', message: 'This time does not meet the minimum yet, so it cannot be offered.' }]);
      return;
    }
    if (!merchantConfirmed) {
      setErrors([{ field: 'merchant-confirm', message: 'You must confirm the terms before publishing.' }]);
      return;
    }
    setBusy(true);
    setErrors([]);
    setApiError(null);
    try {
      await act({ type: 'offers.publish', payload: { slotId: selectedSlot.id } });
    } catch (caught) {
      setErrors(apiFieldErrors(caught).map((field) => ({ field: field.field, message: field.message })));
      setApiError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  if (!workshop) {
    return (
      <EmptyState title="No workshop yet" action={<Link className="btn btn-primary" to="/organizer/setup">Set up a workshop</Link>}>
        <p>The offer is built from the workshop facts and the plan.</p>
      </EmptyState>
    );
  }

  if (offer) {
    const fitNames = plan?.slots.find((slot) => slot.slotId === offer.slotId)?.fitNames ?? [];
    return (
      <div className="page">
        <PageHeader
          eyebrow="Organizer · step 3"
          title="Your offer is published"
          intro="These terms are fixed. Participants see exactly this summary, verbatim, before any PayPal button."
          actions={<StatusBadge tone="success" word="Offer open for authorization" />}
        />

        {apiError ? (
          <InlineNotice kind="error" title="That did not work">
            {apiError}
          </InlineNotice>
        ) : null}

        <section className="panel offer-panel" aria-labelledby="immutable-terms">
          <div className="panel__head">
            <div>
              <h2 id="immutable-terms">Immutable terms</h2>
              <p className="muted">
                {offer.slotLabel} · version {offer.version} · {offer.status === 'OPEN' ? 'open' : offer.status.toLowerCase()}
              </p>
            </div>
            <StatusBadge tone="info" word={`Fingerprint ${offer.shortHash}`} />
          </div>

          <TermsList rows={offer.termsRows} />

          <Fingerprint shortHash={offer.shortHash} fullHash={offer.offerHash} />

          <div className="lock-note" role="note">
            <h3>Changing anything now needs a new offer</h3>
            <p>
              This offer is locked to fingerprint <code>{offer.shortHash}</code>. If any term changes — price,
              time, venue, inclusions, minimum — you must publish a new offer, and every participant must
              review it and consent again. There is no way to quietly edit a live offer.
            </p>
          </div>

          <p className="muted">
            {fitNames.length > 0
              ? `Confirmed fit: ${fitNames.join(', ')} (${fitNames.length} of a minimum ${workshop.minParticipants}).`
              : `No confirmed fit list is available for this time yet.`}
          </p>

          <div className="button-row">
            <Link className="btn btn-primary" to="/organizer/funding">
              Go to funding
            </Link>
            <Link className="btn btn-secondary" to="/participant/authorize">
              See the participant view
            </Link>
          </div>
        </section>

        <AuditTrail events={state?.audit ?? []} />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Organizer · step 3"
        title="Publish one fixed offer"
        intro="Pick the time that works, read the exact terms participants will see, and confirm them as the merchant. After publishing, the terms cannot change — only a new offer can replace them."
      />

      {!plan ? (
        <EmptyState
          title="The plan is not computed yet"
          action={<Link className="btn btn-secondary" to="/organizer/plan">Go to the plan</Link>}
        >
          <p>An offer can only be published for a time that meets the minimum.</p>
        </EmptyState>
      ) : (
        <>
          {workable.length === 0 ? (
            <InlineNotice kind="warn" title="No time meets the minimum yet">
              Publishing is blocked until a time has at least {plan.minimum} confirmed fits. Go back to the plan
              to see the pending condition or suggested question.
            </InlineNotice>
          ) : null}

          {apiError ? (
            <InlineNotice kind="error" title="The offer was not published">
              {apiError}
            </InlineNotice>
          ) : null}
          <ErrorSummary errors={errors} />

          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              void publish();
            }}
            noValidate
          >
            <fieldset className="fieldset">
              <legend>Choose the time</legend>
              <p className="fieldset__hint">Only a time that already meets the minimum can be offered.</p>
              <div className="slot-choice-list" id="offer-slot">
                {slots.map((slot) => {
                  const planSlot = plan.slots.find((item) => item.slotId === slot.id);
                  const disabled = !planSlot?.meetsMinimum;
                  return (
                    <label
                      key={slot.id}
                      className={`slot-choice${disabled ? ' slot-choice--disabled' : ''}${
                        effectiveSlotId === slot.id ? ' slot-choice--selected' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="offer-slot"
                        value={slot.id}
                        checked={effectiveSlotId === slot.id}
                        disabled={disabled}
                        onChange={() => setSelectedSlotId(slot.id)}
                      />
                      <span className="slot-choice__body">
                        <span className="slot-choice__label">{slot.rangeLabel}</span>
                        <span className="slot-choice__meta">
                          {planSlot
                            ? `${planSlot.fits} confirmed fit${planSlot.fits === 1 ? '' : 's'}${
                                planSlot.meetsMinimum
                                  ? ' — meets the minimum'
                                  : ` — needs ${Math.max(0, plan.minimum - planSlot.fits)} more`
                              }`
                            : 'Plan not available for this time'}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {selectedSlot ? (
              <section className="panel offer-preview" aria-labelledby="offer-preview-title">
                <h2 id="offer-preview-title">The exact summary participants will see</h2>
                <p className="muted">
                  Order is fixed: merchant, workshop, date and time, timezone, venue, includes, total, minimum,
                  authorization deadline, cancellation, if collection fails.
                </p>
                <TermsList rows={termsRowsFor(workshop, selectedSlot)} />
                <Fingerprint shortHash="not assigned yet" fullHash="Generated by the server over these terms at publish time" />
                <p className="muted">
                  The real fingerprint is computed by the server over these terms when you publish.
                </p>
              </section>
            ) : null}

            <section className="panel merchant-confirm" aria-labelledby="merchant-confirm-title">
              <h2 id="merchant-confirm-title">Merchant confirmation</h2>
              <CheckboxField
                id="merchant-confirm"
                checked={merchantConfirmed}
                onChange={setMerchantConfirmed}
                label="I confirm these terms are final for this offer."
                hint="Publishing locks the price, time, venue, inclusions and minimum. Any later change requires a new offer and a new consent from every participant."
              />
              <p className="muted">
                The server re-checks that the time meets the minimum and that the deadline is still ahead before
                the offer goes out. The AI never publishes anything.
              </p>
              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary btn--large"
                  disabled={busy || !merchantConfirmed || !selectedPlanSlot?.meetsMinimum}
                >
                  {busy ? 'Publishing…' : 'Publish offer'}
                </button>
                <Link className="btn btn-ghost" to="/organizer/plan">
                  Back to the plan
                </Link>
              </div>
            </section>
          </form>
        </>
      )}
    </div>
  );
}
