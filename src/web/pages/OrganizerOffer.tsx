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
import { webpSrcSet } from '../lib/images.js';
import { money, shortSlot } from '../lib/status.js';
import { useI18n, type Translate } from '../lib/i18n';
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

function termsRowsFor(
  t: Translate,
  workshop: WorkshopView,
  slot: SlotView,
): Array<{ label: string; value: string }> {
  return [
    { label: t('money.offer.term.merchant'), value: workshop.merchantName },
    { label: t('money.offer.term.workshop'), value: workshop.title },
    { label: t('money.offer.term.dateTime'), value: `${slot.dayLabel} · ${slot.timeLabel}` },
    { label: t('money.offer.term.timezone'), value: workshop.timezone },
    { label: t('money.offer.term.venue'), value: workshop.venue },
    { label: t('money.offer.term.includes'), value: workshop.inclusions.join(' · ') },
    { label: t('money.offer.term.total'), value: `${workshop.priceLabel} ${workshop.currency}` },
    {
      label: t('money.offer.term.minimum'),
      value: t('money.offer.term.minimumValue', { min: workshop.minParticipants, max: workshop.capacity }),
    },
    { label: t('money.offer.term.deadline'), value: workshop.authDeadlineLabel },
    { label: t('money.offer.term.cancellation'), value: workshop.cancellationSummary },
    { label: t('money.offer.term.failure'), value: workshop.failureHandlingSummary },
  ];
}

