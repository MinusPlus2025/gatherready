/* ==========================================================================
   Role-aware status sentences (English by default, English + 简体中文).

   The rule from the IA pass: the headline on a home screen is COMPUTED from the
   real state, never authored copy. If the data does not support a claim, the
   sentence says what is actually missing instead. Every sentence is a pure
   function of AppState, so it cannot drift from the server.

   Every exported builder takes a final `locale` argument (default 'en') and
   renders its chrome through translate(). Data — workshop/slot labels, money,
   deadlines, AI question text, participant names — is interpolated unchanged.
   ========================================================================== */

import type { AppState, OfferView, PaymentView, PreferenceView, WorkshopView } from '../../shared/api.js';
import { translate, type Locale } from './i18n.js';

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

/* Compact date/time rendering of a server slot label. The label itself is data
   (server-owned English wording), so this stays an English-style abbreviation in
   both locales; only the surrounding chrome is translated. */
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

export function organizerStatus(state: AppState, locale: Locale = 'en'): StatusBandModel {
  const workshop: WorkshopView | null = state.workshop;
  const plan = state.plan;
  if (!workshop) {
    return {
      tone: 'neutral',
      headline: translate(locale, 'flow.status.organizer.noWorkshop.headline'),
      detail: translate(locale, 'flow.status.organizer.noWorkshop.detail'),
      action: { label: translate(locale, 'flow.action.setUpWorkshop'), kind: 'preferences', to: '/organizer/setup' },
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
      headline: translate(locale, 'flow.status.organizer.confirmed.headline'),
      detail: translate(
        locale,
        captured === 1 ? 'flow.status.organizer.confirmed.detailOne' : 'flow.status.organizer.confirmed.detailMany',
        { count: captured, amount: money(captured * workshop.priceCents) },
      ),
      action: { label: translate(locale, 'flow.status.action.seeResult'), kind: 'result', to: '/organizer/result' },
    };
  }
  if (workshop.status === 'CANCELLED' || workshop.status === 'CANCELLING') {
    return {
      tone: 'warn',
      headline: translate(locale, 'flow.status.organizer.notConfirmed.headline'),
      detail: translate(
        locale,
        workshop.status === 'CANCELLING'
          ? 'flow.status.organizer.cancelling.detail'
          : 'flow.status.organizer.cancelled.detail',
      ),
      action: { label: translate(locale, 'flow.status.action.seeResult'), kind: 'result', to: '/organizer/result' },
    };
  }
  if (workshop.status === 'COMPENSATING' || workshop.status === 'MANUAL_REVIEW') {
    return {
      tone: 'danger',
      headline: translate(locale, 'flow.status.organizer.compensating.headline'),
      detail: translate(locale, 'flow.status.organizer.compensating.detail'),
      action: { label: translate(locale, 'flow.status.action.openFunding'), kind: 'fund', to: '/organizer/funding' },
    };
  }
  if (workshop.status === 'SETTLING') {
    return {
      tone: 'progress',
      headline: translate(locale, 'flow.status.organizer.settling.headline'),
      detail: translate(locale, 'flow.status.organizer.settling.detail'),
      action: { label: translate(locale, 'flow.status.action.watchFunding'), kind: 'fund', to: '/organizer/funding' },
    };
  }
  if (offer?.status === 'OPEN') {
    if (authorized >= minimum) {
      return {
        tone: 'success',
        headline: translate(locale, 'flow.status.organizer.readyToCollect.headline'),
        detail: translate(locale, 'flow.status.organizer.readyToCollect.detail', {
          authorized,
          amount: money(authorized * workshop.priceCents),
          deadline: workshop.authDeadlineLabel,
        }),
        action: { label: translate(locale, 'flow.status.action.confirmAndCollect'), kind: 'fund', to: '/organizer/funding' },
      };
    }
    return {
      tone: 'info',
      headline: translate(
        locale,
        minimum - authorized === 1
          ? 'flow.status.organizer.offerOpen.headlineOne'
          : 'flow.status.organizer.offerOpen.headlineMany',
        { count: Math.max(minimum - authorized, 0) },
      ),
      detail: translate(locale, 'flow.status.organizer.offerOpen.detail', {
        slot: shortSlot(offer.slotLabel),
        authorized,
        minimum,
        deadline: workshop.authDeadlineLabel,
      }),
      action: { label: translate(locale, 'flow.status.action.openFunding'), kind: 'fund', to: '/organizer/funding' },
    };
  }
  if (workableSlot && plan) {
    return {
      tone: 'success',
      headline: translate(locale, 'flow.status.organizer.workableSlot.headline', {
        slot: shortSlot(workableSlot.rangeLabel),
        minimum,
      }),
      detail: translate(locale, 'flow.status.organizer.workableSlot.detail'),
      action: { label: translate(locale, 'flow.status.action.publishTheOffer'), kind: 'publish', to: '/organizer/offer' },
    };
  }
  if (pendingCount > 0) {
    const clarification = pending[0]!;
    return {
      tone: 'progress',
      headline: translate(locale, 'flow.status.organizer.questionOut.headline', {
        name: clarification.participantName,
      }),
      detail: translate(locale, 'flow.status.organizer.questionOut.detail', {
        question: clarification.questionText,
      }),
      action: { label: translate(locale, 'flow.status.action.seeQuestion'), kind: 'ask' },
    };
  }
  if (plan?.suggestion) {
    const suggestion = plan.suggestion;
    const gap = Math.max(minimum - (suggestion.gapClosed - 1), 0);
    return {
      tone: 'warn',
      headline: translate(
        locale,
        gap === 1 ? 'flow.status.organizer.suggestion.headlineOne' : 'flow.status.organizer.suggestion.headlineMany',
        { count: gap, minimum },
      ),
      detail: translate(locale, 'flow.status.organizer.suggestion.detail', {
        name: suggestion.participantName,
        condition: suggestion.conditionText,
        slot: shortSlot(suggestion.slotLabel),
        before: suggestion.gapClosed - 1,
        after: suggestion.gapClosed,
      }),
      action: { label: translate(locale, 'flow.status.action.askTheOneQuestion'), kind: 'ask' },
    };
  }
  if (confirmedCount === 0) {
    return {
      tone: 'neutral',
      headline: translate(locale, 'flow.status.organizer.noConfirmations.headline'),
      detail: translate(locale, 'flow.status.organizer.noConfirmations.detail'),
      action: {
        label: translate(locale, 'flow.status.organizer.noConfirmations.action'),
        kind: 'preferences',
        to: '/participant/preferences',
      },
    };
  }
  const fits = bestFits(plan);
  const gap = Math.max(minimum - fits, 0);
  return {
    tone: 'warn',
    headline: translate(
      locale,
      gap === 1 ? 'flow.status.organizer.suggestion.headlineOne' : 'flow.status.organizer.suggestion.headlineMany',
      { count: gap, minimum },
    ),
    detail: translate(locale, 'flow.status.organizer.suggestion.noPath.detail'),
    action: { label: translate(locale, 'flow.status.organizer.recompute'), kind: 'none' },
  };
}

