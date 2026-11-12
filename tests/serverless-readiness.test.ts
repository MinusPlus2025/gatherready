import {describe,it,expect} from 'vitest';
import {checkServerlessReadiness} from '../scripts/serverless-readiness.js';
describe('offline serverless configuration gate',()=>{
 it('reports missing configuration without exposing any environment values',()=>{
  const r=checkServerlessReadiness({LIBSQL_AUTH_TOKEN:'sentinel-secret',PUBLIC_BASE_URL:'http://localhost:5295'});
  expect(r.configurationComplete).toBe(false);expect(JSON.stringify(r)).not.toContain('sentinel-secret');expect(r.productionReady).toBe(false);
 });
 it('does not confuse complete configuration with verified deployment',()=>{
  const r=checkServerlessReadiness({PUBLIC_BASE_URL:'https://example.invalid',LIBSQL_URL:'libsql://fixture.invalid',LIBSQL_AUTH_TOKEN:'fixture',GATHERREADY_SERVERLESS_EXPERIMENT:'true',PAYPAL_CLIENT_ID:'fixture',PAYPAL_CLIENT_SECRET:'fixture',PAYPAL_WEBHOOK_ID:'fixture',LLM_PROVIDER:'openai',LLM_API_KEY:'fixture'});
  expect(r.configurationComplete).toBe(true);expect(r.productionReady).toBe(false);expect(r.stillRequires.length).toBeGreaterThan(0);
 });
 it('rejects local DB, local model, live PayPal, disabled isolation and simulation',()=>{
  const r=checkServerlessReadiness({LIBSQL_URL:'file:/tmp/demo',LLM_PROVIDER:'ollama',PAYPAL_BASE_URL:'https://api-m.paypal.com',DEMO_ISOLATED_TENANTS:'false',PAYPAL_FORCE_SIMULATED:'true'});
  expect(r.missing).toContain('Visitor isolation enabled');expect(r.missing).toContain('Sandbox-only PayPal endpoint');expect(r.configurationComplete).toBe(false);
 });
});
