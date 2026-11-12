import { loadConfig, assertSandbox } from './config.js';
import { openDb } from './db.js';
import { Repo } from './repo.js';
import { Service } from './service.js';
import { buildApp } from './routes.js';
import { startScheduler } from './jobs/scheduler.js';
/* ==========================================================================
   Boot.

   Honest startup: the process prints exactly which half is real (PayPal
   sandbox or simulated, live model or structured baseline) and refuses to boot
   if something points at production PayPal. No secrets are printed.
   ========================================================================== */
const cfg = loadConfig();
// Refuse to start against anything but sandbox PayPal.
assertSandbox(cfg);
const repo = new Repo((await openDb(process.env.LIBSQL_URL ?? cfg.dbPath, { authToken: process.env.LIBSQL_AUTH_TOKEN, migrate: !process.env.LIBSQL_URL })));
const service = new Service(cfg, repo);
const app = buildApp({ cfg, repo, service });
const scheduler = (await startScheduler({
    repo,
    paypal: service.paypal,
    now: () => service.now(),
}, { retentionDays: cfg.demo.retentionDays }));
app
    .listen({ port: cfg.port, host: '0.0.0.0' })
    .then(() => {
    console.log(`[gatherready] listening on http://localhost:${cfg.port}`);
    console.log(`[gatherready] paypal: ${service.paypal.mode}${service.paypal.mode === 'simulated' ? ' (simulation; no PayPal API transactions)' : ' (sandbox REST)'}`);
    console.log(`[gatherready] ai: ${service.llm.enabled ? `${service.llm.provider} / ${service.llm.model}` : 'structured baseline (no model key)'}`);
    console.log(`[gatherready] database mode: ${process.env.LIBSQL_URL ? 'remote libSQL' : 'local libSQL'}`);
    console.log(`[gatherready] secrets file: ${cfg.secretsPath}${cfg.hasSecrets ? '' : ' (missing)'}`);
    if (service.paypal.mode === 'simulated') {
        console.warn('[gatherready] degraded mode: PayPal money movement is SIMULATED and labelled in the UI. This startup mode does not establish whether sandbox credentials are configured.');
    }
    if (!service.llm.enabled) {
        console.warn('[gatherready] degraded mode: no model key. Preference extraction uses the structured form or a checked-in recorded sample, labelled in the UI.');
    }
})
    .catch((err) => {
    console.error('[gatherready] failed to start:', err instanceof Error ? err.message : err);
    process.exit(1);
});
function shutdown(signal: string): void {
    console.log(`[gatherready] ${signal} — closing`);
    scheduler.stop();
    app
        .close()
        .catch(() => undefined)
        .finally(() => process.exit(0));
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
