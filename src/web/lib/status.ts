/* ==========================================================================
   Role-aware status sentences (English UI).

   The rule from the IA pass: the headline on a home screen is COMPUTED from the
   real state, never authored copy. If the data does not support a claim, the
   sentence says what is actually missing instead. Every sentence is a pure
   function of AppState, so it cannot drift from the server.
   ========================================================================== */

import type { AppState, OfferView, PaymentView, PreferenceView, WorkshopView } from '../../shared/api.js';

export type StatusTone = 'neutral' | 'info' | 'progress' | 'success' | 'warn' | 'danger';

export interface StatusBandModel {
  tone: StatusTone;
  headline: string;
  detail: string;
  action: { label: string; kind: 'publish' | 'ask' | 'fund' | 'result' | 'preferences' | 'authorize' | 'none'; to?: string } | null;
}

export type CellState = 'accepted' | 'preferred' | 'conditional' | 'cannot' | 'unknown';

export interface MatrixCell {
  participantId: string;
  name: string;
  state: CellState;
}

export interface MatrixRow {
  slotId: string;
  label: string;
  shortLabel: string;
  cells: MatrixCell[];
  fits: number;
  ceiling: number;
  meetsMinimum: boolean;
  isSelectedOfferSlot: boolean;
}

export interface OrganizerRails {
  match: { value: string; detail: string; ok: boolean };
  terms: { value: string; detail: string; ok: boolean };
  authorization: { value: string; detail: string; ok: boolean };
}

