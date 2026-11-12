/// <reference types="vite/client" />
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { loadMockState } from '../src/web/lib/mockState.js';
import { InviteParticipants } from '../src/web/components/InviteParticipants.js';
import OrganizerPlan from '../src/web/pages/OrganizerPlan.js';
const state = loadMockState('plan', null);
state.participants = [];
vi.mock('../src/web/lib/store.js', () => ({ useApp: () => ({ state, act: async () => state, refresh: async () => {}, token: null, mock: false }) }));
vi.mock('../src/web/lib/i18n.js', async (original) => ({ ...(await original<any>()), useI18n: () => ({ locale: 'en', t: (key: string) => key }) }));
describe('organizer invitations', () => {
 it('offers a participant invitation form for a new empty workshop', () => {
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(OrganizerPlan)));
  expect(html).toContain('Create invitation');
  expect(html).toContain('Participant name');
  expect(html).toMatch(/plan-decision__action[^>]*>Invite participants/);
 });
});

describe('closed invitation UI', () => {
 it('hides create input after offer publication and keeps a clear existing-link message', () => {
  state.offer = { id: 'frozen-offer' } as any;
  const html = renderToStaticMarkup(React.createElement(InviteParticipants));
  expect(html).toContain('New invitations are closed');
  expect(html).toContain('Existing invitation links still work');
  expect(html).not.toContain('id="invite-name"');
  state.offer = null;
 });
 it('hides invites on settled workshops even without an offer object', () => {
  const old = state.workshop!.status;
  state.workshop!.status = 'CONFIRMED';
  expect(renderToStaticMarkup(React.createElement(InviteParticipants))).not.toContain('id="invite-name"');
  state.workshop!.status = old;
 });
});
