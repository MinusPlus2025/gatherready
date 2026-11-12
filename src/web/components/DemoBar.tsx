/* ==========================================================================
   Demo-only role switcher. Rendered only when `state.demo.canSwitchRoles`
   (synthetic tenants); real tenants never see it. Switching identity does not
   expose any other participant's private sentence — the server decides what a
   view may contain.
   ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { AppState } from '../../shared/api.js';
import { describeError } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { useApp } from '../lib/store.js';

const DEMO_ROUTES: Array<{ path: string; key: string }> = [
  { path: '/organizer/setup', key: 'demo.route.setup' },
  { path: '/participant/preferences', key: 'demo.route.preferences' },
  { path: '/organizer/plan', key: 'demo.route.plan' },
  { path: '/participant/clarify', key: 'demo.route.clarify' },
  { path: '/organizer/offer', key: 'demo.route.offer' },
  { path: '/participant/authorize', key: 'demo.route.authorize' },
  { path: '/organizer/funding', key: 'demo.route.funding' },
  { path: '/organizer/result', key: 'demo.route.result' },
];

function nextRouteFor(state: AppState): string {
  if (state.session.role === 'organizer') return '/organizer/plan';
  const me = state.session.viewParticipantId;
  if (!me) return '/participant/preferences';
  const openQuestion = state.clarifications.find(
    (c) => c.participantId === me && (c.status === 'SENT' || c.status === 'PROPOSED'),
  );
  if (openQuestion) return '/participant/clarify';
  if (state.offer?.isOpen && state.offer.viewerIncluded) return '/participant/authorize';
  return '/participant/preferences';
}

export function DemoBar({ state }: { state: AppState }) {
  const { t } = useI18n();
  const { act, mock } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screensOpen, setScreensOpen] = useState(false);
  const screensRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setScreensOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!screensOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!screensRef.current?.contains(event.target as Node)) setScreensOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setScreensOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [screensOpen]);
  const suffix = mock ? '?mock=1' : '';
  const current = state.session.viewParticipantId;

  async function switchView(participantId: string | null) {
    setBusy(participantId ?? 'organizer');
    setError(null);
    try {
      const next = await act({ type: 'demo.view', payload: { participantId } });
      navigate(nextRouteFor(next) + suffix);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(null);
    }
  }

  async function resetDemo() {
    setBusy('reset');
    setError(null);
    try {
      await act({ type: 'demo.reset' });
      navigate(`/organizer/setup${suffix}`);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="demo-bar" aria-label={t('demo.view')}>
      <div className="container demo-bar__inner">
        <div className="demo-bar__row">
          <span className="demo-bar__label" id="demo-view-label">
            {t('demo.view')}
          </span>
          <div className="demo-bar__buttons" role="group" aria-labelledby="demo-view-label">
            <button
              type="button"
              className={`chip-button${current === null ? ' chip-button--active' : ''}`}
              aria-pressed={current === null}
              disabled={busy !== null}
              onClick={() => void switchView(null)}
            >
              {t('demo.organizer')}
            </button>
            {state.participants.map((participant) => (
              <button
                key={participant.id}
                type="button"
                className={`chip-button${current === participant.id ? ' chip-button--active' : ''}`}
                aria-pressed={current === participant.id}
                disabled={busy !== null}
                onClick={() => void switchView(participant.id)}
              >
                {participant.displayName}
              </button>
            ))}
          </div>
          <div className="demo-bar__spacer" />
          <div className="demo-bar__tools">
            <div className="demo-bar__screens" ref={screensRef}>
              <button
                type="button"
                className="demo-bar__screens-toggle"
                aria-expanded={screensOpen}
                
                onClick={() => setScreensOpen((open) => !open)}
              >
                {t('demo.screens')}
              </button>
              {screensOpen ? (
                <>
                  <div className="demo-bar__screens-scrim" aria-hidden="true" onClick={() => setScreensOpen(false)} />
                  <ul className="demo-bar__screens-menu">
                    {DEMO_ROUTES.map((route) => (
                      <li key={route.path}>
                        <Link to={route.path + suffix} onClick={() => setScreensOpen(false)}>
                          {t(route.key)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
            <button type="button" className="btn btn-ghost btn--small" onClick={() => void resetDemo()} disabled={busy !== null}>
              {t('demo.reset')}
            </button>
          </div>
        </div>
        {error ? (
          <p className="demo-bar__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
