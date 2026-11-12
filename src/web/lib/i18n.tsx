/* ==========================================================================
   Tiny i18n layer.

   - Two locales for the demo: English (submission language) and 简体中文.
   - The dictionary is flat, keyed by `page.section.thing`, and every entry is
     a plain string with optional {placeholders}.
   - Data stays in the language it was created in: workshop facts, slot labels,
     AI questions/quotes, server error text and the canonical offer terms are
     data, not chrome. The footer says this out loud in both languages.
   ========================================================================== */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en } from './messages-en';
import { flowEn } from './messages-flow-en';
import { flowZh } from './messages-flow-zh';
import { moneyEn } from './messages-money-en';
import { moneyZh } from './messages-money-zh';
import { onboardEn } from './messages-onboard-en';
import { onboardZh } from './messages-onboard-zh';
import { zh } from './messages-zh';

export type Locale = 'en' | 'zh';

const LOCALES: Locale[] = ['en', 'zh'];
const STORAGE_KEY = 'gatherready.locale';

export const localeName: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
};

function readStoredLocale(): Locale | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'zh') return stored;
  } catch {
    /* storage disabled */
  }
  return null;
}

/* English is the submission language and the predictable default; the switch is
   always one click away and the choice persists. */
function detectLocale(): Locale {
  return readStoredLocale() ?? 'en';
}

const dictionaries: Record<Locale, Record<string, string>> = {
  en: { ...en, ...flowEn, ...moneyEn, ...onboardEn },
  zh: { ...zh, ...flowZh, ...moneyZh, ...onboardZh },
};

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const template = dictionaries[locale][key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => String(vars[name] ?? `{${name}}`));
}

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage disabled: the choice lives for this session */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  }, [locale]);

  const value = useMemo<I18nValue>(
    () => ({ locale, setLocale, t: (key, vars) => translate(locale, key, vars) }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>');
  return value;
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as string[]).includes(value);
}
