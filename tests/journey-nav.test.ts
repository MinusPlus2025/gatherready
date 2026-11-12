/// <reference types="vite/client" />
import { describe,it,expect,vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { loadMockState } from '../src/web/lib/mockState.js';
import { JourneyNav } from '../src/web/components/JourneyNav.js';
const state=loadMockState('plan',null);
vi.mock('../src/web/lib/store.js',()=>({useApp:()=>({state})}));
vi.mock('../src/web/lib/i18n.js',()=>({useI18n:()=>({t:(key:string)=>key})}));
const render=(path:string)=>renderToStaticMarkup(React.createElement(MemoryRouter,{initialEntries:[path]},React.createElement(JourneyNav)));
describe('journey orientation',()=>{
 it('keeps the landing page free of workflow chrome',()=>expect(render('/')).toBe(''));
 it('marks only the current screen and makes unavailable results non-interactive',()=>{
 state.session.role='organizer'; state.result=null;
 const html=render('/organizer/plan');
 expect(html.match(/aria-current="page"/g)).toHaveLength(1);
 expect(html).toContain('aria-disabled="true"');
 expect(html).not.toContain('href="/organizer/result"');
 });
 it('does not expose organizer links to participants',()=>{
 state.session.role='participant';
 const html=render('/participant/preferences');
 expect(html).toContain('href="/participant/preferences"');
 expect(html).not.toContain('/organizer/');
 });
});
