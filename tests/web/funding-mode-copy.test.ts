/// <reference types="vite/client" />
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { loadMockState } from '../../src/web/lib/mockState.js';
import OrganizerFunding from '../../src/web/pages/OrganizerFunding.js';
import { moneyEn } from '../../src/web/lib/messages-money-en.js';
import type { PaymentStatus } from '../../src/shared/types.js';
let state = loadMockState('funding', null);
vi.mock('../../src/web/lib/store.js', () => ({ useApp: () => ({ state, act: vi.fn(), fetchedAtMs: Date.now() }) }));
vi.mock('../../src/web/lib/i18n', () => ({ useI18n: () => ({ locale:'en', t:(key:string, values:Record<string,unknown>={}) => (moneyEn[key] ?? key).replace(/\{(\w+)\}/g, (_,k)=>String(values[k] ?? `{${k}}`)) }) }));
const render = () => renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(OrganizerFunding)));
beforeEach(()=> { state = loadMockState('funding', null); state.batch=null; state.workshop!.status='OFFER_OPEN'; state.offer!.isOpen=true; });
describe('payment-mode-specific funding copy without provider calls', () => {
 it('labels simulated collection and never claims money movement or provider calls', () => {
  state.mode.paypal='simulated'; const html=render();
  expect(html).toContain('Simulation only: no PayPal request or real money movement.');
  expect(html).toContain('Confirm workshop · simulate collection');
  expect(html).not.toContain('button in GatherReady that moves money');
  expect(html).not.toContain('requests a PayPal Sandbox capture');
 });
 it('describes sandbox API capture accurately, not real-money production payment', () => {
  state.mode.paypal='sandbox'; const html=render();
  expect(html).toContain('Sandbox only: no real money moves.');
  expect(html).toContain('requests a PayPal Sandbox capture');
  expect(html).not.toContain('Confirm workshop · simulate collection');
 });
 it.each(['UNKNOWN','FAILED','REFUNDING','REFUNDED','VOIDED','MANUAL_REVIEW'] as PaymentStatus[])('does not enable collection or count %s as captured', status => {
  state.payments.forEach(p=>{p.status=status;});
  const html=render();
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Confirm workshop · simulate collection<\/button>/);
  expect(html).toContain('$0.00');
  expect(html).toContain(`pay.status.${status}`);
 });
 it('blocks collection after deadline even with authorizations', () => {
  state.nowUtc = '2030-01-01T00:00:00Z';
  const html=render(); expect(html).toContain('The authorization window has closed.');
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Confirm workshop · simulate collection<\/button>/);
 });
});
