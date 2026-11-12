/* Compact appearance control: accent presets, background presets and a custom
   accent. Only CSS variables change; semantic colours and PayPal branding stay
   fixed. The choice persists locally and is applied before first render. */

import { useEffect, useRef, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { useI18n } from '../lib/i18n.js';
import {
  ACCENT_PRESETS,
  BACKGROUND_PRESETS,
  applyTheme,
  loadTheme,
  readableOn,
  resetTheme,
  saveTheme,
  type ThemeColors,
} from '../lib/theme.js';

export function ThemeSwitch() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<ThemeColors>(() => loadTheme());
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function choose(next: ThemeColors): void {
    setTheme(next);
    applyTheme(next);
    saveTheme(next);
  }

  return (
    <div className="theme-switch" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className="theme-trigger"
        aria-expanded={open}
        aria-label={t('theme.label')}
        title={t('theme.label')}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="theme-trigger__inner">
          <Palette size={15} strokeWidth={2} aria-hidden="true" />
        </span>
      </button>
      {open ? (
        <>
          <div className="theme-menu-scrim" aria-hidden="true" onClick={() => setOpen(false)} />
          <div className="theme-menu" role="dialog" aria-label={t('theme.label')}>
            <p className="theme-menu__label">{t('theme.accent')}</p>
            <div className="theme-swatches" role="group" aria-label={t('theme.accent')}>
              {ACCENT_PRESETS.map((color, index) => {
                const active = theme.accent === color;
                return (
                  <button
                    key={color}
                    type="button"
                    className={`theme-swatch${active ? ' theme-swatch--active' : ''}`}
                    style={{ background: color, color: readableOn(color) }}
                    aria-label={`${t('theme.accent')} ${index + 1}`}
                    aria-pressed={active}
                    onClick={() => choose({ ...theme, accent: color })}
                  >
                    {active ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
            <label className="theme-custom">
              <span>{t('theme.custom')}</span>
              <input
                type="color"
                value={theme.accent}
                aria-label={`${t('theme.custom')} — ${t('theme.accent')}`}
                onChange={(event) => choose({ ...theme, accent: event.target.value })}
              />
            </label>
            <p className="theme-menu__label">{t('theme.background')}</p>
            <div className="theme-swatches" role="group" aria-label={t('theme.background')}>
              {BACKGROUND_PRESETS.map((color, index) => {
                const active = theme.background === color;
                return (
                  <button
                    key={color}
                    type="button"
                    className={`theme-swatch theme-swatch--background${active ? ' theme-swatch--active' : ''}`}
                    style={{ background: color, color: readableOn(color) }}
                    aria-label={`${t('theme.background')} ${index + 1}`}
                    aria-pressed={active}
                    onClick={() => choose({ ...theme, background: color })}
                  >
                    {active ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
            <div className="theme-menu__footer">
              <button
                type="button"
                className="btn btn-ghost btn--small"
                onClick={() => setTheme(resetTheme())}
              >
                {t('theme.reset')}
              </button>
              <button type="button" className="btn btn-secondary btn--small" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
