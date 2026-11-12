/* ==========================================================================
   Dev-only mock safety tests. The mock exists so screens can be built before
   the server lands, but it must never pretend real money moved, never invent a
   result the real contract does not have, and must keep the offer copy exact
   and ordered. These tests run in plain Node (no DOM).
   ========================================================================== */

import { describe, expect, it } from 'vitest';
import {
  applyMockAction,
  loadMockState,
  MOCK_PARTICIPANT_TOKEN,
  type MockScene,
} from '../../src/web/lib/mockState.js';

const SCENES: MockScene[] = [
  'setup',
  'preferences',
  'plan',
  'clarify',
  'plan-ready',
  'plan-blocked',
  'offer',
  'returning',
  'authorized',
  'funding',
  'result-confirmed',
  'result-not',
];

const OFFER_SCENES: MockScene[] = ['offer', 'returning', 'authorized', 'funding', 'result-confirmed', 'result-not'];

describe('mock is always clearly simulated', () => {
  it('never claims a real PayPal payment on any scene', () => {
    for (const scene of SCENES) {
      const state = loadMockState(scene, 'p_diego');
      expect(state.mode.paypal).toBe('simulated');
      expect(state.mode.banner.toLowerCase()).toContain('no real money');
      for (const payment of state.payments) {
        expect(payment.simulated).toBe(true);
      }
      if (state.offer) {
        expect(state.checkout?.simulated ?? true).toBe(true);
      }
    }
  });

  it('marks the demo session synthetic so real tenants never see the switcher', () => {
    const state = loadMockState('funding', null);
    expect(state.demo.canSwitchRoles).toBe(true);
    expect(state.session.synthetic).toBe(true);
    expect(state.session.role).toBe('organizer');
  });

  it('exposes a demo participant token for the /p/:token route', () => {
    expect(MOCK_PARTICIPANT_TOKEN).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe('mock offer copy', () => {
  it('shows the frozen row order the participant must read before any button', () => {
    const state = loadMockState('offer', 'p_diego');
    expect(state.offer).not.toBeNull();
    expect(state.offer!.termsRows.map((row) => row.label)).toEqual([
      'Merchant',
      'Workshop',
      'Date & time',
      'Timezone',
      'Venue',
      'Includes',
      'Total',
      'Minimum',
      'Authorization deadline',
      'Cancellation',
      'If collection fails',
    ]);
    const total = state.offer!.termsRows.find((row) => row.label === 'Total');
    expect(total?.value).toBe('$45.00 USD');
    const terms = state.offer!.termsRows.find((row) => row.label === 'Date & time');
    expect(terms?.value).toMatch(/2026/);
    expect(terms?.value).toContain('10:00–12:00');
  });

  it('keeps the consent sentence exact, specific and about the real total', () => {
    const state = loadMockState('offer', 'p_diego');
    const offer = state.offer!;
    expect(offer.consent.text).toContain('$45.00');
    expect(offer.consent.text).toContain(offer.terms.merchantName);
    expect(offer.consent.text).toContain('4 people');
    expect(offer.consent.checkboxLabel.length).toBeGreaterThan(10);
    expect(offer.shortHash).toBe(offer.offerHash.slice(0, 12));
  });

  it('includes Diego in the offer after his yes and never marks him consented before he acts', () => {
    const state = loadMockState('offer', 'p_diego');
    expect(state.offer!.viewerIncluded).toBe(true);
    expect(state.offer!.viewerConsented).toBe(false);
    expect(state.payments.every((payment) => payment.status === 'NONE')).toBe(true);
  });
});

describe('mock plan keeps the three numbers distinct', () => {
  it('does not call interest a fit or an authorization', () => {
    const state = loadMockState('plan', null);
    const plan = state.plan!;
    expect(plan.counts.interested).toBe(6);
    expect(plan.counts.fitsThisPlan).toBe(3);
    expect(plan.counts.authorized).toBe(0);
    expect(plan.counts.fitsThisPlan).not.toBe(plan.counts.interested);
  });

  it('proposes exactly one question that closes one concrete gap', () => {
    const state = loadMockState('plan', null);
    const suggestion = state.plan!.suggestion!;
    expect(suggestion).not.toBeNull();
    expect(suggestion.questionText.endsWith('?')).toBe(true);
    expect(suggestion.questionText.length).toBeLessThanOrEqual(160);
    expect(suggestion.questionText.split('?').length - 1).toBe(1);
    expect(suggestion.gapClosed).toBe(1);
    expect(suggestion.factLabel).toBe('Materials');
  });

  it('counts a conditional participant as reachable-only, never as fitting', () => {
    const state = loadMockState('plan', null);
    const slotA = state.plan!.slots.find((slot) => slot.slotId === 'slot_a')!;
    expect(slotA.fits).toBe(3);
    expect(slotA.conditionalCount).toBe(1);
    expect(slotA.reachableMax).toBe(4);
    expect(slotA.meetsMinimum).toBe(false);
  });
});

describe('mock preferences quotes stay verbatim', () => {
  it('keeps every condition quote inside the participant’s own sentence', () => {
    const state = loadMockState('preferences', 'p_diego');
    const mine = state.preferences.find((preference) => preference.participantId === 'p_diego')!;
    expect(mine.status).toBe('DRAFT');
    expect(mine.sourceText).not.toBeNull();
    for (const condition of mine.conditions) {
      expect(mine.sourceText!.includes(condition.sourceQuote)).toBe(true);
    }
  });

  it('labels the mock extraction as a recorded sample, not a live model', () => {
    const state = loadMockState('preferences', 'p_diego');
    const mine = state.preferences.find((preference) => preference.participantId === 'p_diego')!;
    expect(mine.extractionMode).toBe('recorded');
    expect(mine.extractionModel).toBeNull();
  });
});

describe('mock clarification flow', () => {
  it('shows only the participant’s own question and their sentence', () => {
    const state = loadMockState('clarify', 'p_diego');
    expect(state.clarifications).toHaveLength(1);
    const item = state.clarifications[0]!;
    expect(item.isMine).toBe(true);
    expect(item.status).toBe('SENT');
    expect(item.questionText.length).toBeLessThanOrEqual(160);
    expect(item.sourceQuote.length).toBeGreaterThan(0);
    const mine = state.preferences.find((preference) => preference.participantId === 'p_diego')!;
    expect(mine.sourceText).toContain(item.sourceQuote);
  });

  it('a yes makes the plan work and removes the question', () => {
    loadMockState('clarify', 'p_diego');
    const state = applyMockAction({ type: 'clarifications.answer', id: 'clr_diego_materials', payload: { answer: 'YES' } });
    expect(state.plan!.workableSlotId).toBe('slot_a');
    expect(state.plan!.counts.fitsThisPlan).toBeGreaterThanOrEqual(4);
    expect(state.plan!.suggestion).toBeNull();
    expect(state.clarifications[0]!.status).toBe('ANSWERED_YES');
  });

  it('a no keeps the preference and asks nothing again', () => {
    loadMockState('clarify', 'p_diego');
    const state = applyMockAction({ type: 'clarifications.answer', id: 'clr_diego_materials', payload: { answer: 'NO' } });
    expect(state.plan!.workableSlotId).toBeNull();
    expect(state.plan!.suggestion).toBeNull();
    expect(state.plan!.reason).toContain('no open question');
    expect(state.clarifications[0]!.status).toBe('ANSWERED_NO');
  });
});

describe('mock checkout never invents a capture', () => {
  it('goes order → authorizing → authorized and stops there', () => {
    loadMockState('offer', 'p_diego');
    const started = applyMockAction({
      type: 'checkout.start',
      payload: { participantId: 'p_diego', consent: true },
    });
    expect(started.checkout?.simulated).toBe(true);
    const mine = started.payments.find((payment) => payment.isMine)!;
    expect(mine.status).toBe('AUTHORIZING');

    const authorized = applyMockAction({ type: 'checkout.complete', orderId: started.checkout!.orderId });
    expect(authorized.payments.find((payment) => payment.isMine)!.status).toBe('AUTHORIZED');
    expect(authorized.payments.some((payment) => payment.status === 'CAPTURED')).toBe(false);
  });
});

describe('mock funding and results', () => {
  it('only shows a batch once it is locked', () => {
    expect(loadMockState('offer', null).batch).toBeNull();
    const funding = loadMockState('funding', null);
    expect(funding.batch?.status).toBe('LOCKED');
    const included = funding.payments.filter((payment) => payment.status === 'AUTHORIZED');
    expect(included.length).toBe(funding.batch?.expectedParticipantCount);
  });

  it('confirmed result has captured receipts and a confirmed batch', () => {
    const state = loadMockState('result-confirmed', null);
    expect(state.result?.outcome).toBe('CONFIRMED');
    expect(state.result?.lines.every((line) => line.status === 'CAPTURED')).toBe(true);
    expect(state.batch?.status).toBe('CONFIRMED');
    expect(state.result?.refundedLabel).toBe('$0.00');
  });

  it('not-confirmed result distinguishes refunding from refunded and flags manual attention', () => {
    const state = loadMockState('result-not', null);
    expect(state.result?.outcome).toBe('NOT_CONFIRMED');
    const refunding = state.result!.lines.find((line) => line.status === 'REFUNDING');
    const refunded = state.result!.lines.find((line) => line.status === 'REFUNDED');
    expect(refunding).toBeDefined();
    expect(refunded).toBeDefined();
    expect(refunding!.statusLabel).not.toBe(refunded!.statusLabel);
    expect(refunding!.statusLabel.toLowerCase()).toContain('waiting');
    expect(state.result!.lines.some((line) => line.status === 'MANUAL_REVIEW')).toBe(true);
    expect(state.result!.pendingActionCount).toBeGreaterThan(0);
  });
});

describe('mock role switching', () => {
  it('switches to a participant and back to the organizer', () => {
    const organizer = loadMockState('funding', null);
    expect(organizer.session.role).toBe('organizer');

    const asAlice = applyMockAction({ type: 'demo.view', payload: { participantId: 'p_alice' } });
    expect(asAlice.session.role).toBe('participant');
    expect(asAlice.session.viewParticipantId).toBe('p_alice');
    expect(asAlice.participants.find((participant) => participant.id === 'p_alice')!.isMe).toBe(true);

    const back = applyMockAction({ type: 'demo.view', payload: { participantId: null } });
    expect(back.session.role).toBe('organizer');
  });

  it('resets to the empty setup scene', () => {
    loadMockState('funding', null);
    const reset = applyMockAction({ type: 'demo.reset' });
    expect(reset.workshop).toBeNull();
    expect(reset.demo.sampleLoaded).toBe(false);
  });
});
