/* Locale registry. English is the default; the switch is a compact dropdown.
   Dictionaries are loaded lazily per locale (see i18n.tsx) so the first paint
   only pays for the active language. */

export type Locale = 'en' | 'zh' | 'zh-TW' | 'es' | 'fr' | 'de' | 'ja' | 'ko';

export interface LocaleMeta {
  code: Locale;
  /** Name in its own language, shown in the menu. */
  native: string;
  /** Short trigger label (≤3 glyphs where possible). */
  short: string;
  /** English name, shown small at the right of the menu row. */
  english: string;
  /** BCP-47 tag for <html lang>. */
  htmlLang: string;
}

export const LOCALES: LocaleMeta[] = [
  { code: 'en', native: 'English', short: 'EN', english: 'English', htmlLang: 'en' },
  { code: 'zh', native: '简体中文', short: '简', english: 'Chinese (Simplified)', htmlLang: 'zh-CN' },
  { code: 'zh-TW', native: '繁體中文', short: '繁', english: 'Chinese (Traditional)', htmlLang: 'zh-TW' },
  { code: 'es', native: 'Español', short: 'ES', english: 'Spanish', htmlLang: 'es' },
  { code: 'fr', native: 'Français', short: 'FR', english: 'French', htmlLang: 'fr' },
  { code: 'de', native: 'Deutsch', short: 'DE', english: 'German', htmlLang: 'de' },
  { code: 'ja', native: '日本語', short: '日', english: 'Japanese', htmlLang: 'ja' },
  { code: 'ko', native: '한국어', short: '한', english: 'Korean', htmlLang: 'ko' },
];

export const DEFAULT_LOCALE: Locale = 'en';

export function localeMeta(code: Locale): LocaleMeta {
  return LOCALES.find((locale) => locale.code === code) ?? LOCALES[0]!;
}

export function isLocale(value: string): value is Locale {
  return LOCALES.some((locale) => locale.code === value);
}
