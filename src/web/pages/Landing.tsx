/* ==========================================================================
   Landing. One job: say what the product does, for whom, and show the product
   itself as live HTML — the three separate counts and the one question that
   closes the gap. Everything below the fold is the real loop, then an explicit
   "what this prototype does not do".

   The preview frame is drawn from the same numbers the demo produces (3→4), so
   a reader can compare it with the running app without a screenshot.
   ========================================================================== */

import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  BotOff,
  Check,
  Fingerprint,
  HelpCircle,
  MessagesSquare,
  ShieldCheck,
  X,
} from 'lucide-react';
import { formatCents } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useApp } from '../lib/store';
import { StatusBadge } from '../components/ui';

const FOUR_STATES = ['interested', 'fits', 'authorized', 'captured'] as const;

const HOW_STEPS = [
  { icon: MessagesSquare, key: 'step1' },
  { icon: HelpCircle, key: 'step2' },
  { icon: BadgeCheck, key: 'step3' },
] as const;

export default function Landing() {
  const { t } = useI18n();
  const { state } = useApp();
  const workshop = state?.workshop ?? null;

  return (
    <div className="landing">
      <section className="hero hero--photo" aria-labelledby="hero-title">
        <div className="hero__copy">
          <p className="eyebrow">{t('landing.eyebrow')}</p>
          <h1 id="hero-title">{t('landing.hero.title')}</h1>
          <p className="hero__lede">{t('landing.hero.lede')}</p>
          <div className="hero__actions">
            <Link className="btn btn-primary" to="/organizer/setup">
              {t('landing.cta.setup')}
            </Link>
            <Link className="btn btn-secondary" to="/participant/preferences">
              {t('landing.cta.participant')}
            </Link>
          </div>
          <ul className="hero__meta">
            <li>
              <ShieldCheck size={15} strokeWidth={2} aria-hidden="true" /> {t('landing.meta.sandbox')}
            </li>
            <li>
              <Fingerprint size={15} strokeWidth={2} aria-hidden="true" /> {t('landing.meta.offer')}
            </li>
            <li>
              <BotOff size={15} strokeWidth={2} aria-hidden="true" /> {t('landing.meta.ai')}
            </li>
          </ul>
        </div>

        <div className="hero__media">
          <figure className="hero__figure">
            <img
              src="/images/pottery-hands.jpg"
              alt={t('landing.photo.altHands')}
              width={1600}
              height={968}
              fetchPriority="high"
            />
          </figure>
          <aside
            className="app-frame app-frame--overlap"
            aria-label={t('landing.frame.aria')}
          >
          <div className="app-frame__chrome">
            <span className="app-frame__dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="app-frame__title">{t('landing.frame.title')}</span>
          </div>
          <div className="app-frame__counts">
            <div>
              <span className="app-frame__num">6</span>
              <span className="app-frame__lbl">{t('landing.frame.interested')}</span>
            </div>
            <div>
              <span className="app-frame__num">3</span>
              <span className="app-frame__lbl">{t('landing.frame.fits')}</span>
            </div>
            <div>
              <span className="app-frame__num">0</span>
              <span className="app-frame__lbl">{t('landing.frame.authorized')}</span>
            </div>
          </div>
          <div className="app-frame__times" aria-hidden="true">
            <div className="app-frame__time">
              <span>{t('landing.frame.slot1')}</span>
              <span className="app-frame__time-meta">{t('landing.frame.slot1meta')}</span>
            </div>
            <div className="app-frame__time">
              <span>{t('landing.frame.slot2')}</span>
              <span className="app-frame__time-meta">{t('landing.frame.slot2meta')}</span>
            </div>
            <div className="app-frame__time">
              <span>{t('landing.frame.slot3')}</span>
              <span className="app-frame__time-meta">{t('landing.frame.slot3meta')}</span>
            </div>
          </div>
          <div className="app-frame__question">
            <span className="app-frame__kicker">{t('landing.frame.suggested')}</span>
            <p>{t('landing.frame.question')}</p>
            <div className="app-frame__question-pair">
              <span>{t('landing.frame.condition')}</span>
              <span>
                {t('landing.frame.gap')} <strong>3 → 4</strong>
              </span>
            </div>
          </div>
          <div className="app-frame__foot">
            <Fingerprint size={14} strokeWidth={2} aria-hidden="true" />
            {t('landing.frame.foot')}
          </div>
          </aside>
        </div>
      </section>

      <section className="state-strip" aria-label={t('landing.states.aria')}>
        {FOUR_STATES.map((key) => (
          <div className="state-strip__item" key={key}>
            <p className="state-strip__label">
              <i aria-hidden="true" />
              {t(`landing.states.${key}`)}
            </p>
            <p>{t(`landing.states.${key}Detail`)}</p>
          </div>
        ))}
      </section>

      <section className="photo-band" aria-label={t('landing.photo.altWorkshop')}>
        <figure>
          <img
            src="/images/pottery-workshop.jpg"
            alt={t('landing.photo.altWorkshop')}
            width={1600}
            height={1200}
            loading="lazy"
          />
        </figure>
        <figure>
          <img
            src="/images/pottery-studio.jpg"
            alt={t('landing.photo.altStudio')}
            width={1600}
            height={1067}
            loading="lazy"
          />
        </figure>
      </section>

      {workshop ? (
        <section className="panel panel--summary" aria-labelledby="current-workshop">
          <div className="panel__head">
            <div>
              <p className="eyebrow">{t('landing.current.eyebrow')}</p>
              <h2 id="current-workshop">{workshop.title}</h2>
              <p className="muted">
                {workshop.merchantName} · {t('landing.current.candidateTimes', { count: workshop.slots.length })} ·{' '}
                {formatCents(workshop.priceCents)} {t('landing.current.perPerson')}
              </p>
            </div>
            <StatusBadge
              tone={workshop.status === 'CONFIRMED' ? 'success' : workshop.status === 'CANCELLED' ? 'neutral' : 'info'}
              word={
                workshop.status === 'CONFIRMED'
                  ? t('landing.current.statusConfirmed')
                  : workshop.status === 'CANCELLED'
                    ? t('landing.current.statusCancelled')
                    : workshop.status === 'OFFER_OPEN'
                      ? t('landing.current.statusOfferOpen')
                      : t('landing.current.statusCollecting')
              }
            />
          </div>
          <div className="landing__links">
            <Link className="btn btn-primary" to="/organizer/plan">
              {t('landing.current.openPlan')}
            </Link>
            <Link className="btn btn-secondary" to="/participant/preferences">
              {t('landing.current.openParticipant')}
            </Link>
            {workshop.status === 'CONFIRMED' || workshop.status === 'CANCELLED' ? (
              <Link className="btn btn-ghost" to="/organizer/result">
                {t('landing.current.seeResult')}
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="how" aria-labelledby="how-it-works">
        <h2 id="how-it-works">{t('landing.how.title')}</h2>
        <p className="how__intro">{t('landing.how.intro')}</p>
        <ol className="how__list">
          {HOW_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <li className="how__step" key={step.key}>
                <span className="how__icon" aria-hidden="true">
                  <Icon size={20} strokeWidth={2} />
                </span>
                <h3>{t(`landing.how.${step.key}.title`)}</h3>
                <p>{t(`landing.how.${step.key}.body`)}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="panel honest honest--split" aria-labelledby="limits">
        <div className="honest__col honest__col--does">
          <h2 id="limits">{t('landing.honest.doesTitle')}</h2>
          <ul className="honest__list">
            <li>
              <Check size={15} strokeWidth={2.4} aria-hidden="true" /> {t('landing.honest.does1')}
            </li>
            <li>
              <Check size={15} strokeWidth={2.4} aria-hidden="true" /> {t('landing.honest.does2')}
            </li>
            <li>
              <Check size={15} strokeWidth={2.4} aria-hidden="true" /> {t('landing.honest.does3')}
            </li>
            <li>
              <Check size={15} strokeWidth={2.4} aria-hidden="true" /> {t('landing.honest.does4')}
            </li>
          </ul>
        </div>
        <div className="honest__col honest__col--doesnt">
          <h2>{t('landing.honest.doesntTitle')}</h2>
          <ul className="honest__list">
            <li>
              <X size={15} strokeWidth={2.4} aria-hidden="true" /> {t('landing.honest.doesnt1')}
            </li>
            <li>
              <X size={15} strokeWidth={2.4} aria-hidden="true" /> {t('landing.honest.doesnt2')}
            </li>
            <li>
              <X size={15} strokeWidth={2.4} aria-hidden="true" /> {t('landing.honest.doesnt3')}
            </li>
            <li>
              <X size={15} strokeWidth={2.4} aria-hidden="true" /> {t('landing.honest.doesnt4')}
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
