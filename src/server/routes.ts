import path from 'node:path';
import { existsSync } from 'node:fs';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import compress from '@fastify/compress';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { ZodError } from 'zod';
import {
  AnswerClarificationRequestSchema,
  ConfirmPreferencesRequestSchema,
  CreateWorkshopRequestSchema,
  DemoViewRequestSchema,
  ParsePreferencesRequestSchema,
  PublishOfferRequestSchema,
  RevisePreferencesRequestSchema,
  StartCheckoutRequestSchema,
} from '../shared/schemas.js';
import type { AppConfig } from './config.js';
import type { Repo } from './repo.js';
import { AppError, Service, randomSessionToken, sessionHashOf, type SessionContext } from './service.js';
import { handleWebhook } from './payments/webhook.js';

/* ==========================================================================
   HTTP layer.

   Safety decisions:
   - The session cookie is a random 32-byte token; only its hash is stored.
   - Every POST requires the `x-gatherready: 1` header (a custom header cannot be
     sent cross-origin by a simple form post) and the cookie is SameSite=Lax.
   - Participant access tokens are looked up by hash; knowing an order id is
     never permission (ownership is checked inside the service).
   - PayPal sandbox only: config refuses a non-sandbox base URL at boot.
   - The webhook route gets the raw body so signature verification is meaningful.
   ========================================================================== */

const SESSION_COOKIE = 'gr_session';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export interface RouteDeps {
  cfg: AppConfig;
  repo: Repo;
  service: Service;
}

interface RequestExtras {
  rawBody?: string;
}

type Body = Record<string, unknown>;

