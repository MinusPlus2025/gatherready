/* ==========================================================================
   Landing: a small, real interaction instead of a static screenshot.

   The preview runs the product's own loop in miniature: the suggested question
   is sent, Diego answers, the confirmed-fit count moves 3 -> 4, and the same
   state can be reset. Nothing here claims money moved; there is no payment step
   in the preview.
   ========================================================================== */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Fingerprint } from 'lucide-react';
import { useI18n } from '../lib/i18n.js';
import { useAnimatedNumber } from '../lib/motion.js';

type Phase = 'suggested' | 'waiting' | 'yes' | 'no';

export function PlanPreview() {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>('suggested');
  const fits = useAnimatedNumber(phase === 'yes' ? 4 : 3);

  useEffect(() => {
    if (phase !== 'waiting') return;
    const timer = window.setTimeout(() => setPhase('yes'), 1500);
    return () => window.clearTimeout(timer);
  }, [phase]);

  return (
    <aside className="app-frame app-frame--overlap" aria-label={t('landing.frame.aria')}>
      <div className="app-frame__chrome">
        <span className="app-frame__dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="app-frame__title">{t('landing.frame.title')}</span>
        <span className="app-frame__badge app-frame__badge--live">{t('landing.frame.interactive')}</span>
      </div>

      <div className="app-frame__counts" aria-live="polite">
        <div>
          <span className="app-frame__num">6</span>
          <span className="app-frame__lbl">{t('landing.frame.interested')}</span>
        </div>
        <div className={phase === 'yes' ? 'app-frame__num--changed' : undefined}>
          <span className="app-frame__num">{fits}</span>
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
          <span className="app-frame__time-meta">
            {phase === 'yes' ? t('landing.frame.slot1metaYes') : t('landing.frame.slot1meta')}
          </span>
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
        {phase === 'suggested' ? (
          <>
            <span className="app-frame__kicker">{t('landing.frame.suggested')}</span>
            <p>{t('landing.frame.question')}</p>
            <div className="app-frame__question-pair">
              <span>{t('landing.frame.condition')}</span>
              <span>
                {t('landing.frame.gap')} <strong>3 → 4</strong>
              </span>
            </div>
            <div className="app-frame__actions">
              <button type="button" className="btn btn-primary btn-small" onClick={() => setPhase('waiting')}>
                {t('landing.frame.ask')}
                <ArrowRight size={14} strokeWidth={2.2} aria-hidden="true" />
              </button>
              <Link className="app-frame__link" to="/organizer/plan">
                {t('landing.frame.seePlan')}
              </Link>
            </div>
          </>
        ) : null}

        {phase === 'waiting' ? (
          <>
            <span className="app-frame__kicker">
              <i className="app-frame__pulse" aria-hidden="true" /> {t('landing.frame.asking')}
            </span>
            <p>{t('landing.frame.question')}</p>
            <div className="app-frame__question-pair">
              <span>{t('landing.frame.condition')}</span>
              <span>{t('landing.frame.waitingNote')}</span>
            </div>
          </>
        ) : null}

        {phase === 'yes' ? (
          <>
            <span className="app-frame__kicker app-frame__kicker--ok">{t('landing.frame.yesKicker')}</span>
            <p>{t('landing.frame.yesBody')}</p>
            <div className="app-frame__question-pair">
              <span>{t('landing.frame.diegoSaid')}</span>
              <span>
                {t('landing.frame.gap')} <strong>3 → 4</strong>
              </span>
            </div>
            <div className="app-frame__actions">
              <button type="button" className="btn btn-secondary btn-small" onClick={() => setPhase('suggested')}>
                {t('landing.frame.again')}
              </button>
              <button type="button" className="app-frame__link app-frame__link--button" onClick={() => setPhase('no')}>
                {t('landing.frame.tryNo')}
              </button>
            </div>
          </>
        ) : null}

        {phase === 'no' ? (
          <>
            <span className="app-frame__kicker app-frame__kicker--warn">{t('landing.frame.noKicker')}</span>
            <p>{t('landing.frame.noBody')}</p>
            <div className="app-frame__question-pair">
              <span>{t('landing.frame.diegoSaid')}</span>
              <span>{t('landing.frame.noNote')}</span>
            </div>
            <div className="app-frame__actions">
              <button type="button" className="btn btn-secondary btn-small" onClick={() => setPhase('suggested')}>
                {t('landing.frame.again')}
              </button>
              <Link className="app-frame__link" to="/organizer/plan">
                {t('landing.frame.seePlan')}
              </Link>
            </div>
          </>
        ) : null}
      </div>

      <div className="app-frame__foot">
        <Fingerprint size={14} strokeWidth={2} aria-hidden="true" />
        {t('landing.frame.foot')}
      </div>
    </aside>
  );
}
