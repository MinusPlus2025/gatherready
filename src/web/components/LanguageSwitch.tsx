/* Compact language control: globe + current short code, opening a scrollable
   menu of every supported language. English is the default; the choice persists. */

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { useI18n } from '../lib/i18n.js';
import { LOCALES, localeMeta } from '../lib/locales.js';

export function LanguageSwitch() {
  const { locale, setLocale, t, loadingLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const current = localeMeta(locale);

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

  return (
    <div className="lang-switch" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`lang-trigger${loadingLocale ? ' lang-trigger--loading' : ''}`}
        aria-expanded={open}
        aria-busy={loadingLocale !== null}
        onClick={() => setOpen((value) => !value)}
      >
        <Globe size={15} strokeWidth={2} aria-hidden="true" />
        <span className="visually-hidden">{t('language.label')}</span>
        <span className="lang-trigger__short">{current.short}</span>
        <ChevronDown size={12} strokeWidth={2.2} aria-hidden="true" className="lang-trigger__chevron" />
      </button>
      {open ? (
        <>
          <div className="lang-menu-scrim" aria-hidden="true" onClick={() => setOpen(false)} />
          <ul className="lang-menu">
            {LOCALES.map((item) => {
              const active = item.code === locale;
              return (
                <li key={item.code}>
                  <button
                    type="button"
                    className={`lang-menu__item${active ? ' lang-menu__item--active' : ''}`}
                    aria-current={active ? 'true' : undefined}
                    onClick={() => {
                      setOpen(false);
                      triggerRef.current?.focus();
                      void setLocale(item.code);
                    }}
                  >
                    <span className="lang-menu__native">{item.native}</span>
                    <span className="lang-menu__english">{item.english}</span>
                    {active ? <Check size={15} strokeWidth={2.4} aria-hidden="true" className="lang-menu__check" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
