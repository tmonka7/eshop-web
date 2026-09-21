import { useState } from 'react';
import { useI18n } from '../i18n';
import { LOCALES, DEFAULT_LOCALE } from '../i18n/constants';

/**
 * Per-language editor for a document's `translations` sub-document.
 *
 * The canonical English fields live in the form above this block and stay the
 * fallback, so English is not offered as a tab — editing it here would give us
 * two places to change the same string. `fields` names which of the
 * translatable keys this document actually has (a product has name/description/
 * shortDescription, a banner title/subtitle/ctaText).
 *
 * `value` is the whole `{ zh: {...}, ja: {...} }` object and `onChange` is
 * called with the next one, so the parent can keep it in its form state and
 * PATCH it as-is.
 */
const FIELD_LABEL_KEYS = {
  name: 'translations.nameFor',
  description: 'translations.descriptionFor',
  shortDescription: 'translations.shortDescriptionFor',
  title: 'translations.titleFor',
  subtitle: 'translations.subtitleFor',
  ctaText: 'translations.ctaFor',
};

/** Long-form fields get a textarea; the rest a single-line input. */
const MULTILINE = new Set(['description', 'shortDescription']);

const TRANSLATABLE_LOCALES = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

export default function TranslationFields({ fields, value, onChange }) {
  const { t, languages } = useI18n();
  const [active, setActive] = useState(TRANSLATABLE_LOCALES[0]);

  const translations = value || {};

  function patch(locale, field, next) {
    onChange({
      ...translations,
      [locale]: { ...(translations[locale] || {}), [field]: next },
    });
  }

  /** A language counts as translated once any of its fields has content. */
  function isFilled(locale) {
    const copy = translations[locale] || {};
    return fields.some((f) => String(copy[f] || '').trim().length > 0);
  }

  const activeLanguage = languages.find((l) => l.tag === active);

  return (
    <div className="translation-block">
      <div className="row between wrap gap-8 mb-8">
        <strong className="small">{t('translations.heading')}</strong>
        <div className="row gap-4">
          {TRANSLATABLE_LOCALES.map((locale) => {
            const lang = languages.find((l) => l.tag === locale);
            return (
              <button
                key={locale}
                type="button"
                className={`translation-tab ${active === locale ? 'active' : ''}`}
                onClick={() => setActive(locale)}
              >
                <span aria-hidden>{lang?.flag}</span>
                <span lang={locale}>{lang?.nativeName}</span>
                <span className={`dot ${isFilled(locale) ? 'on' : ''}`} aria-hidden />
                <span className="sr-only">
                  {isFilled(locale) ? t('translations.translated') : t('translations.untranslated')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="tiny muted mb-16">{t('translations.hint')}</p>

      {fields.map((field) => {
        const labelKey = FIELD_LABEL_KEYS[field];
        const id = `tr-${active}-${field}`;
        const current = (translations[active] || {})[field] || '';

        return (
          <div className="field" key={field}>
            <label className="field-label" htmlFor={id}>
              {t(labelKey, { language: activeLanguage?.nativeName || active })}
            </label>
            {MULTILINE.has(field) ? (
              <textarea
                id={id}
                className="textarea"
                lang={active}
                rows={field === 'description' ? 5 : 2}
                value={current}
                placeholder={t('translations.emptyFallbackHint')}
                onChange={(e) => patch(active, field, e.target.value)}
              />
            ) : (
              <input
                id={id}
                className="input"
                lang={active}
                value={current}
                placeholder={t('translations.emptyFallbackHint')}
                onChange={(e) => patch(active, field, e.target.value)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
