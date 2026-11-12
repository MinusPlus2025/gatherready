/// <reference types="vite/client" />
import { describe,it,expect,vi,afterEach } from 'vitest';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ReconcilePanel} from '../src/web/components/ServerlessReconcile.js';
import {api} from '../src/web/lib/api.js';
vi.mock('../src/web/lib/store.js',()=>({useApp:()=>({})}));
afterEach(()=>vi.unstubAllGlobals());
function render(acknowledged=false,busy=false,error='') {
 return renderToStaticMarkup(React.createElement(ReconcilePanel,{acknowledged,busy,error,message:'',onAcknowledge:()=>{},onConfirm:()=>{}}));
}
describe('serverless organizer control',()=>{
 it('requires acknowledgement and discloses payment effects before enabling action',()=>{
  const html=render();expect(html).toContain('No automatic deadline processing');
  expect(html).toContain('does not collect money');expect(html).toContain('pending refund');
  expect(html).toMatch(/<button[^>]*disabled/);expect(html).toContain('type="checkbox"');
  expect(render(true)).not.toMatch(/<button[^>]*disabled/);
 });
 it('disables duplicate actions while busy and announces failure without claiming nothing happened',()=>{
  expect(render(true,true)).toMatch(/<button[^>]*disabled/);
  expect(render(true,true)).toContain('aria-busy="true"');
  expect(render(false,false,'Outcomes may still be pending')).toContain('role="alert"');
  expect(render(false,false,'Outcomes may still be pending')).toContain('Outcomes may still be pending');
 });
 it('uses explicit same-origin POST, URL encoding and participant token propagation',async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:true,text:async()=>'{}'});vi.stubGlobal('fetch',fetcher);
  await api.reconcileWorkshop('ws /test','fixture-token');
  expect(fetcher).toHaveBeenCalledOnce();const [url,opts]=fetcher.mock.calls[0]!;
  expect(url).toBe('/api/workshops/ws%20%2Ftest/reconcile');expect(opts.method).toBe('POST');
  expect(opts.credentials).toBe('same-origin');expect(opts.headers['x-gatherready']).toBe('1');
  expect(opts.headers['X-Participant-Token']).toBe('fixture-token');
 });
});
