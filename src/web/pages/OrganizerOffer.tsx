/* ==========================================================================
   Organizer: publish exactly one fixed offer.

   IA pass: this is not a numbered "step 3" form. The screen states the truth
   (nothing can be published yet / choose a time / published), shows each
   candidate as a card with the confirmed fit names, then the exact terms and a
   single primary action. Fieldset/legend markup is gone so headings cannot
   collide with notices; terms and fingerprint are collapsed after publishing.
   ========================================================================== */

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { SlotView, WorkshopView } from '../../shared/api.js';
import { apiFieldErrors, describeError } from '../lib/api.js';
import { money, shortSlot } from '../lib/status.js';
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
import { Disclosure, StatusBand } from '../components/workshop.js';

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
  const navigate = useNavigate();
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
  const effectiveSlotId = selectedSlotId ?? plan?.workableSlotId ?? workable[0]?.slotId ?? null;
  const selectedSlot = slots.find((slot) => slot.id === effectiveSlotId) ?? null;
  const selectedPlanSlot = plan?.slots.find((slot) => slot.slotId === effectiveSlotId) ?? null;
  const blocked = Boolean(plan) && workable.length === 0;

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

  const strip = (
    <section className="offer-workshop-strip" aria-label="Workshop">
      {workshop.coverImageUrl ? (
        <img className="offer-workshop-strip__cover" src={workshop.coverImageUrl} alt=""
            onError={(event) => { event.currentTarget.style.display = 'none'; }} width={132} height={99} loading="lazy" />
      ) : null}
      <div>
        <p className="offer-workshop-strip__title">{workshop.title}</p>
        <p className="offer-workshop-strip__facts">
          <span>{workshop.merchantName}</span>
          <span aria-hidden="true">·</span>
          <span>{workshop.slots.map((slot) => shortSlot(slot.rangeLabel)).join(' · ')}</span>
          <span aria-hidden="true">·</span>
          <span>{money(workshop.priceCents)} per person</span>
          <span aria-hidden="true">·</span>
          <span>minimum {workshop.minParticipants}</span>
        </p>
      </div>
    </section>
  );

  if (offer) {
    const fitNames = plan?.slots.find((slot) => slot.slotId === offer.slotId)?.fitNames ?? [];
    return (
      <div className="page">
        <PageHeader
          eyebrow="Organizer · Offer"
          title="Offer published"
          intro="These terms are fixed. Participants see exactly this summary, verbatim, before any PayPal button."
          actions={<StatusBadge tone="success" word="Offer open for authorization" />}
        />
        {strip}
        <div className="status-row">
          <StatusBand
            model={{
              tone: 'success',
              headline: `${shortSlot(offer.slotLabel)} · terms frozen`,
              detail: `${fitNames.length} confirmed fit${fitNames.length === 1 ? '' : 's'} · ${
                money(workshop.priceCents)
              } · minimum ${workshop.minParticipants} · closes ${workshop.authDeadlineLabel}.`,
              action: null,
            }}
          />
          <Link className="btn btn-primary status-row__action" to="/organizer/funding">
            Open funding <ArrowRight size={15} strokeWidth={2.2} aria-hidden="true" />
          </Link>
        </div>

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
          <div className="lock-note" role="note">
            <h3>Changing anything now needs a new offer</h3>
            <p>
              This offer is locked to fingerprint <code>{offer.shortHash}</code>. If any term changes — price, time,
              venue, inclusions, minimum — you must publish a new offer, and every participant must review it and
              consent again. There is no way to quietly edit a live offer.
            </p>
          </div>
          <p className="muted">
            {fitNames.length > 0
              ? `Included participants: ${fitNames.join(', ')} (${fitNames.length} of a minimum ${workshop.minParticipants}).`
              : 'No confirmed fit list is available for this time yet.'}
          </p>
          <div className="button-row">
            <Link className="btn btn-secondary" to="/participant/authorize">
              See the participant view
            </Link>
          </div>
        </section>

        <Disclosure summary="Technical details (offer fingerprint, audit)">
          <Fingerprint shortHash={offer.shortHash} fullHash={offer.offerHash} />
          <AuditTrail events={state.audit ?? []} />
        </Disclosure>
      </div>
    );
  }

  const status = blocked
    ? {
        tone: 'warn' as const,
        headline: 'No time meets the minimum yet',
        detail: `Publishing is blocked until a time has at least ${workshop.minParticipants} confirmed fits. Ask the one question on the plan, or wait for another confirmation.`,
        action: null,
      }
    : {
        tone: 'info' as const,
        headline: 'Choose a time and confirm the terms',
        detail: `Only a time with at least ${workshop.minParticipants} confirmed fits can be offered. Publishing freezes price, time and terms for everyone.`,
        action: null,
      };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Organizer · Offer"
        title="Publish one fixed offer"
        intro="One time, one price, one set of terms. After publishing, nothing can be edited in place — a change means a new offer and fresh consent from every participant."
      />
      {strip}

      <div className="status-row">
        <StatusBand model={status} />
        <Link className="btn btn-secondary status-row__action" to="/organizer/plan">
          Back to the plan
        </Link>
      </div>

      {apiError ? (
        <InlineNotice kind="error" title="The offer was not published">
          {apiError}
        </InlineNotice>
      ) : null}
      <ErrorSummary errors={errors} />

      {!plan ? (
        <EmptyState title="The plan is not computed yet">
          <p>An offer can only be published for a time that meets the minimum.</p>
        </EmptyState>
      ) : (
        <section className="panel" aria-labelledby="choose-time">
          <h2 id="choose-time">Candidate times</h2>
          <p className="muted">
            Confirmed fit counts only. A conditional participant never counts until they answer yes; a confirmed
            time is still not a payment.
          </p>
          <div className="offer-slot-list" role="radiogroup" aria-labelledby="choose-time">
            {plan.slots.map((row) => {
              const slot = slots.find((item) => item.id === row.slotId);
              if (!slot) return null;
              const selected = effectiveSlotId === row.slotId;
              return (
                <label
                  key={row.slotId}
                  className={`offer-slot${selected ? ' offer-slot--selected' : ''}${row.meetsMinimum ? '' : ' offer-slot--disabled'}`}
                >
                  <input
                    type="radio"
                    name="offer-slot"
                    value={row.slotId}
                    checked={selected}
                    disabled={!row.meetsMinimum}
                    onChange={() => setSelectedSlotId(row.slotId)}
                  />
                  <span className="offer-slot__body">
                    <span className="offer-slot__label">{slot.rangeLabel}</span>
                    <span className="offer-slot__meta">
                      {row.fits} confirmed fit{row.fits === 1 ? '' : 's'}
                      {row.meetsMinimum
                        ? ` · meets minimum ${plan.minimum}`
                        : ` · needs ${Math.max(plan.minimum - row.fits, 0)} more`}
                    </span>
                    {row.fitNames.length > 0 ? <span className="offer-slot__names">{row.fitNames.join(', ')}</span> : null}
                  </span>
                  <span className={`offer-slot__badge${row.meetsMinimum ? '' : ' offer-slot__badge--blocked'}`}>
                    {row.meetsMinimum ? 'Meets minimum' : 'Blocked'}
                  </span>
                </label>
              );
            })}
          </div>

          {selectedSlot && selectedPlanSlot?.meetsMinimum ? (
            <>
              <h3 className="offer-preview-title">The exact summary participants will see</h3>
              <p className="muted">
                Order is fixed: merchant, workshop, date and time, timezone, venue, includes, total, minimum,
                authorization deadline, cancellation, if collection fails.
              </p>
              <TermsList rows={termsRowsFor(workshop, selectedSlot)} />
              <p className="muted">
                The fingerprint is computed by the server over exactly these terms at publish time.
              </p>

              <section className="merchant-confirm" aria-labelledby="merchant-confirm-title">
                <h3 id="merchant-confirm-title">Merchant confirmation</h3>
                <CheckboxField
                  id="merchant-confirm"
                  checked={merchantConfirmed}
                  onChange={setMerchantConfirmed}
                  label="I confirm these terms are final for this offer."
                  hint="Publishing locks the price, time, venue, inclusions and minimum. Any later change requires a new offer and a new consent from every participant."
                />
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn--large"
                    disabled={busy || !merchantConfirmed}
                    onClick={() => void publish()}
                  >
                    {busy ? 'Publishing…' : 'Publish offer'}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => navigate('/organizer/plan')}>
                    Back to the plan
                  </button>
                </div>
              </section>
            </>
          ) : (
            <p className="muted">
              Select a time that meets the minimum to see the exact terms. Nothing can be published for a time that is
              still short of {plan.minimum} confirmed participants.
            </p>
          )}
        </section>
      )}

      <Disclosure summary="Technical details (plan inputs hash, audit)">
        <p className="muted">
          Plan inputs hash: <code>{plan?.planInputsHash ?? '—'}</code>
        </p>
        <AuditTrail events={state.audit ?? []} />
      </Disclosure>
    </div>
  );
}
