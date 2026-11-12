/// <reference types="vite/client" />
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { loadMockState } from '../src/web/lib/mockState.js';
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
 });
});
