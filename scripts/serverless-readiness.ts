/** Offline configuration gate. No network, secret reads, directory creation or charges. */
import { pathToFileURL } from 'node:url';
export function checkServerlessReadiness(env: Record<string,string|undefined>) {
  const missing: string[] = [];
  if (!/^https:\/\/[^/]+/.test(env.PUBLIC_BASE_URL ?? '')) missing.push('Public HTTPS base URL');
  if (!/^(libsql|https):\/\//.test(env.LIBSQL_URL ?? '')) missing.push('Dedicated remote libSQL database URL');
  if (!env.LIBSQL_AUTH_TOKEN) missing.push('Dedicated remote database token');
  if (env.GATHERREADY_SERVERLESS_EXPERIMENT !== 'true') missing.push('Explicit organizer-triggered settlement mode');
  if (env.DEMO_ISOLATED_TENANTS === 'false' || env.DEMO_ISOLATED_TENANTS === '0') missing.push('Visitor isolation enabled');
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) missing.push('PayPal Sandbox application credentials');
  if (!env.PAYPAL_WEBHOOK_ID) missing.push('Verified Sandbox webhook configuration');
  if (/^(1|true|yes|on)$/i.test(env.PAYPAL_FORCE_SIMULATED ?? '')) missing.push('Real Sandbox mode rather than forced simulation');
  if (env.PAYPAL_BASE_URL && env.PAYPAL_BASE_URL !== 'https://api-m.sandbox.paypal.com') missing.push('Sandbox-only PayPal endpoint');
  if (!env.LLM_PROVIDER || env.LLM_PROVIDER === 'none' || env.LLM_PROVIDER === 'ollama' || !env.LLM_API_KEY) missing.push('Accessible hosted model configuration');
  return { configurationComplete:missing.length===0, missing, productionReady:false,
    stillRequires:['Remote schema initialization on dedicated database','Remote concurrency, restart and tenant isolation acceptance','Real Sandbox authorization/capture/void/refund and webhook acceptance','Durable global quotas and verified zero-cost limits','Public browser acceptance; no unattended scheduler guarantee'] };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result=checkServerlessReadiness(process.env);
  console.log(JSON.stringify(result,null,2));
  if (!result.configurationComplete) process.exitCode=1;
}
