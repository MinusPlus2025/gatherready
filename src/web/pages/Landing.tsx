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
import { useRef } from 'react';
import { formatCents } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { usePrefersReducedMotion, useRevealOnScroll } from '../lib/motion';
import { useApp } from '../lib/store';
import { WorkshopGallery } from '../components/Gallery';
import { webpSrcSet } from '../lib/images';
import { PlanPreview } from '../components/PlanPreview';
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
  const reduced = usePrefersReducedMotion();
  const figureRef = useRef<HTMLElement | null>(null);
  useRevealOnScroll([workshop]);

  const tiltBox = useRef<DOMRect | null>(null);
  const tiltFrame = useRef<number | null>(null);

  function tiltEnabled(): boolean {
    if (reduced) return false;
    return typeof window.matchMedia !== 'function' ? true : window.matchMedia('(pointer: fine)').matches;
  }

  function startTilt() {
    const figure = figureRef.current;
    if (!figure || !tiltEnabled()) return;
    tiltBox.current = figure.getBoundingClientRect();
    figure.dataset.tilting = 'true';
  }

  function tilt(event: React.PointerEvent<HTMLDivElement>) {
    const figure = figureRef.current;
    const box = tiltBox.current;
    if (!figure || !box || tiltFrame.current !== null) return;
    const clientX = event.clientX;
    const clientY = event.clientY;
    tiltFrame.current = requestAnimationFrame(() => {
      tiltFrame.current = null;
      const x = (clientX - box.left) / box.width - 0.5;
      const y = (clientY - box.top) / box.height - 0.5;
      figure.style.setProperty('--tilt-y', `${(x * 4).toFixed(2)}deg`);
      figure.style.setProperty('--tilt-x', `${(y * -3).toFixed(2)}deg`);
    });
  }

  function resetTilt() {
    const figure = figureRef.current;
    tiltBox.current = null;
    if (tiltFrame.current !== null) {
      cancelAnimationFrame(tiltFrame.current);
      tiltFrame.current = null;
    }
    if (!figure) return;
    delete figure.dataset.tilting;
    figure.style.setProperty('--tilt-y', '0deg');
    figure.style.setProperty('--tilt-x', '0deg');
  }

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

        <div className="hero__media" onPointerEnter={startTilt} onPointerMove={tilt} onPointerLeave={resetTilt}>
          <figure className="hero__figure" ref={figureRef}>
            <picture>
              <source
                type="image/webp"
                srcSet={webpSrcSet('/images/pottery-hands.jpg')}
                sizes="(max-width: 1000px) 92vw, 520px"
              />
              <img
                src="/images/pottery-hands.jpg"
                alt={t('landing.photo.altHands')}
                width={1600}
                height={968}
                fetchPriority="high"
              />
            </picture>
            <figcaption className="hero__caption">{t('landing.hero.caption')}</figcaption>
          </figure>
          <PlanPreview />
        </div>
      </section>

      <section className="state-strip" aria-label={t('landing.states.aria')} data-reveal>
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

      <WorkshopGallery />

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

      <section className="how" aria-labelledby="how-it-works" data-reveal>
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

      <section className="panel honest honest--split" aria-labelledby="limits" data-reveal>
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
