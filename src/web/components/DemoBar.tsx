/* ==========================================================================
   Demo-only role switcher. Rendered only when `state.demo.canSwitchRoles`
   (synthetic tenants); real tenants never see it. Switching identity does not
   expose any other participant's private sentence — the server decides what a
   view may contain.
   ========================================================================== */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { AppState } from '../../shared/api.js';
import { describeError } from '../lib/api.js';
import { useApp } from '../lib/store.js';

const DEMO_ROUTES: Array<{ path: string; label: string }> = [
  { path: '/organizer/setup', label: 'Organizer setup' },
  { path: '/participant/preferences', label: 'Participant preferences' },
  { path: '/organizer/plan', label: 'Organizer plan' },
  { path: '/participant/clarify', label: 'Participant clarify' },
  { path: '/organizer/offer', label: 'Organizer offer' },
  { path: '/participant/authorize', label: 'Participant authorize' },
  { path: '/organizer/funding', label: 'Organizer funding' },
  { path: '/organizer/result', label: 'Organizer result' },
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
  const { act, mock } = useApp();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    <section className="demo-bar" aria-label="Demo view switcher">
      <div className="container demo-bar__inner">
        <div className="demo-bar__row">
          <span className="demo-bar__label" id="demo-view-label">
            Demo view
          </span>
          <div className="demo-bar__buttons" role="group" aria-labelledby="demo-view-label">
            <button
              type="button"
              className={`chip-button${current === null ? ' chip-button--active' : ''}`}
              aria-pressed={current === null}
              disabled={busy !== null}
              onClick={() => void switchView(null)}
            >
              Organizer
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
          <details className="demo-bar__screens">
            <summary>Screens</summary>
            <ul>
              {DEMO_ROUTES.map((route) => (
                <li key={route.path}>
                  <Link to={route.path + suffix}>{route.label}</Link>
                </li>
              ))}
            </ul>
          </details>
          <button type="button" className="btn btn-ghost btn--small" onClick={() => void resetDemo()} disabled={busy !== null}>
            Reset demo
          </button>
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
