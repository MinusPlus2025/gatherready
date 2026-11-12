/* ==========================================================================
   i18n layer.

   - English is the default and always ships in the first chunk. 简体中文 also
     ships statically (it is the second submission language); the other six
     locales are fetched as their own chunk the first time they are chosen.
   - The dictionary is flat, keyed by `page.section.thing`, with {placeholders}.
   - Data stays in the language it was created in: workshop facts, server slot
     labels, AI questions/quotes, canonical offer terms, server errors.
   ========================================================================== */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_LOCALE, localeMeta, type Locale } from './locales';
import { en } from './messages-en';
import { flowEn } from './messages-flow-en';
import { moneyEn } from './messages-money-en';
import { onboardEn } from './messages-onboard-en';
import { zh } from './messages-zh';
import { flowZh } from './messages-flow-zh';
import { moneyZh } from './messages-money-zh';
import { onboardZh } from './messages-onboard-zh';

export type { Locale } from './locales';
export { LOCALES, isLocale, localeMeta } from './locales';

type Dict = Record<string, string>;

const enAll: Dict = { ...en, ...flowEn, ...moneyEn, ...onboardEn };
const zhAll: Dict = { ...zh, ...flowZh, ...moneyZh, ...onboardZh };

/* Loaded dictionaries. `en` and `zh` are part of the initial bundle. */
const loaded: Partial<Record<Locale, Dict>> = { en: enAll, zh: zhAll };

const loaders: Record<'zh-TW' | 'es' | 'fr' | 'de' | 'ja' | 'ko', () => Promise<Dict>> = {
  'zh-TW': async () => (await import('./messages-zh-tw')).zhTW,
  es: async () => (await import('./messages-es')).es,
  fr: async () => (await import('./messages-fr')).fr,
  de: async () => (await import('./messages-de')).de,
  ja: async () => (await import('./messages-ja')).ja,
  ko: async () => (await import('./messages-ko')).ko,
};

const STORAGE_KEY = 'gatherready.locale';

export function readStoredLocale(): Locale | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && stored in loaders) return stored as Locale;
    if (stored === 'en' || stored === 'zh') return stored;
  } catch {
    /* storage disabled */
  }
  return null;
}

export async function loadDictionary(locale: Locale): Promise<Dict> {
  const existing = loaded[locale];
  if (existing) return existing;
  const loader = loaders[locale as keyof typeof loaders];
  if (!loader) return enAll;
  const dictionary = await loader();
  loaded[locale] = dictionary;
  return dictionary;
}

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const dictionary = loaded[locale] ?? enAll;
  const template = dictionary[key] ?? enAll[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => String(vars[name] ?? `{${name}}`));
}

interface I18nValue {
  locale: Locale;
  loadingLocale: Locale | null;
  setLocale: (locale: Locale) => Promise<void>;
  t: Translate;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
  initialDictionary,
}: {
  children: ReactNode;
  initialLocale?: Locale;
  initialDictionary?: Dict;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [dictionary, setDictionary] = useState<Dict>(() => initialDictionary ?? loaded[initialLocale] ?? enAll);
  const [loadingLocale, setLoadingLocale] = useState<Locale | null>(null);

  useEffect(() => {
    document.documentElement.lang = localeMeta(locale).htmlLang;
  }, [locale]);

  const setLocale = useCallback(
    async (next: Locale) => {
      if (next === locale) return;
      setLoadingLocale(next);
      try {
        const nextDictionary = await loadDictionary(next);
        setDictionary(nextDictionary);
        setLocaleState(next);
        try {
          window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
          /* storage disabled: choice lives for this session */
        }
      } finally {
        setLoadingLocale(null);
      }
    },
    [locale],
  );

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      loadingLocale,
      setLocale,
      t: (key, vars) => {
        const template = dictionary[key] ?? enAll[key] ?? key;
        if (!vars) return template;
        return template.replace(/\{(\w+)\}/g, (_match, name: string) => String(vars[name] ?? `{${name}}`));
      },
    }),
    [locale, loadingLocale, setLocale, dictionary],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>');
  return value;
}