export function buildApp(deps: RouteDeps): FastifyInstance {
  const { cfg, repo, service } = deps;
  const app = Fastify({ logger: false, bodyLimit: 256 * 1024, trustProxy: false });

  // Text compression for JS/CSS/HTML/JSON (open source @fastify/compress).
  app.register(compress, { global: true, threshold: 1024 });

  app.register(cookie, {});

  // Keep the raw JSON string for webhook signature verification.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    (req as FastifyRequest & RequestExtras).rawBody = typeof body === 'string' ? body : String(body);
    try {
      done(null, body === '' ? {} : JSON.parse(String(body)));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  const rate = new Map<string, { count: number; resetAt: number }>();
  function limit(req: FastifyRequest): void {
    const ip = req.ip || 'local';
    const now = Date.now();
    const bucket = rate.get(ip);
    if (!bucket || bucket.resetAt < now) {
      rate.set(ip, { count: 1, resetAt: now + 60_000 });
      return;
    }
    bucket.count += 1;
    if (bucket.count > 240) throw new AppError('RATE_LIMITED', 'too many requests — slow down', 429);
  }

  function requireCsrfHeader(req: FastifyRequest): void {
    const header = req.headers['x-gatherready'];
    if (header !== '1') throw new AppError('CSRF_HEADER_MISSING', 'request rejected: missing same-origin header', 403);
  }

  /**
   * Resolve (or create) the visitor's isolated demo tenant, then apply an
   * optional participant access token.
   */
  async function resolveContext(req: FastifyRequest, reply: FastifyReply): Promise<SessionContext> {
    const cookieToken = (req.cookies as Record<string, string | undefined>)[SESSION_COOKIE];
    const nowIso = service.now();
    let hash: string;
    let tenantId: string;
    let viewParticipantId: string | null = null;

    if (cookieToken && /^[A-Za-z0-9_-]{43}$/.test(cookieToken)) {
      hash = sessionHashOf(cookieToken);
      const existing = repo.getSession(hash);
      if (existing) {
        tenantId = existing.tenantId;
        viewParticipantId = existing.viewParticipantId;
        if (viewParticipantId) {
          const seen = repo.getParticipant(viewParticipantId);
          if (!seen || seen.tenantId !== tenantId) {
            viewParticipantId = null;
            repo.setSessionView(hash, null, nowIso);
          }
        }
        repo.touchSession(hash, nowIso);
      } else {
        tenantId = service.newTenant(nowIso);
        repo.createSession(hash, tenantId, nowIso);
      }
    } else {
      const token = randomSessionToken();
      hash = sessionHashOf(token);
      tenantId = service.newTenant(nowIso);
      repo.createSession(hash, tenantId, nowIso);
      reply.setCookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_MAX_AGE,
        secure: false,
      });
    }

    // Participant links: ?ptoken=… (or X-Participant-Token) binds the session.
    const queryToken = typeof (req.query as Record<string, unknown> | undefined)?.ptoken === 'string'
      ? String((req.query as Record<string, unknown>).ptoken)
      : null;
    const headerToken = typeof req.headers['x-participant-token'] === 'string' ? req.headers['x-participant-token'] : null;
    const rawToken = queryToken ?? headerToken;
    if (rawToken && /^[A-Za-z0-9_-]{43}$/.test(rawToken)) {
      const participant = service.resolveParticipantToken(rawToken);
      if (!participant) throw new AppError('INVALID_LINK', 'this participant link is not valid', 404);
      if (participant.tenantId !== tenantId) {
        repo.bindSessionTenant(hash, participant.tenantId, nowIso);
        tenantId = participant.tenantId;
      }
      viewParticipantId = participant.id;
      repo.setSessionView(hash, viewParticipantId, nowIso);
    }

    return service.ctxFor(tenantId, viewParticipantId, hash);
  }

  function parseBody<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: ZodError } }, body: unknown): T {
    const parsed = schema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new AppError(
        'INVALID_REQUEST',
        'request is not valid',
        400,
        parsed.error.issues.map((i) => ({ field: i.path.join('.') || 'body', message: i.message })),
      );
    }
    return parsed.data;
  }

  /* ------------------------------ routes ------------------------------- */

  app.get('/healthz', async () => ({
    ok: true,
    paypal: cfg.paypal.live ? 'sandbox' : 'simulated',
    ai: cfg.llm.provider === 'none' ? 'structured' : 'live',
  }));

  app.get('/api/state', async (req, reply) => {
    const ctx = await resolveContext(req, reply);
    return service.state(ctx);
  });

  app.post('/api/workshop', async (req, reply) => {
    limit(req);
    requireCsrfHeader(req);
    const ctx = await resolveContext(req, reply);
    const body = parseBody(CreateWorkshopRequestSchema, req.body);
    return service.createWorkshop(ctx, body);
  });

  app.post('/api/preferences/parse', async (req, reply) => {
    limit(req);
    requireCsrfHeader(req);
    const ctx = await resolveContext(req, reply);
    const body = parseBody(ParsePreferencesRequestSchema, req.body);
    return service.parsePreferences(ctx, body);
  });

  app.post('/api/preferences/preview', async (req, reply) => {
    limit(req);
    requireCsrfHeader(req);
    const ctx = await resolveContext(req, reply);
    const body = parseBody(ParsePreferencesRequestSchema, req.body);
    return service.previewPreferences(ctx, body);
  });

  app.post('/api/preferences/revise', async (req, reply) => {
    limit(req);
    requireCsrfHeader(req);
    const ctx = await resolveContext(req, reply);
    const body = parseBody(RevisePreferencesRequestSchema, req.body);
    return service.revisePreferences(ctx, body);
  });

  app.post('/api/preferences/confirm', async (req, reply) => {
    limit(req);
    requireCsrfHeader(req);
    const ctx = await resolveContext(req, reply);
    const body = parseBody(ConfirmPreferencesRequestSchema, req.body);
    return service.confirmPreferences(ctx, body);
  });

  app.post('/api/plans/compute', async (req, reply) => {
    limit(req);
    requireCsrfHeader(req);
    const ctx = await resolveContext(req, reply);
    return service.state(ctx);
  });

  app.post('/api/clarifications/propose', async (req, reply) => {
    limit(req);
    requireCsrfHeader(req);
    const ctx = await resolveContext(req, reply);
    const participantId = typeof (req.body as Body)?.participantId === 'string' ? String((req.body as Body).participantId) : undefined;
    return service.proposeClarification(ctx, participantId);
  });

  app.post('/api/clarifications/:id/send', async (req, reply) => {
    limit(req);
    requireCsrfHeader(req);
    const ctx = await resolveContext(req, reply);
    return service.sendClarification(ctx, (req.params as { id: string }).id);
  });

  app.post('/api/clarifications/:id/answer', async (req, reply) => {
    limit(req);
    requireCsrfHeader(req);
    const ctx = await resolveContext(req, reply);
    const body = parseBody(AnswerClarificationRequestSchema, req.body);
    return service.answerClarification(ctx, (req.params as { id: string }).id, body.answer);
  });

  app.post('/api/offers/publish', async (req, reply) => {
    limit(req);
    requireCsrfHeader(req);
    const ctx = await resolveContext(req, reply);
    const body = parseBody(PublishOfferRequestSchema, req.body);
    return service.publishOffer(ctx, body.slotId);
  });

  app.post('/api/checkout/orders', async (req, reply) => {
    limit(req);
    requireCsrfHeader(req);
    const ctx = await resolveContext(req, reply);
    const body = parseBody(StartCheckoutRequestSchema, req.body);
    return service.startCheckout(ctx, { participantId: body.participantId, consent: (req.body as Body)?.consent === true });
  });

  app.post('/api/checkout/:orderId/complete', async (req, reply) => {
    limit(req);
    requireCsrfHeader(req);
    const ctx = await resolveContext(req, reply);
    return service.completeCheckout(ctx, (req.params as { orderId: string }).orderId);
  });

  app.post('/api/participants', async (req, reply) => {
    limit(req);
    requireCsrfHeader(req);
    const ctx = await resolveContext(req, reply);
    const name = typeof (req.body as Body)?.displayName === 'string' ? String((req.body as Body).displayName) : '';
    const result = service.addParticipant(ctx, name);
    return { ...result.state, inviteToken: result.token };
  });

  app.post('/api/participants/:id/withdraw', async (req, reply) => {
    limit(req);
    requireCsrfHeader(req);
    const ctx = await resolveContext(req, reply);
    return service.withdraw(ctx, (req.params as { id: string }).id);
  });

  app.post('/api/workshops/:id/settle', async (req, reply) => {
    limit(req);
    requireCsrfHeader(req);
    const ctx = await resolveContext(req, reply);
    return service.settle(ctx);
  });

  app.post('/api/paypal/webhook', async (req, reply) => {
    limit(req);
    const rawBody = (req as FastifyRequest & RequestExtras).rawBody ?? '';
    const result = await handleWebhook(
      { repo, paypal: service.paypal, now: () => service.now() },
      { headers: req.headers as Record<string, string | string[] | undefined>, rawBody },
    );
    return reply.status(result.status).send(result.body);
  });

  app.post('/api/demo/view', async (req, reply) => {
    limit(req);
    requireCsrfHeader(req);
    const ctx = await resolveContext(req, reply);
    const body = parseBody(DemoViewRequestSchema, req.body);
    if (!ctx.synthetic) throw new AppError('DEMO_ONLY', 'role switching is only available in the synthetic demo', 403);
    if (body.participantId) {
      const participant = repo.getParticipant(body.participantId);
      if (!participant || participant.tenantId !== ctx.tenantId) {
        throw new AppError('PARTICIPANT_NOT_FOUND', 'participant not found', 404);
      }
      repo.setSessionView(ctx.sessionHash, participant.id, service.now());
      return service.state({ ...ctx, viewParticipantId: participant.id });
    }
    repo.setSessionView(ctx.sessionHash, null, service.now());
    return service.state({ ...ctx, viewParticipantId: null });
  });

  app.post('/api/demo/reset', async (req, reply) => {
    limit(req);
    requireCsrfHeader(req);
    const ctx = await resolveContext(req, reply);
    if (!ctx.synthetic) throw new AppError('DEMO_ONLY', 'reset is only available in the synthetic demo', 403);
    const tenantId = service.newTenant(service.now());
    repo.bindSessionTenant(ctx.sessionHash, tenantId, service.now());
    repo.setSessionView(ctx.sessionHash, null, service.now());
    const next = service.ctxFor(tenantId, null, ctx.sessionHash);
    return service.createWorkshop(next, { sample: true });
  });

  /* ------------------------ PayPal return / cancel ---------------------- */

  app.get('/return', async (req, reply) => {
    const token = String((req.query as Record<string, unknown>)?.token ?? '');
    try {
      const ctx = await resolveContext(req, reply);
      if (!token) throw new AppError('MISSING_TOKEN', 'PayPal did not return an order id', 400);
      const state = await service.completeCheckout(ctx, token);
      const target = state.session.role === 'participant' ? '/participant/authorize?ok=1' : '/organizer/funding?ok=1';
      return reply.redirect(target, 302);
    } catch (err) {
      const code = err instanceof AppError ? err.code : 'CHECKOUT_RETURN_FAILED';
      return reply.redirect(`/participant/authorize?error=${encodeURIComponent(code)}`, 302);
    }
  });

  app.get('/cancel', async (_req, reply) => reply.redirect('/participant/authorize?cancelled=1', 302));

  /* ------------------------------- static ------------------------------- */

  app.get('/robots.txt', async (_req, reply) => {
    reply.type('text/plain').send('User-agent: *\nAllow: /\n');
  });

  const hasWeb = existsSync(path.join(cfg.webDist, 'index.html'));
  if (hasWeb) {
    // wildcard: true (default) so newly built hashed assets are served without a
    // restart; missing files fall through to the SPA fallback below.
    app.register(fastifyStatic, { root: cfg.webDist });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/') || req.url === '/healthz') {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'not found' } });
      }
      return reply.sendFile('index.html');
    });
  } else {
    app.get('/', async () => ({
      ok: true,
      note: 'GatherReady API is running. Build the UI with `npm run build` or run `npm run dev:web` on :5181.',
    }));
  }

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.status).send({ error: { code: err.code, message: err.message, fields: err.fields } });
    }
    if ((err as { statusCode?: number }).statusCode === 400) {
      return reply.status(400).send({ error: { code: 'INVALID_REQUEST', message: 'request could not be parsed' } });
    }
    console.error('[gatherready] unhandled error:', err instanceof Error ? err.message : String(err));
    return reply.status(500).send({ error: { code: 'INTERNAL', message: 'something went wrong' } });
  });

  return app;
}
