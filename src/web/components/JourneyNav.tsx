import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../lib/store';
import { useI18n } from '../lib/i18n';

/** Location, not a claim of completion. Links never change roles or money state. */
export function JourneyNav() {
  const { state } = useApp();
  const { t } = useI18n();
  const { pathname } = useLocation();
  if (!state || pathname === '/' || pathname.startsWith('/p/')) return null;
  const organizer = state.session.role === 'organizer';
  const steps = organizer ? [
    ['organizer/setup', 'doc.setup', true],
    ['organizer/plan', 'doc.plan', Boolean(state.workshop)],
    ['organizer/offer', 'doc.offer', Boolean(state.offer)],
    ['organizer/funding', 'doc.funding', Boolean(state.offer)],
    ['organizer/result', 'doc.result', Boolean(state.result)],
  ] as const : [
    ['participant/preferences', 'doc.preferences', true],
    ['participant/authorize', 'doc.authorize', Boolean(state.offer)],
  ] as const;
  return <nav className="journey-nav" aria-label={t('shell.footer.navLabel')}>
    <ol>{steps.map(([path, label, enabled], index) => {
      const current = pathname === `/${path}` || (!organizer && index === 0 && pathname.endsWith('/clarify'));
      const content = <><span className="journey-nav__number" aria-hidden="true">{index + 1}</span><span>{t(label)}</span></>;
      return <li key={path} className={current ? 'is-current' : ''}>
        {enabled || current ? <Link to={`/${path}`} aria-current={current ? 'page' : undefined}>{content}</Link> : <span className="journey-nav__unavailable" aria-disabled="true">{content}</span>}
      </li>;
    })}</ol>
  </nav>;
}