export function organizerRails(state: AppState, locale: Locale = 'en'): OrganizerRails {
  const workshop = state.workshop;
  const plan = state.plan;
  if (!workshop) {
    return {
      match: { value: '—', detail: translate(locale, 'flow.status.rails.noWorkshop.matchDetail'), ok: false },
      terms: {
        value: translate(locale, 'flow.status.rails.notSelected'),
        detail: translate(locale, 'flow.status.rails.noOfferPublished'),
        ok: false,
      },
      authorization: {
        value: '0 / 0',
        detail: translate(locale, 'flow.status.rails.nothingToAuthorize'),
        ok: false,
      },
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
      detail: translate(
        locale,
        best >= minimum ? 'flow.status.rails.matchMet' : 'flow.status.rails.matchBest',
      ),
      ok: best >= minimum,
    },
    terms:
      offer && offer.status !== 'CANCELLED'
        ? {
            value: translate(locale, 'flow.status.rails.selectedVersion', { version: offer.version }),
            detail: translate(locale, 'flow.status.rails.termsDetail', {
              slot: shortSlot(offer.slotLabel),
              hash: offer.shortHash,
            }),
            ok: true,
          }
        : {
            value: translate(locale, 'flow.status.rails.notSelected'),
            detail: translate(locale, 'flow.status.rails.publishToFreeze'),
            ok: false,
          },
    authorization: {
      value: `${authorized} / ${minimum}`,
      detail:
        captured > 0
          ? translate(locale, 'flow.status.rails.capturedCharged', { count: captured })
          : authorized > 0
            ? translate(locale, 'flow.status.rails.authorizedNotCharged')
            : translate(locale, 'flow.status.rails.noAuthorization'),
      ok: authorized >= minimum,
    },
  };
}

/* -------------------------------- matrix -------------------------------- */

/* `locale` is accepted for call-site parity with the other builders; the row's
   shortLabel is still a compact rendering of the server's slot label, which is
   data and therefore stays in the server's English wording. */