export function money(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function shortSlot(label: string): string {
  const date = /^(\w{3})\w*, (\w{3})\w* (\d{1,2}), (\d{4})/.exec(label);
  const time = /(\d{1,2}:\d{2}–\d{1,2}:\d{2})/.exec(label);
  if (date) {
    const [, day, month, dayNum] = date;
    return `${day} ${dayNum} ${month}${time ? ` · ${time[1]}` : ''}`;
  }
  return label;
}

function confirmedPrefs(state: AppState): PreferenceView[] {
  return (state.preferences ?? []).filter((preference) => preference.status === 'CONFIRMED');
}

function openClarifications(state: AppState) {
  return (state.clarifications ?? []).filter((c) => c.status === 'PROPOSED' || c.status === 'SENT');
}

function bestFits(plan: AppState['plan']): number {
  if (!plan) return 0;
  return plan.slots.reduce((max, slot) => Math.max(max, slot.fits), 0);
}

/* ------------------------------- organizer ------------------------------- */

export function organizerStatus(state: AppState): StatusBandModel {
  const workshop: WorkshopView | null = state.workshop;
  const plan = state.plan;
  if (!workshop) {
    return {
      tone: 'neutral',
      headline: 'No workshop yet',
      detail: 'Create the activity facts first: three candidate times, price, minimum and authorization deadline.',
      action: { label: 'Set up a workshop', kind: 'preferences', to: '/organizer/setup' },
    };
  }
  const minimum = workshop.minParticipants;
  const confirmedCount = confirmedPrefs(state).length;
  const offer: OfferView | null = state.offer;
  const payments = state.payments ?? [];
  const authorized = payments.filter((p) => ['AUTHORIZED', 'CAPTURING'].includes(p.status)).length;
  const captured = payments.filter((p) => p.status === 'CAPTURED').length;
  const pending = openClarifications(state);
  const workableSlot = plan?.workableSlotId
    ? workshop.slots.find((slot) => slot.id === plan.workableSlotId) ?? null
    : null;
  const pendingCount = pending.length;

  if (workshop.status === 'CONFIRMED' || captured > 0) {
    return {
      tone: 'success',
      headline: 'Workshop confirmed and charged',
      detail: `${captured} charge${captured === 1 ? '' : 's'} completed · ${money(captured * workshop.priceCents)} captured.`,
      action: { label: 'See the result', kind: 'result', to: '/organizer/result' },
    };
  }
  if (workshop.status === 'CANCELLED' || workshop.status === 'CANCELLING') {
    return {
      tone: 'warn',
      headline: 'Workshop not confirmed',
      detail: workshop.status === 'CANCELLING'
        ? 'Releasing authorizations and handling refunds now.'
        : 'This round did not reach the minimum. Holds were released; any captured charge follows the cancellation policy.',
      action: { label: 'See the result', kind: 'result', to: '/organizer/result' },
    };
  }
  if (workshop.status === 'COMPENSATING' || workshop.status === 'MANUAL_REVIEW') {
    return {
      tone: 'danger',
      headline: 'Collection problem — compensation in progress',
      detail: 'Uncaptured holds are being released and captured charges refunded. The per-person rows are the source of truth.',
      action: { label: 'Open funding', kind: 'fund', to: '/organizer/funding' },
    };
  }
  if (workshop.status === 'SETTLING') {
    return {
      tone: 'progress',
      headline: 'Collecting payments',
      detail: 'Batch locked. The server captures each authorization and checks every result with PayPal.',
      action: { label: 'Watch funding', kind: 'fund', to: '/organizer/funding' },
    };
  }
  if (offer?.status === 'OPEN') {
    if (authorized >= minimum) {
      return {
        tone: 'success',
        headline: 'Authorizations meet the minimum — ready to collect',
        detail: `${authorized} authorizations (not charges) · ${money(authorized * workshop.priceCents)} to collect · closes ${workshop.authDeadlineLabel}.`,
        action: { label: 'Confirm and collect', kind: 'fund', to: '/organizer/funding' },
      };
    }
    return {
      tone: 'info',
      headline: `Offer published — ${Math.max(minimum - authorized, 0)} more authorization${minimum - authorized === 1 ? '' : 's'} needed`,
      detail: `${shortSlot(offer.slotLabel)} · ${authorized}/${minimum} authorized (authorization is not a charge) · closes ${workshop.authDeadlineLabel}.`,
      action: { label: 'Open funding', kind: 'fund', to: '/organizer/funding' },
    };
  }
  if (workableSlot && plan) {
    return {
      tone: 'success',
      headline: `${shortSlot(workableSlot.rangeLabel)} already meets the ${minimum}-person minimum`,
      detail: 'Publish one fixed offer. After publishing, price, time and terms freeze and every participant must re-read and authorize it.',
      action: { label: 'Publish the offer', kind: 'publish', to: '/organizer/offer' },
    };
  }
  if (pendingCount > 0) {
    const clarification = pending[0]!;
    return {
      tone: 'progress',
      headline: `One question is out — waiting for ${clarification.participantName}`,
      detail: `“${clarification.questionText}” · only a person's own yes counts toward the minimum.`,
      action: { label: 'See the question', kind: 'ask' },
    };
  }
  if (plan?.suggestion) {
    const suggestion = plan.suggestion;
    const gap = Math.max(minimum - (suggestion.gapClosed - 1), 0);
    return {
      tone: 'warn',
      headline: `${gap} more confirmation${gap === 1 ? '' : 's'} needed to reach the ${minimum}-person minimum`,
      detail: `${suggestion.participantName}'s condition: “${suggestion.conditionText}” · a yes raises ${shortSlot(suggestion.slotLabel)} from ${suggestion.gapClosed - 1} to ${suggestion.gapClosed}.`,
      action: { label: 'Ask the one question', kind: 'ask' },
    };
  }
  if (confirmedCount === 0) {
    return {
      tone: 'neutral',
      headline: 'No one has confirmed a preference yet',
      detail: 'Interest only counts after the person confirms it themselves. No number can be assumed yet.',
      action: { label: 'See the participant view', kind: 'preferences', to: '/participant/preferences' },
    };
  }
  const fits = bestFits(plan);
  const gap = Math.max(minimum - fits, 0);
  return {
    tone: 'warn',
    headline: `${gap} more confirmation${gap === 1 ? '' : 's'} needed to reach the ${minimum}-person minimum`,
    detail: 'No single open condition closes the gap. More confirmed interest, or another time, is needed.',
    action: { label: 'Recompute the plan', kind: 'none' },
  };
}

export function organizerRails(state: AppState): OrganizerRails {
  const workshop = state.workshop;
  const plan = state.plan;
  if (!workshop) {
    return {
      match: { value: '—', detail: 'No workshop yet', ok: false },
      terms: { value: 'Not selected yet', detail: 'No offer published', ok: false },
      authorization: { value: '0 / 0', detail: 'Nothing to authorize', ok: false },
    };
  }
  const minimum = workshop.minParticipants;
  const best = bestFits(plan);
  const offer = state.offer;
  const payments = state.payments ?? [];
  const authorized = payments.filter((p) => ['AUTHORIZED', 'CAPTURING'].includes(p.status)).length;
  const captured = payments.filter((p) => p.status === 'CAPTURED').length;
  return {
    match: {
      value: `${best} / ${minimum}`,
      detail: best >= minimum ? 'One time meets the minimum' : 'Confirmed fits for the best time',
      ok: best >= minimum,
    },
    terms:
      offer && offer.status !== 'CANCELLED'
        ? { value: `Selected · v${offer.version}`, detail: `${shortSlot(offer.slotLabel)} · hash ${offer.shortHash}`, ok: true }
        : { value: 'Not selected yet', detail: 'Publish one fixed offer to freeze terms', ok: false },
    authorization: {
      value: `${authorized} / ${minimum}`,
      detail: captured > 0 ? `${captured} charged` : authorized > 0 ? 'Authorized, not charged yet' : 'No authorization yet',
      ok: authorized >= minimum,
    },
  };
}

/* -------------------------------- matrix -------------------------------- */

export function matrixRows(state: AppState): MatrixRow[] {
  const workshop = state.workshop;
  if (!workshop) return [];
  const clarifications = state.clarifications ?? [];
  return workshop.slots.map((slot) => {
    const cells: MatrixCell[] = (state.participants ?? []).map((participant) => {
      const preference = (state.preferences ?? []).find((p) => p.participantId === participant.id);
      if (!preference || preference.status !== 'CONFIRMED') {
        return { participantId: participant.id, name: participant.displayName, state: 'unknown' as const };
      }
      if (preference.acceptedSlotIds.includes(slot.id)) {
        return {
          participantId: participant.id,
          name: participant.displayName,
          state: preference.preferredSlotIds.includes(slot.id) ? ('preferred' as const) : ('accepted' as const),
        };
      }
      const condition = preference.conditions.find((c) => c.slotId === slot.id);
      const answered = clarifications.find(
        (c) => c.participantId === participant.id && c.slotId === slot.id && (c.status === 'ANSWERED_YES' || c.status === 'ANSWERED_NO'),
      );
      if (condition && !answered) {
        return { participantId: participant.id, name: participant.displayName, state: 'conditional' as const };
      }
      return { participantId: participant.id, name: participant.displayName, state: 'cannot' as const };
    });
    const fits = cells.filter((cell) => cell.state === 'accepted' || cell.state === 'preferred').length;
    const conditional = cells.filter((cell) => cell.state === 'conditional').length;
    return {
      slotId: slot.id,
      label: slot.rangeLabel,
      shortLabel: shortSlot(slot.rangeLabel),
      cells,
      fits,
      ceiling: fits + conditional,
      meetsMinimum: fits >= workshop.minParticipants,
      isSelectedOfferSlot: state.offer?.slotId === slot.id,
    };
  });
}

/* ------------------------------ participant ------------------------------ */

export interface ParticipantStep {
  key: 'interest' | 'terms' | 'authorization' | 'charge';
  label: string;
  state: 'done' | 'current' | 'waiting' | 'failed';
  detail: string;
}

export interface ParticipantStatusModel {
  tone: StatusTone;
  headline: string;
  detail: string;
  steps: ParticipantStep[];
  action: { label: string; to: string; kind: 'preferences' | 'authorize' | 'result' } | null;
}

function participantPayment(state: AppState): PaymentView | null {
  return (state.payments ?? []).find((payment) => payment.isMine) ?? null;
}

export function participantStatus(state: AppState): ParticipantStatusModel {
  const workshop = state.workshop;
  const preference = (state.preferences ?? []).find((p) => p.participantId === state.session.viewParticipantId) ?? null;
  const offer: OfferView | null = state.offer;
  const payment = participantPayment(state);
  const confirmed = preference?.status === 'CONFIRMED';
  const paid = payment?.status ?? 'NONE';
  const authorized = ['AUTHORIZED', 'CAPTURING', 'CAPTURED'].includes(paid);
  const charged = paid === 'CAPTURED';
  const failed = ['FAILED', 'UNKNOWN', 'MANUAL_REVIEW'].includes(paid);
  const released = ['VOIDED', 'REFUNDED', 'REFUNDING'].includes(paid);
  const includedInOffer = Boolean(offer?.isOpen && confirmed && offer.viewerIncluded);

  const steps: ParticipantStep[] = [
    {
      key: 'interest',
      label: 'Interest',
      state: confirmed ? 'done' : preference ? 'current' : 'waiting',
      detail: confirmed ? `Confirmed · v${preference?.version ?? 1}` : preference ? 'Parsed, not confirmed' : 'Not written yet',
    },
    {
      key: 'terms',
      label: 'Terms',
      state: offer?.viewerConsented ? 'done' : includedInOffer ? 'current' : 'waiting',
      detail: offer?.viewerConsented
        ? `Agreed · offer v${offer.version}`
        : includedInOffer
          ? 'Offer published — read it and consent'
          : 'The organizer has not published a plan that includes you',
    },
    {
      key: 'authorization',
      label: 'Authorization (hold)',
      state: authorized ? 'done' : failed ? 'failed' : includedInOffer ? 'current' : 'waiting',
      detail: authorized
        ? paid === 'AUTHORIZED'
          ? 'Authorized — not charged'
          : paid === 'CAPTURED'
            ? 'Charged'
            : 'Capturing'
        : failed
          ? 'Needs a status check'
          : 'A hold only, never a charge',
    },
    {
      key: 'charge',
      label: 'Charge / cancel',
      state: charged || released ? 'done' : failed ? 'failed' : workshop?.status === 'CONFIRMED' ? 'current' : 'waiting',
      detail: charged
        ? 'Charged — workshop confirmed'
        : paid === 'REFUNDED'
          ? 'Not confirmed — refunded'
          : paid === 'REFUNDING'
            ? 'Not confirmed — refund in progress'
            : paid === 'VOIDED'
              ? 'Not confirmed — hold released'
              : failed
                ? 'Result unknown, reconciling'
                : 'Happens only if the workshop is confirmed',
    },
  ];

  if (!workshop) {
    return { tone: 'neutral', headline: 'No workshop to join yet', detail: 'The organizer has not published the activity facts.', steps, action: null };
  }
  if (!preference) {
    return {
      tone: 'info',
      headline: "You haven't expressed a preference",
      detail: 'Write one sentence or tick the times that work, then confirm it yourself. Only confirmed constraints count.',
      steps,
      action: { label: 'Express my preference', to: '/participant/preferences', kind: 'preferences' },
    };
  }
  if (!confirmed) {
    return {
      tone: 'warn',
      headline: 'Your preference is not confirmed yet',
      detail: 'Check the times and condition on the card, then confirm. Nothing counts before that click.',
      steps,
      action: { label: 'Review and confirm', to: '/participant/preferences', kind: 'preferences' },
    };
  }
  if (failed) {
    return {
      tone: 'danger',
      headline: 'Your payment state needs a check',
      detail: 'The server queries PayPal first and never charges twice. Per-payment state is the source of truth.',
      steps,
      action: { label: 'Open my status', to: '/participant/authorize', kind: 'authorize' },
    };
  }
  if (paid === 'REFUNDED' || paid === 'REFUNDING') {
    return {
      tone: 'warn',
      headline: paid === 'REFUNDED' ? 'Not confirmed — refunded' : 'Not confirmed — refund in progress',
      detail:
        paid === 'REFUNDED'
          ? 'PayPal confirmed the refund. The request alone is never shown as a completed refund.'
          : 'The refund was requested but PayPal has not confirmed it yet, so it is not shown as refunded.',
      steps,
      action: { label: 'See the result', to: '/organizer/result', kind: 'result' },
    };
  }
  if (paid === 'VOIDED') {
    return { tone: 'warn', headline: 'Not confirmed — hold released', detail: 'Nothing was charged; the authorization was released.', steps, action: { label: 'See the result', to: '/organizer/result', kind: 'result' } };
  }
  if (charged) {
    return {
      tone: 'success',
      headline: 'Workshop confirmed — payment captured',
      detail: `You paid ${money(workshop.priceCents)}. The workshop is confirmed by the organizer's collection result.`,
      steps,
      action: { label: 'See the result', to: '/organizer/result', kind: 'result' },
    };
  }
  if (authorized) {
    return {
      tone: 'progress',
      headline: 'Authorized — not charged yet',
      detail: `Your authorization holds ${money(workshop.priceCents)} without charging it. It is captured only if the workshop is confirmed; otherwise it is released.`,
      steps,
      action: { label: 'Review my authorization', to: '/participant/authorize', kind: 'authorize' },
    };
  }
  if (includedInOffer) {
    return {
      tone: 'info',
      headline: 'The plan is published — your terms review is next',
      detail: `Terms frozen: ${shortSlot(offer!.slotLabel)} · ${money(workshop.priceCents)} · minimum ${workshop.minParticipants}. Authorization is a hold, not a charge.`,
      steps,
      action: { label: 'Review and authorize', to: '/participant/authorize', kind: 'authorize' },
    };
  }
  return {
    tone: 'info',
    headline: 'Your preference is confirmed — waiting for the organizer to publish a plan',
    detail: 'When a fixed offer exists you will read the exact terms and authorize; authorization is a hold, not a charge.',
    steps,
    action: null,
  };
}

export function offerMoneyNotes(state: AppState): string {
  const workshop = state.workshop;
  if (!workshop) return '';
  return `${money(workshop.priceCents)} · minimum ${workshop.minParticipants} · closes ${workshop.authDeadlineLabel} · if not formed: holds released and completed charges refunded`;
}
