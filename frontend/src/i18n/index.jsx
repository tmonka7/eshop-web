import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import en from './locales/en';
import zh from './locales/zh';
import ja from './locales/ja';
import { setActiveLocale } from './activeLocale';
import {
  LOCALES, DEFAULT_LOCALE, STORAGE_KEY, INTL_BY_LOCALE, normaliseTag, detectLocale,
} from './constants';

const CATALOGUES = { en, zh, ja };

export { LOCALES, DEFAULT_LOCALE, normaliseTag, detectLocale };
export { getActiveLocale, setActiveLocale } from './activeLocale';

/** Everything a picker needs, without a round-trip to the API. */
export const LANGUAGES = LOCALES.map((tag) => ({
  tag,
  nativeName: CATALOGUES[tag].language.nativeName,
  englishName: CATALOGUES[tag].language.name,
  intlLocale: INTL_BY_LOCALE[tag],
  flag: CATALOGUES[tag].language.flag,
}));

function lookup(catalogue, key) {
  return key.split('.').reduce((node, part) => {
    if (node && typeof node === 'object' && part in node) return node[part];
    return undefined;
  }, catalogue);
}

/** Replaces {{name}} placeholders; an unknown one is left visible on purpose. */
function interpolate(template, params) {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (whole, name) =>
    (params[name] === undefined || params[name] === null ? whole : String(params[name])));
}

/**
 * Translate `key`, falling back to English and finally to the key itself, so a
 * gap in a catalogue shows up as a visible key rather than a blank button.
 */
export function translate(locale, key, params) {
  if (typeof key !== 'string' || !key) return '';
  const lang = CATALOGUES[locale] ? locale : DEFAULT_LOCALE;

  let value = lookup(CATALOGUES[lang], key);
  if (typeof value !== 'string' && lang !== DEFAULT_LOCALE) {
    value = lookup(CATALOGUES[DEFAULT_LOCALE], key);
  }
  if (typeof value !== 'string') {
    if (import.meta.env.DEV) console.warn('[i18n] missing key:', key);
    return key;
  }
  return interpolate(value, params);
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(() => {
    const initial = detectLocale();
    // Set before the first render so formatters called during it are correct.
    setActiveLocale(initial);
    return initial;
  });

  const setLocale = useCallback((next) => {
    const match = normaliseTag(next);
    if (!match) return;
    setActiveLocale(match);
    setLocaleState(match);
    try {
      localStorage.setItem(STORAGE_KEY, match);
    } catch (_err) {
      // A visitor who blocks storage just gets the default again next visit.
    }
    // Tells anything holding server data to refetch it in the new language.
    window.dispatchEvent(new CustomEvent('auramart:locale', { detail: match }));
  }, []);

  // Keeps screen readers, `:lang()` rules and font stacks honest.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(() => ({
    locale,
    intlLocale: INTL_BY_LOCALE[locale],
    setLocale,
    languages: LANGUAGES,
    t: (key, params) => translate(locale, key, params),
  }), [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

/** Shorthand for the common case: `const { t } = useTranslation();` */
export const useTranslation = useI18n;
