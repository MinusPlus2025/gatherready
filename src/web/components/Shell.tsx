/* ==========================================================================
   Application shell: skip link, brand, always-visible sandbox chips, the UTC
   deadline countdown, the mode banner, the demo-only role switcher, the main
   content and the footer.

   "Sandbox · No real money" is part of the shell, so it is present on every
   screen, including before any participant has authorized anything.
   ========================================================================== */

import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import { useApp } from '../lib/store';
import { DemoBar } from './DemoBar';
import { LanguageSwitch } from './LanguageSwitch';
import { ThemeSwitch } from './ThemeSwitch';
import { BrandMark } from './Logo';
import { Countdown, InlineNotice, StatusBadge } from './ui';

const ROUTE_TITLES: Array<{ prefix: string; key: string }> = [
  { prefix: '/organizer/setup', key: 'doc.setup' },
  { prefix: '/organizer/plan', key: 'doc.plan' },
  { prefix: '/organizer/offer', key: 'doc.offer' },
  { prefix: '/organizer/funding', key: 'doc.funding' },
  { prefix: '/organizer/result', key: 'doc.result' },
  { prefix: '/participant/preferences', key: 'doc.preferences' },
  { prefix: '/participant/clarify', key: 'doc.clarify' },
  { prefix: '/participant/authorize', key: 'doc.authorize' },
  { prefix: '/p/', key: 'doc.invitation' },
];

function useDocumentTitle(): void {
  const location = useLocation();
  const { t } = useI18n();
  useEffect(() => {
    const match = ROUTE_TITLES.find((route) => location.pathname.startsWith(route.prefix));
    document.title = match ? `${t(match.key)} · GatherReady` : t('doc.default');
  }, [location.pathname, t]);
}

export function Shell() {
  const { t } = useI18n();
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
      ? t('shell.role.participant', {
          name: state.participants.find((p) => p.id === state.session.viewParticipantId)?.displayName ?? 'a participant',
        })
      : t('shell.role.organizer');

  if (!state) {
    return (
      <div className="app-shell">
        <a className="skip-link" href="#main">
          {t('shell.skip')}
        </a>
        <main id="main" className="boot" tabIndex={-1} aria-busy={loading} aria-live="polite">
          <span className="boot__mark">
            <BrandMark size={48} />
          </span>
          <p className="boot__name">GatherReady</p>
          <p className="boot__text">
            {loading ? t('shell.boot.loading') : loadError ? t('shell.boot.failed') : t('shell.boot.loadingShort')}
          </p>
          {loadError ? (
            <button type="button" className="btn btn-secondary" onClick={() => void refresh()}>
              {t('shell.boot.retry')}
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
              <span className="brand__tagline">{t('shell.tagline')}</span>
            </span>
          </Link>
          <div className="topbar__meta">
            {state.mode.paypal === 'simulated' ? (
              <span className="chip chip--sim">{t('shell.mode.simulated')}</span>
            ) : (
              <span className="chip chip--sandbox">{t('shell.mode.sandbox')}</span>
            )}
            <span className="chip chip--role">{roleLabel}</span>
            <ThemeSwitch />
            <LanguageSwitch />
          </div>
        </div>

        {state?.workshop && showCountdown ? (
          <div className="container context-row">
            <div className="context-row__workshop">
              <StatusBadge
                tone={state.workshop.status === 'OFFER_OPEN' ? 'success' : 'info'}
                word={
                  state.workshop.status === 'OFFER_OPEN'
                    ? t('shell.context.offerOpen')
                    : state.workshop.status === 'CLARIFYING'
                      ? t('shell.context.clarifying')
                      : t('shell.context.collecting')
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
                  {t('shell.myAuthorization')} <strong>{t(`pay.status.${myPayment.status}`)}</strong>
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </header>

      {state?.notice ? (
        <div className="container">
          <InlineNotice kind={state.notice.kind === 'warn' ? 'warn' : state.notice.kind === 'error' ? 'error' : 'info'}>
            {state.notice.message}
          </InlineNotice>
        </div>
      ) : null}

      {state?.demo.canSwitchRoles ? (
        <details className="demo-controls">
          <summary>{t('demo.controls')}<span className="demo-controls__chev" aria-hidden="true">▾</span></summary>
          <DemoBar state={state} />
        </details>
      ) : null}

      <main id="main" className="container main" tabIndex={-1}>
        {state && loadError ? (
          <InlineNotice kind="warn" title={t('shell.refreshFailed')}>
            {loadError}{' '}
            <button type="button" className="link-button" onClick={() => void refresh()}>
              {t('shell.retryNow')}
            </button>
          </InlineNotice>
        ) : null}
        <div className="route-enter" key={location.pathname}>
          <Outlet />
        </div>
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <div>
            <p className="footer__title">GatherReady</p>
            <p className="footer__text">{t('shell.footer.text')}</p>
            <p className="footer__credit">{t('shell.footer.credit')}</p>
            <p className="footer__credit">{t('shell.footer.languageNote')}</p>
            <p className="footer__credit">
              {t('shell.extraction.prefix')}{' '}
              {state.mode.ai === 'live'
                ? `${t('shell.extraction.live')}${state.mode.llmModel ? ` · ${state.mode.llmModel}` : ''}`
                : state.mode.ai === 'recorded'
                  ? t('shell.extraction.recorded')
                  : t('shell.extraction.structured')}
            </p>
          </div>
          <nav className="footer__nav" aria-label={t('shell.footer.navLabel')}>
            {state.session.role === 'participant' ? (
              <>
                <NavLink to="/participant/preferences">{t('shell.nav.preferences')}</NavLink>
                <NavLink to="/participant/authorize">{t('flow.authorize.title')}</NavLink>
              </>
            ) : (
              <>
                <NavLink to="/organizer/setup">{t('shell.nav.setup')}</NavLink>
                <NavLink to="/organizer/plan">{t('shell.nav.plan')}</NavLink>
                <NavLink to="/organizer/funding">{t('shell.nav.funding')}</NavLink>
              </>
            )}
          </nav>
        </div>
      </footer>
    </div>
  );
}