export default function OrganizerOffer() {
  const { t } = useI18n();
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
      setErrors([{ field: 'offer-slot', message: t('money.offer.error.chooseTime') }]);
      return;
    }
    if (!selectedPlanSlot?.meetsMinimum) {
      setErrors([{ field: 'offer-slot', message: t('money.offer.error.notMinimum') }]);
      return;
    }
    if (!merchantConfirmed) {
      setErrors([{ field: 'merchant-confirm', message: t('money.offer.error.confirmTerms') }]);
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
      <EmptyState
        title={t('money.shared.noWorkshopTitle')}
        action={
          <Link className="btn btn-primary" to="/organizer/setup">
            {t('money.shared.setupWorkshop')}
          </Link>
        }
      >
        <p>{t('money.offer.noWorkshopBody')}</p>
      </EmptyState>
    );
  }

  const strip = (
    <section className="offer-workshop-strip" aria-label={t('money.offer.stripAria')}>
      {workshop.coverImageUrl ? (
        <picture>
          <source type="image/webp" srcSet={webpSrcSet(workshop.coverImageUrl)} sizes="132px" />
          <img className="offer-workshop-strip__cover" src={workshop.coverImageUrl} alt=""
            onError={(event) => { event.currentTarget.style.display = 'none'; }} width={132} height={99} loading="lazy" />
        </picture>
      ) : null}
      <div>
        <p className="offer-workshop-strip__title">{workshop.title}</p>
        <p className="offer-workshop-strip__facts">
          <span>{workshop.merchantName}</span>
          <span aria-hidden="true">·</span>
          <span>{workshop.slots.map((slot) => shortSlot(slot.rangeLabel)).join(' · ')}</span>
          <span aria-hidden="true">·</span>
          <span>
            {money(workshop.priceCents)} {t('money.offer.perPerson')}
          </span>
          <span aria-hidden="true">·</span>
          <span>{t('money.offer.stripMinimum', { min: workshop.minParticipants })}</span>
        </p>
      </div>
    </section>
  );

  if (offer) {
    const fitNames = plan?.slots.find((slot) => slot.slotId === offer.slotId)?.fitNames ?? [];
    return (
      <div className="page">
        <PageHeader
          eyebrow={t('money.offer.eyebrow')}
          title={t('money.offer.publishedTitle')}
          intro={t('money.offer.publishedIntro')}
          actions={<StatusBadge tone="success" word={t('money.offer.statusOpen')} />}
        />
        {strip}
        <div className="status-row">
          <StatusBand
            model={{
              tone: 'success',
              headline: t('money.offer.frozenHeadline', { slot: shortSlot(offer.slotLabel) }),
              detail: t(
                fitNames.length === 1 ? 'money.offer.frozenDetailOne' : 'money.offer.frozenDetailMany',
                {
                  count: fitNames.length,
                  price: money(workshop.priceCents),
                  min: workshop.minParticipants,
                  deadline: workshop.authDeadlineLabel,
                },
              ),
              action: null,
            }}
          />
          <Link className="btn btn-primary status-row__action" to="/organizer/funding">
            {t('money.offer.openFunding')} <ArrowRight size={15} strokeWidth={2.2} aria-hidden="true" />
          </Link>
        </div>

        {apiError ? (
          <InlineNotice kind="error" title={t('money.offer.publishErrorTitle')}>
            {apiError}
          </InlineNotice>
        ) : null}

        <section className="panel offer-panel" aria-labelledby="immutable-terms">
          <div className="panel__head">
            <div>
              <h2 id="immutable-terms">{t('money.offer.immutableTerms')}</h2>
              <p className="muted">
                {offer.slotLabel} ·{' '}
                {t('money.offer.versionLine', {
                  version: offer.version,
                  state: t(`money.offer.state.${offer.status.toLowerCase()}`),
                })}
              </p>
            </div>
            <StatusBadge tone="info" word={t('money.offer.fingerprintBadge', { hash: offer.shortHash })} />
          </div>

          <TermsList rows={offer.termsRows} />
          <div className="lock-note" role="note">
            <h3>{t('money.offer.lockTitle')}</h3>
            <p>
              {t('money.offer.lockLead')}
              <code>{offer.shortHash}</code>
              {t('money.offer.lockTail')}
            </p>
          </div>
          <p className="muted">
            {fitNames.length > 0
              ? t('money.offer.included', {
                  names: fitNames.join(', '),
                  count: fitNames.length,
                  min: workshop.minParticipants,
                })
              : t('money.offer.noFitList')}
          </p>
          <div className="button-row">
            <Link className="btn btn-secondary" to="/participant/authorize">
              {t('money.offer.seeParticipant')}
            </Link>
          </div>
        </section>

        <Disclosure summary={t('money.offer.techOfferSummary')}>
          <Fingerprint shortHash={offer.shortHash} fullHash={offer.offerHash} />
          <AuditTrail events={state?.audit ?? []} />
        </Disclosure>
      </div>
    );
  }

  const status = blocked
    ? {
        tone: 'warn' as const,
        headline: t('money.offer.blockedHeadline'),
        detail: t('money.offer.blockedDetail', { min: workshop.minParticipants }),
        action: null,
      }
    : {
        tone: 'info' as const,
        headline: t('money.offer.chooseHeadline'),
        detail: t('money.offer.chooseDetail', { min: workshop.minParticipants }),
        action: null,
      };

  return (
    <div className="page">
      <PageHeader
        eyebrow={t('money.offer.eyebrow')}
        title={t('money.offer.publishTitle')}
        intro={t('money.offer.publishIntro')}
      />
      {strip}

      <div className="status-row">
        <StatusBand model={status} />
        <Link className="btn btn-secondary status-row__action" to="/organizer/plan">
          {t('money.shared.backToPlan')}
        </Link>
      </div>

      {apiError ? (
        <InlineNotice kind="error" title={t('money.offer.notPublishedTitle')}>
          {apiError}
        </InlineNotice>
      ) : null}
      <ErrorSummary errors={errors} />

      {!plan ? (
        <EmptyState title={t('money.offer.planMissingTitle')}>
          <p>{t('money.offer.planMissingBody')}</p>
        </EmptyState>
      ) : (
        <section className="panel" aria-labelledby="choose-time">
          <h2 id="choose-time">{t('money.offer.candidateTimes')}</h2>
          <p className="muted">{t('money.offer.candidateIntro')}</p>
          <div className="offer-slot-list" id="offer-slot" role="radiogroup" aria-labelledby="choose-time">
            {plan.slots.map((row) => {
              const slot = slots.find((item) => item.id === row.slotId);
              if (!slot) return null;
              const selected = effectiveSlotId === row.slotId;
              const metaKey = row.meetsMinimum
                ? row.fits === 1
                  ? 'money.offer.slotMetaMetOne'
                  : 'money.offer.slotMetaMetMany'
                : row.fits === 1
                  ? 'money.offer.slotMetaNeedsOne'
                  : 'money.offer.slotMetaNeedsMany';
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
                    <span className="offer-slot__label">{shortSlot(slot.rangeLabel)}</span>
                    <span className="offer-slot__meta">
                      {t(metaKey, {
                        count: row.fits,
                        min: plan.minimum,
                        more: Math.max(plan.minimum - row.fits, 0),
                      })}
                    </span>
                    {row.fitNames.length > 0 ? <span className="offer-slot__names">{row.fitNames.join(', ')}</span> : null}
                  </span>
                  <span className={`offer-slot__badge${row.meetsMinimum ? '' : ' offer-slot__badge--blocked'}`}>
                    {row.meetsMinimum ? t('money.offer.meetsMinimum') : t('money.offer.blocked')}
                  </span>
                </label>
              );
            })}
          </div>

          {selectedSlot && selectedPlanSlot?.meetsMinimum ? (
            <>
              <h3 className="offer-preview-title">{t('money.offer.previewTitle')}</h3>
              <p className="muted">{t('money.offer.previewIntro')}</p>
              <TermsList rows={termsRowsFor(t, workshop, selectedSlot)} />
              <p className="muted">{t('money.offer.previewFoot')}</p>

              <section className="merchant-confirm" aria-labelledby="merchant-confirm-title">
                <h3 id="merchant-confirm-title">{t('money.offer.merchantConfirmTitle')}</h3>
                <CheckboxField
                  id="merchant-confirm"
                  checked={merchantConfirmed}
                  onChange={setMerchantConfirmed}
                  label={t('money.offer.merchantConfirmLabel')}
                  hint={t('money.offer.merchantConfirmHint')}
                />
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn--large"
                    disabled={busy || !merchantConfirmed}
                    onClick={() => void publish()}
                  >
                    {busy ? t('money.offer.publishing') : t('money.offer.publish')}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => navigate('/organizer/plan')}>
                    {t('money.shared.backToPlan')}
                  </button>
                </div>
              </section>
            </>
          ) : (
            <p className="muted">{t('money.offer.selectTimeHint', { min: plan.minimum })}</p>
          )}
        </section>
      )}

      <Disclosure summary={t('money.offer.techPlanSummary')}>
        <p className="muted">
          {t('money.offer.planInputsHash')} <code>{plan?.planInputsHash ?? '—'}</code>
        </p>
        <AuditTrail events={state?.audit ?? []} />
      </Disclosure>
    </div>
  );
}
