/** Vercel request adapter. EXPERIMENTAL: no unattended scheduler is provided.
 * Do not deploy as a finished payment service until the external recovery job,
 * remote database and real sandbox acceptance checks pass.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadConfig, assertSandbox } from '../src/server/config.js';
import { openDb } from '../src/server/db.js';
import { Repo } from '../src/server/repo.js';
import { Service } from '../src/server/service.js';
import { buildApp } from '../src/server/routes.js';

let ready: ReturnType<typeof initialize> | undefined;
async function initialize() {
  const url = process.env.LIBSQL_URL ?? '';
  if (!/^(libsql|https):\/\//.test(url)) throw new Error('Remote database configuration required');
  // Explicit setup gate prevents accidentally shipping the original promises
  // of a continuously running 30-second scheduler on a request-only platform.
  if (process.env.GATHERREADY_SERVERLESS_EXPERIMENT !== 'true') {
    throw new Error('Serverless experiment must be explicitly acknowledged');
  }
  const cfg = loadConfig(); assertSandbox(cfg);
  if (cfg.llm.provider === 'ollama') throw new Error('A local model is not reachable from this deployment');
  const db = await openDb(url, { authToken: process.env.LIBSQL_AUTH_TOKEN, migrate: false });
  const repo = new Repo(db);
  const app = buildApp({cfg,repo,service:new Service(cfg,repo)});
  app.get('/api/deployment-status', async()=>({
    database:'remote-libsql', backgroundScheduler:false,
    readiness:'experimental',
    limitation:'No unattended deadline cancellation or recovery is scheduled by this serverless adapter.'
  }));
  await app.ready();
  return app;
}
export default async function handler(req: IncomingMessage,res: ServerResponse) {
  try {
    ready ??= initialize().catch(error=>{ready=undefined;throw error;});
    const app=await ready;
    app.server.emit('request',req,res);
  } catch {
    // Never echo database URLs, tokens, model credentials or provider payloads.
    res.statusCode=503;res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({error:'Deployment not configured or not ready'}));
  }
}
