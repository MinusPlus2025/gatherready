/* ==========================================================================
   App state store.

   One snapshot (`AppState`) drives every screen. Actions are dispatched through
   `act()` so a page never has to know whether the real HTTP API or the dev-only
   `?mock=1` stand-in is answering.

   Polling is deliberately narrow: GET /api/state repeats every 4s only while a
   money state is in flight or right after the browser came back from PayPal.
   Completing a PayPal button is never treated as payment; the screen shows what
   the server says.
   ========================================================================== */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import type { AppState } from '../../shared/api.js';
import { api, describeError } from './api.js';
import type { WebAction } from './actions.js';
import { needsMoneyPolling } from './format.js';

const AWAITING_KEY = 'gr_awaiting_paypal';
const TOKEN_KEY = 'gr_ptoken';

interface AppContextValue {
  state: AppState | null;
  loading: boolean;
  loadError: string | null;
  /** Dev-only: the UI is running against the synthetic mock behind ?mock=1. */
  mock: boolean;
  /** When the snapshot arrived; countdowns add elapsed client time to state.nowUtc. */
  fetchedAtMs: number;
  token: string | null;
  refresh: (silent?: boolean) => Promise<void>;
  act: (action: WebAction) => Promise<AppState>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside <AppStateProvider>');
  return value;
}

/* --------------------------- route → mock scene -------------------------- */

type MockScene =
  | 'setup'
  | 'preferences'
  | 'plan'
  | 'clarify'
  | 'plan-ready'
  | 'plan-blocked'
  | 'offer'
  | 'returning'
  | 'authorized'
  | 'funding'
  | 'result-confirmed'
  | 'result-not';

function defaultSceneForPath(pathname: string): MockScene {
  if (pathname.startsWith('/organizer/setup')) return 'setup';
  if (pathname.startsWith('/participant/preferences')) return 'preferences';
  if (pathname.startsWith('/organizer/plan')) return 'plan';
  if (pathname.startsWith('/participant/clarify')) return 'clarify';
  if (pathname.startsWith('/organizer/offer')) return 'plan-ready';
  if (pathname.startsWith('/participant/authorize')) return 'offer';
  if (pathname.startsWith('/organizer/funding')) return 'funding';
  if (pathname.startsWith('/organizer/result')) return 'result-confirmed';
  if (pathname.startsWith('/p/')) return 'offer';
  return 'setup';
}

function defaultViewerForPath(pathname: string): string | null {
  return pathname.startsWith('/participant') || pathname.startsWith('/p/') ? 'p_diego' : null;
}

/* ------------------------------ token handling --------------------------- */

function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('ptoken');
  const match = /^\/p\/([A-Za-z0-9_-]+)/.exec(window.location.pathname);
  const fromPath = match?.[1] ?? null;
  const fromUrl = fromQuery ?? fromPath;
  try {
    if (fromUrl) {
      sessionStorage.setItem(TOKEN_KEY, fromUrl);
      return fromUrl;
    }
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return fromUrl;
  }
}

function isMockRequested(): boolean {
  if (!import.meta.env.DEV) return false;
  return new URLSearchParams(window.location.search).get('mock') === '1';
}

async function dispatchHttp(action: WebAction, token: string | null): Promise<AppState> {
  switch (action.type) {
    case 'workshop.create':
      return api.createWorkshop(action.payload, token);
    case 'preferences.parse':
      return api.parsePreferences(action.payload, token);
    case 'preferences.confirm':
      return api.confirmPreferences(action.payload, token);
    case 'preferences.revise':
      return api.revisePreferences(action.payload, token);
    case 'plans.compute':
      return api.computePlan(token);
    case 'clarifications.propose':
      return api.proposeClarification(action.participantId, token);
    case 'clarifications.send':
      return api.sendClarification(action.id, token);
    case 'clarifications.answer':
      return api.answerClarification(action.id, action.payload, token);
    case 'offers.publish':
      return api.publishOffer(action.payload, token);
    case 'checkout.start':
      return api.startCheckout(action.payload, token);
    case 'checkout.complete':
      return api.completeCheckout(action.orderId, token);
    case 'participants.withdraw':
      return api.withdrawParticipant(action.id, token);
    case 'workshops.settle':
      return api.settleWorkshop(action.id, token);
    case 'demo.view':
      return api.demoView(action.payload, token);
    case 'demo.reset':
      return api.demoReset(token);
  }
}

/* -------------------------------- provider ------------------------------- */

