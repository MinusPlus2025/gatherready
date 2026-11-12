import { describe, it, expect } from 'vitest';
import { loadMockState } from '../../src/web/lib/mockState.js';
import { participantStatus } from '../../src/web/lib/status.js';
import { paymentStatusWord } from '../../src/web/lib/format.js';

describe('refund progress reflects confirmation rather than completion', () => {
  it.each(['REFUNDING', 'REFUNDED', 'VOIDED'] as const)('%s preserves prior authorization without claiming a current hold', status => {
    const state = loadMockState('funding', null);
    state.session.viewParticipantId = state.participants[0].id;
    state.payments.forEach((payment, i) => { payment.isMine = i === 0; payment.status = status; });
    const model = participantStatus(state, 'en');
    expect(model.steps.find(s => s.key === 'authorization')?.state).toBe('done');
    expect(model.steps.find(s => s.key === 'authorization')?.detail).not.toMatch(/hold only/i);
    expect(model.steps.find(s => s.key === 'charge')?.state).toBe(status === 'REFUNDING' ? 'current' : 'done');
  });
  it('generic status labels do not claim that simulated states contacted PayPal', () => {
    expect(paymentStatusWord.REFUNDING).toBe('Refund requested — awaiting confirmation');
    expect(paymentStatusWord.UNKNOWN).toBe('Unknown — checking payment state');
  });
});
