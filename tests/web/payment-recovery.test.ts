import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { PaymentRecovery } from '../../src/web/components/PaymentRecovery.js';
vi.mock('../../src/web/lib/i18n.js', () => ({useI18n:()=>({t:(key:string)=>key})}));
describe('read-only payment recovery affordance',()=>{
 it('renders an explicitly non-submit button and explanation without issuing payment actions',()=>{
  const refresh=vi.fn();const html=renderToStaticMarkup(React.createElement(PaymentRecovery,{refresh}));
  expect(html).toContain('type="button"');expect(html).toContain('aria-busy="false"');
  expect(html).toContain('flow.authorize.recovery.body');expect(html).toContain('flow.authorize.recovery.button');
  expect(refresh).not.toHaveBeenCalled();expect(html).not.toContain('<form');
 });
});