export function matrixRows(state: AppState, locale: Locale = 'en'): MatrixRow[] {
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

/** Align a row's cells to a participant column order by participant ID, never
    by array position. Header order is the server participant order (rendered
    sorted by display name); shuffled API input must not move a cell to another
    person's column. */
export function alignedMatrixCells(
  row: MatrixRow,
  participants: Array<{ id: string; displayName: string }>,
): MatrixCell[] {
  const byId = new Map(row.cells.map((cell) => [cell.participantId, cell]));
  return participants.map(
    (participant) =>
      byId.get(participant.id) ?? {
        participantId: participant.id,
        name: participant.displayName,
        state: 'unknown' as const,
      },
  );
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

export function participantStatus(state: AppState, locale: Locale = 'en'): ParticipantStatusModel {
  const workshop = state.workshop;
  const preference = (state.preferences ?? []).find((p) => p.participantId === state.session.viewParticipantId) ?? null;
  const offer: OfferView | null = state.offer;
  const payment = participantPayment(state);
  const confirmed = preference?.status === 'CONFIRMED';
  const paid = payment?.status ?? 'NONE';
  const authorized = ['AUTHORIZED', 'CAPTURING', 'CAPTURED', 'REFUNDING', 'REFUNDED', 'VOIDED'].includes(paid);
  const charged = paid === 'CAPTURED';
  const failed = ['FAILED', 'UNKNOWN', 'MANUAL_REVIEW'].includes(paid);
  const released = ['VOIDED', 'REFUNDED'].includes(paid);
  const includedInOffer = Boolean(offer?.isOpen && confirmed && offer.viewerIncluded);
  const simulated = state.mode.paypal === 'simulated';

  const steps: ParticipantStep[] = [
    {
      key: 'interest',
      label: translate(locale, 'flow.status.participant.step.interest'),
      state: confirmed ? 'done' : preference ? 'current' : 'waiting',
      detail: confirmed
        ? translate(locale, 'flow.status.participant.step.interest.confirmed', { version: preference?.version ?? 1 })
        : preference
          ? translate(locale, 'flow.status.participant.step.interest.parsed')
          : translate(locale, 'flow.status.participant.step.interest.empty'),
    },
    {
      key: 'terms',
      label: translate(locale, 'flow.status.participant.step.terms'),
      state: offer?.viewerConsented ? 'done' : includedInOffer ? 'current' : 'waiting',
      detail: offer?.viewerConsented
        ? translate(locale, 'flow.status.participant.step.terms.agreed', { version: offer.version })
        : includedInOffer
          ? translate(locale, 'flow.status.participant.step.terms.current')
          : translate(locale, 'flow.status.participant.step.terms.waiting'),
    },
    {
      key: 'authorization',
      label: translate(locale, 'flow.status.participant.step.authorization'),
      state: authorized ? 'done' : failed ? 'failed' : includedInOffer ? 'current' : 'waiting',
      detail: paid === 'REFUNDING'
        ? translate(locale, 'flow.status.participant.step.charge.refunding')
        : paid === 'REFUNDED'
          ? translate(locale, 'flow.status.participant.step.charge.refunded')
          : paid === 'VOIDED'
            ? translate(locale, 'flow.status.participant.step.charge.voided')
            : authorized
        ? paid === 'AUTHORIZED'
          ? translate(locale, 'flow.status.participant.step.authorization.authorized')
          : paid === 'CAPTURED'
            ? translate(locale, simulated ? 'flow.status.participant.step.authorization.chargedSim' : 'flow.status.participant.step.authorization.charged')
            : translate(locale, 'flow.status.participant.step.authorization.capturing')
        : failed
          ? translate(locale, 'flow.status.participant.step.authorization.failed')
          : translate(locale, 'flow.status.participant.step.authorization.holdOnly'),
    },
    {
      key: 'charge',
      label: translate(locale, 'flow.status.participant.step.charge'),
      state: charged || released ? 'done' : paid === 'REFUNDING' ? 'current' : failed ? 'failed' : workshop?.status === 'CONFIRMED' ? 'current' : 'waiting',
      detail: charged
        ? translate(locale, simulated ? 'flow.status.participant.step.charge.chargedSim' : 'flow.status.participant.step.charge.charged')
        : paid === 'REFUNDED'
          ? translate(locale, 'flow.status.participant.step.charge.refunded')
          : paid === 'REFUNDING'
            ? translate(locale, 'flow.status.participant.step.charge.refunding')
            : paid === 'VOIDED'
              ? translate(locale, 'flow.status.participant.step.charge.voided')
              : failed
                ? translate(locale, 'flow.status.participant.step.charge.failed')
                : translate(locale, 'flow.status.participant.step.charge.waiting'),
    },
  ];

  if (!workshop) {
    return {
      tone: 'neutral',
      headline: translate(locale, 'flow.status.participant.noWorkshop.headline'),
      detail: translate(locale, 'flow.status.participant.noWorkshop.detail'),
      steps,
      action: null,
    };
  }
  if (!preference) {
    return {
      tone: 'info',
      headline: translate(locale, 'flow.status.participant.noPreference.headline'),
      detail: translate(locale, 'flow.status.participant.noPreference.detail'),
      steps,
      action: {
        label: translate(locale, 'flow.status.participant.noPreference.action'),
        to: '/participant/preferences',
        kind: 'preferences',
      },
    };
  }
  if (!confirmed) {
    return {
      tone: 'warn',
      headline: translate(locale, 'flow.status.participant.notConfirmed.headline'),
      detail: translate(locale, 'flow.status.participant.notConfirmed.detail'),
      steps,
      action: {
        label: translate(locale, 'flow.status.participant.notConfirmed.action'),
        to: '/participant/preferences',
        kind: 'preferences',
      },
    };
  }
  if (failed) {
    return {
      tone: 'danger',
      headline: translate(locale, 'flow.status.participant.failed.headline'),
      detail: translate(locale, 'flow.status.participant.failed.detail'),
      steps,
      action: {
        label: translate(locale, 'flow.status.participant.failed.action'),
        to: '/participant/authorize',
        kind: 'authorize',
      },
    };
  }
  if (paid === 'REFUNDED' || paid === 'REFUNDING') {
    return {
      tone: 'warn',
      headline: translate(
        locale,
        paid === 'REFUNDED' ? 'flow.status.participant.refunded.headline' : 'flow.status.participant.refunding.headline',
      ),
      detail: translate(
        locale,
        paid === 'REFUNDED' ? 'flow.status.participant.refunded.detail' : 'flow.status.participant.refunding.detail',
      ),
      steps,
      action: { label: translate(locale, 'flow.status.action.seeResult'), to: '/organizer/result', kind: 'result' },
    };
  }
  if (paid === 'VOIDED') {
    return {
      tone: 'warn',
      headline: translate(locale, 'flow.status.participant.voided.headline'),
      detail: translate(locale, 'flow.status.participant.voided.detail'),
      steps,
      action: { label: translate(locale, 'flow.status.action.seeResult'), to: '/organizer/result', kind: 'result' },
    };
  }
  if (charged) {
    return {
      tone: 'success',
      headline: translate(locale, simulated ? 'flow.status.participant.charged.headlineSim' : 'flow.status.participant.charged.headline'),
      detail: translate(locale, simulated ? 'flow.status.participant.charged.detailSim' : 'flow.status.participant.charged.detail', { amount: money(workshop.priceCents) }),
      steps,
      action: { label: translate(locale, 'flow.status.action.seeResult'), to: '/organizer/result', kind: 'result' },
    };
  }
  if (authorized) {
    return {
      tone: 'progress',
      headline: translate(locale, 'flow.status.participant.authorized.headline'),
      detail: translate(locale, 'flow.status.participant.authorized.detail', {
        amount: money(workshop.priceCents),
      }),
      steps,
      action: {
        label: translate(locale, 'flow.status.participant.authorized.action'),
        to: '/participant/authorize',
        kind: 'authorize',
      },
    };
  }
  if (includedInOffer) {
    return {
      tone: 'info',
      headline: translate(locale, 'flow.status.participant.inOffer.headline'),
      detail: translate(locale, 'flow.status.participant.inOffer.detail', {
        slot: shortSlot(offer!.slotLabel),
        amount: money(workshop.priceCents),
        minimum: workshop.minParticipants,
      }),
      steps,
      action: {
        label: translate(locale, 'flow.status.participant.inOffer.action'),
        to: '/participant/authorize',
        kind: 'authorize',
      },
    };
  }
  return {
    tone: 'info',
    headline: translate(locale, 'flow.status.participant.waiting.headline'),
    detail: translate(locale, 'flow.status.participant.waiting.detail'),
    steps,
    action: null,
  };
}

export function offerMoneyNotes(state: AppState, locale: Locale = 'en'): string {
  const workshop = state.workshop;
  if (!workshop) return '';
  return translate(locale, 'flow.status.participant.moneyNotes', {
    amount: money(workshop.priceCents),
    minimum: workshop.minParticipants,
    deadline: workshop.authDeadlineLabel,
  });
}