export function AppStateProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fetchedAtMs, setFetchedAtMs] = useState(() => Date.now());
  const token = useMemo(() => readToken(), [location.pathname, location.search]);
  const mock = useMemo(() => isMockRequested(), []);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const stateRef = useRef<AppState | null>(null);
  const epochRef = useRef(0);
  const fetchedAtRef = useRef(fetchedAtMs);
  const mockViewerRef = useRef<string | null | undefined>(undefined);
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  stateRef.current = state;

  const load = useCallback(
    async (silent = false) => {
      const epoch = epochRef.current;
      if (!silent) setLoading(true);
      setLoadError(null);
      try {
        let next: AppState;
        if (import.meta.env.DEV && mock) {
          const params = new URLSearchParams(window.location.search);
          const isParticipantPath =
            pathRef.current.startsWith('/participant') || pathRef.current.startsWith('/p/');
          const viewer = isParticipantPath
            ? params.get('view') ?? mockViewerRef.current ?? defaultViewerForPath(pathRef.current)
            : null;
          const { loadMockState } = await import('./mockState.js');
          next = loadMockState(params.get('scene') ?? defaultSceneForPath(pathRef.current), viewer);
          mockViewerRef.current = next.session.viewParticipantId;
        } else {
          next = await api.getState(tokenRef.current);
        }
        if (epoch !== epochRef.current) return; // a role change won the race
        fetchedAtRef.current = Date.now();
        setFetchedAtMs(fetchedAtRef.current);
        setState(next);
      } catch (error) {
        if (epoch === epochRef.current) setLoadError(describeError(error));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [mock],
  );

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  // Reload on route change: the mock picks the scene that makes each screen
  // meaningful; a real session just re-reads the one snapshot.
  useEffect(() => {
    void loadRef.current();
  }, [location.pathname, mock]);

  // Narrow polling: only while money is moving or right after PayPal.
  useEffect(() => {
    if (!state || mock) return;
    if (!needsMoneyPolling(state)) return;
    const id = window.setInterval(() => {
      void loadRef.current(true);
    }, 4000);
    return () => window.clearInterval(id);
  }, [state, mock]);

  // Coming back to the tab is a good moment to re-read an in-flight state.
  useEffect(() => {
    if (mock) return;
    const onFocus = () => {
      const current = stateRef.current;
      if (current && needsMoneyPolling(current)) void loadRef.current(true);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [mock]);

  // Drop the "returned from PayPal" marker once the server reports a settled row.
  useEffect(() => {
    if (!state) return;
    let flag: string | null = null;
    try {
      flag = sessionStorage.getItem(AWAITING_KEY);
    } catch {
      flag = null;
    }
    if (!flag) return;
    const mine = state.payments.find((p) => p.isMine);
    const settled =
      mine && !['NONE', 'ORDER_CREATED', 'APPROVED', 'AUTHORIZING', 'CAPTURING'].includes(mine.status);
    if (settled) {
      try {
        sessionStorage.removeItem(AWAITING_KEY);
      } catch {
        /* ignore */
      }
    }
  }, [state]);

  const act = useCallback(
    async (action: WebAction): Promise<AppState> => {
      const identityChange = action.type === 'demo.view' || action.type === 'demo.reset';
      if (identityChange) {
        // Never paint the previous identity while the server is switching:
        // drop the snapshot and invalidate any in-flight read/response.
        epochRef.current += 1;
        stateRef.current = null;
        setState(null);
        setLoading(true);
      }
      try {
        let next: AppState;
        if (import.meta.env.DEV && mock) {
          const { applyMockAction } = await import('./mockState.js');
          next = applyMockAction(action);
          mockViewerRef.current = next.session.viewParticipantId;
        } else {
          next = await dispatchHttp(action, tokenRef.current);
        }
        fetchedAtRef.current = Date.now();
        setFetchedAtMs(fetchedAtRef.current);
        setState(next);
        if (import.meta.env.DEV && mock && action.type === 'checkout.start' && next.checkout) {
          // Dev mock only: stand in for the PayPal redirect + server-side completion.
          const orderId = next.checkout.orderId;
          window.setTimeout(() => {
            void (async () => {
              const { applyMockAction } = await import('./mockState.js');
              setState(applyMockAction({ type: 'checkout.complete', orderId }));
            })();
          }, 1600);
        }
        return next;
      } finally {
        if (identityChange) setLoading(false);
      }
    },
    [mock],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      loading,
      loadError,
      mock,
      fetchedAtMs,
      token,
      refresh: (silent = false) => load(silent),
      act,
    }),
    [state, loading, loadError, mock, fetchedAtMs, token, load, act],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/**
 * Mark that the browser is leaving for the PayPal approval page. The authorize
 * screen calls this immediately before navigating; the next state read shows
 * "Checking with PayPal" until the server reports something settled.
 */
export function markAwaitingPaypal(): void {
  try {
    sessionStorage.setItem(AWAITING_KEY, '1');
  } catch {
    /* storage disabled — polling still keys off the payment status */
  }
}
