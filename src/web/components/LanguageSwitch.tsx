/* Two-locale switch. Plain buttons (not a select) so the current language is
   visible without opening anything, and each target keeps a 44px hit area. */

import { useI18n, type Locale } from '../lib/i18n.js';

const OPTIONS: Array<{ locale: Locale; labelKey: string }> = [
  { locale: 'en', labelKey: 'language.en' },
  { locale: 'zh', labelKey: 'language.zh' },
];

export function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label={t('language.label')}>
      {OPTIONS.map((option) => (
        <button
          key={option.locale}
          type="button"
          className={`lang-switch__button${locale === option.locale ? ' lang-switch__button--active' : ''}`}
          aria-pressed={locale === option.locale}
          onClick={() => setLocale(option.locale)}
        >
          {t(option.labelKey)}
        </button>
      ))}
    </div>
  );
}
