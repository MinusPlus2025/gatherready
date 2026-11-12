/* ==========================================================================
   Application shell: skip link, brand, always-visible sandbox chips, the UTC
   deadline countdown, the mode banner, the demo-only role switcher, the main
   content and the footer.

   "Sandbox · No real money" is part of the shell, so it is present on every
   screen, including before any participant has authorized anything.
   ========================================================================== */

import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { paymentStatusWord } from '../lib/format';
import { useApp } from '../lib/store';
import { DemoBar } from './DemoBar';
import { BrandMark } from './Logo';
import { Countdown, InlineNotice, StatusBadge } from './ui';

const ROUTE_TITLES: Array<{ prefix: string; title: string }> = [
  { prefix: '/organizer/setup', title: 'Set up a workshop' },
  { prefix: '/organizer/plan', title: 'The plan' },
  { prefix: '/organizer/offer', title: 'Offer' },
  { prefix: '/organizer/funding', title: 'Funding' },
  { prefix: '/organizer/result', title: 'Result' },
  { prefix: '/participant/preferences', title: 'Your preferences' },
  { prefix: '/participant/clarify', title: 'Your question' },
  { prefix: '/participant/authorize', title: 'Review and authorize' },
  { prefix: '/p/', title: 'Your invitation' },
];

function useDocumentTitle(): void {
  const location = useLocation();
  useEffect(() => {
    const match = ROUTE_TITLES.find((route) => location.pathname.startsWith(route.prefix));
    document.title = match ? `${match.title} · GatherReady` : 'GatherReady — a plan everyone agrees to';
  }, [location.pathname]);
}

export function Shell() {
  const { state, loading, loadError, refresh, fetchedAtMs } = useApp();
  const location = useLocation();
  useDocumentTitle();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  const showCountdown =
    state?.workshop &&
    ['COLLECTING_INTEREST', 'CLARIFYING', 'OFFER_OPEN', 'SETTLING'].includes(state.workshop.status);

  const myPayment = state?.payments.find((payment) => payment.isMine) ?? null;
  const roleLabel = !state
    ? ''
    : state.session.role === 'participant'
      ? `You are ${state.participants.find((p) => p.id === state.session.viewParticipantId)?.displayName ?? 'a participant'} — participant`
      : 'You are the organizer';

  if (!state) {
    return (
      <div className="app-shell">
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        <main id="main" className="boot" tabIndex={-1} aria-busy={loading} aria-live="polite">
          <span className="boot__mark">
            <BrandMark size={48} />
          </span>
          <p className="boot__name">GatherReady</p>
          <p className="boot__text">
            {loading ? 'Loading the workshop…' : loadError ? 'The server did not answer.' : 'Loading…'}
          </p>
          {loadError ? (
            <button type="button" className="btn btn-secondary" onClick={() => void refresh()}>
              Try again
            </button>
          ) : null}
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>

      <header className="topbar">
        <div className="container topbar__inner">
          <Link to="/" className="brand">
            <span className="brand__mark" aria-hidden="true">
              <BrandMark size={38} />
            </span>
            <span className="brand__text">
              <span className="brand__name">GatherReady</span>
              <span className="brand__tagline">A plan everyone agrees to, funded only when it is real</span>
            </span>
          </Link>
          <div className="topbar__meta">
            <span className="chip chip--sandbox">Sandbox · No real money</span>
            {state.mode.paypal === 'simulated' ? (
              <span className="chip chip--sim">Simulated PayPal — no real money</span>
            ) : null}
            <span className="chip chip--role">{roleLabel}</span>
          </div>
        </div>

        {state?.workshop && showCountdown ? (
          <div className="container context-row">
            <div className="context-row__workshop">
              <StatusBadge
                tone={state.workshop.status === 'OFFER_OPEN' ? 'success' : 'info'}
                word={
                  state.workshop.status === 'OFFER_OPEN'
                    ? 'Offer open'
                    : state.workshop.status === 'CLARIFYING'
                      ? 'Clarifying conditions'
                      : 'Collecting interest'
                }
              />
              <span className="context-row__title">{state.workshop.title}</span>
              <span className="context-row__sep" aria-hidden="true">
                ·
              </span>
              <span className="context-row__venue">{state.workshop.merchantName}</span>
            </div>
            <div className="context-row__deadline">
              <Countdown
                deadlineUtc={state.workshop.authDeadlineUtc}
                serverNowUtc={state.nowUtc}
                fetchedAtMs={fetchedAtMs}
              />
              {myPayment && myPayment.status !== 'NONE' ? (
                <span className="context-row__payment">
                  Your authorization: <strong>{paymentStatusWord[myPayment.status]}</strong>
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </header>

      {state?.mode.banner ? (
        <div className="mode-banner">
          <div className="container mode-banner__inner">
            <span className="mode-banner__text">{state.mode.banner}</span>
            <span className="mode-banner__modes">
              Payments: {state.mode.paypal === 'sandbox' ? 'PayPal sandbox' : 'Simulated PayPal'} · Extraction:{' '}
              {state.mode.ai === 'live' ? 'live model' : state.mode.ai === 'recorded' ? 'recorded sample' : 'structured (no AI)'}
            </span>
          </div>
        </div>
      ) : null}

      {state?.notice ? (
        <div className="container">
          <InlineNotice kind={state.notice.kind === 'warn' ? 'warn' : state.notice.kind === 'error' ? 'error' : 'info'}>
            {state.notice.message}
          </InlineNotice>
        </div>
      ) : null}

      {state?.demo.canSwitchRoles ? <DemoBar state={state} /> : null}

      <main id="main" className="container main" tabIndex={-1}>
        {state && loadError ? (
          <InlineNotice kind="warn" title="We could not refresh">
            {loadError}{' '}
            <button type="button" className="link-button" onClick={() => void refresh()}>
              Retry now
            </button>
          </InlineNotice>
        ) : null}
        <Outlet />
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <div>
            <p className="footer__title">GatherReady</p>
            <p className="footer__text">
              PayPal AI Hackathon sandbox prototype. Payments run against the PayPal sandbox or the
              clearly labelled simulated adapter. No real money moves.
            </p>
            <p className="footer__credit">
              Photographs: CC0 / public domain via Openverse (Rawpixel, StockSnap). Synthetic demo context, not
              the organiser's premises or participants.
            </p>
          </div>
          <nav className="footer__nav" aria-label="Demo screens">
            <NavLink to="/organizer/setup">Organizer setup</NavLink>
            <NavLink to="/participant/preferences">Participant preferences</NavLink>
            <NavLink to="/organizer/plan">Plan</NavLink>
            <NavLink to="/organizer/funding">Funding</NavLink>
          </nav>
        </div>
      </footer>
    </div>
  );
}
