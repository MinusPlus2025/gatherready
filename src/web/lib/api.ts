/* ==========================================================================
   Typed HTTP client for the frozen contract (docs/CONTRACT.md §4).

   Every mutating call returns the whole `AppState`; the UI never patches state
   from a response fragment. Errors arrive as `{ error: { code, message,
   fields? } }` and are lifted into `ApiError` so a screen can render a readable
   message plus per-field errors.

   Participant links carry an opaque token. It is sent as `?ptoken=` on the
   first state read (this is what binds the cookie) and as `X-Participant-Token`
   on every request so a second tab or a refresh keeps the same identity.
   ========================================================================== */

import type {
  AnswerClarificationRequest,
  AppState,
  ConfirmPreferencesRequest,
  CreateWorkshopRequest,
  DemoViewRequest,
  ParsePreferencesRequest,
  PreviewPreferenceResponse,
  PublishOfferRequest,
  RevisePreferencesRequest,
  StartCheckoutRequest,
} from '../../shared/api.js';

const BASE = '/api';
const TOKEN_HEADER = 'X-Participant-Token';

export interface ApiFieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields: ApiFieldError[];

  constructor(message: string, options: { code?: string; status?: number; fields?: ApiFieldError[] } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = options.code ?? 'ERROR';
    this.status = options.status ?? 0;
    this.fields = options.fields ?? [];
  }
}

/** A readable message for any thrown value. Never invents a success shape. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Nothing was saved — please try again.';
}

export function apiFieldErrors(error: unknown): ApiFieldError[] {
  return error instanceof ApiError ? error.fields : [];
}

function isErrorBody(value: unknown): value is {
  error: { code?: unknown; message?: unknown; fields?: unknown };
} {
  return typeof value === 'object' && value !== null && 'error' in value;
}

function toFieldErrors(value: unknown): ApiFieldError[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): ApiFieldError[] => {
    if (typeof item !== 'object' || item === null) return [];
    const field = (item as { field?: unknown }).field;
    const message = (item as { message?: unknown }).message;
    if (typeof field !== 'string' || typeof message !== 'string') return [];
    return [{ field, message }];
  });
}

async function request<T>(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown; token?: string | null } = {},
): Promise<T> {
  // The server requires this custom header on every request (CSRF defence: a
  // cross-site form post cannot set it). Without it every mutation is rejected.
  const headers: Record<string, string> = { Accept: 'application/json', 'x-gatherready': '1' };
  const token = init.token ?? null;
  if (token) headers[TOKEN_HEADER] = token;
  let body: string | undefined;
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.body);
  }

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('Cannot reach the GatherReady server. Check that it is running, then retry.', {
      code: 'NETWORK',
    });
  }

  let payload: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const message =
      isErrorBody(payload) && typeof payload.error.message === 'string'
        ? payload.error.message
        : `The server answered ${response.status}. Nothing was saved — please retry.`;
    const code =
      isErrorBody(payload) && typeof payload.error.code === 'string' ? payload.error.code : 'HTTP_ERROR';
    const fields = isErrorBody(payload) ? toFieldErrors(payload.error.fields) : [];
    throw new ApiError(message, { code, status: response.status, fields });
  }

  return payload as T;
}

function post(path: string, body: unknown, token: string | null): Promise<AppState> {
  return request<AppState>(path, { method: 'POST', body, token });
}

export const api = {
  /** GET /api/state — the one polling endpoint. */
  getState(token: string | null = null): Promise<AppState> {
    const query = token ? `?ptoken=${encodeURIComponent(token)}` : '';
    return request<AppState>(`/state${query}`, { token });
  },

  addParticipant(displayName: string) {
    return request<AppState & { inviteToken: string }>('/participants', { method: 'POST', body: { displayName } });
  },
  createWorkshop(body: CreateWorkshopRequest, token: string | null = null) {
    return post('/workshop', body, token);
  },
  parsePreferences(body: ParsePreferencesRequest, token: string | null = null) {
    return post('/preferences/parse', body, token);
  },
  confirmPreferences(body: ConfirmPreferencesRequest, token: string | null = null) {
    return post('/preferences/confirm', body, token);
  },
  previewPreferences(body: ParsePreferencesRequest, token: string | null = null) {
    return request<PreviewPreferenceResponse>('/preferences/preview', { method: 'POST', body, token });
  },
  revisePreferences(body: RevisePreferencesRequest, token: string | null = null) {
    return post('/preferences/revise', body, token);
  },
  computePlan(token: string | null = null) {
    return post('/plans/compute', {}, token);
  },
  proposeClarification(participantId: string | undefined, token: string | null = null) {
    return post('/clarifications/propose', participantId ? { participantId } : {}, token);
  },
  sendClarification(id: string, token: string | null = null) {
    return post(`/clarifications/${encodeURIComponent(id)}/send`, {}, token);
  },
  answerClarification(id: string, body: AnswerClarificationRequest, token: string | null = null) {
    return post(`/clarifications/${encodeURIComponent(id)}/answer`, body, token);
  },
  publishOffer(body: PublishOfferRequest, token: string | null = null) {
    return post('/offers/publish', body, token);
  },
  startCheckout(body: StartCheckoutRequest, token: string | null = null) {
    return post('/checkout/orders', body, token);
  },
  completeCheckout(orderId: string, token: string | null = null) {
    return post(`/checkout/${encodeURIComponent(orderId)}/complete`, {}, token);
  },
  withdrawParticipant(id: string, token: string | null = null) {
    return post(`/participants/${encodeURIComponent(id)}/withdraw`, {}, token);
  },
  reconcileWorkshop(id: string, token: string | null = null) {
    return post(`/workshops/${encodeURIComponent(id)}/reconcile`, {}, token);
  },
  settleWorkshop(id: string, token: string | null = null) {
    return post(`/workshops/${encodeURIComponent(id)}/settle`, {}, token);
  },
  demoView(body: DemoViewRequest, token: string | null = null) {
    return post('/demo/view', body, token);
  },
  demoReset(token: string | null = null) {
    return post('/demo/reset', {}, token);
  },

  // POST /api/paypal/webhook is deliberately absent: it is a server-to-server
  // endpoint signed with the webhook id, never called from a browser.
};
