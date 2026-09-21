/** Shared between the provider, the formatters and the API client. */
export const LOCALES = ['en', 'zh', 'ja'];
export const DEFAULT_LOCALE = 'en';
export const STORAGE_KEY = 'auramart.admin.lang';

/** App locale -> the tag Intl.NumberFormat / toLocaleDateString expect. */
export const INTL_BY_LOCALE = {
  en: 'en-US',
  zh: 'zh-CN',
  ja: 'ja-JP',
};

/** 'ja-JP' and 'zh-Hans-CN' both resolve; anything unknown returns null. */
export function normaliseTag(tag) {
  if (!tag || typeof tag !== 'string') return null;
  const lower = tag.trim().toLowerCase();
  if (LOCALES.includes(lower)) return lower;
  const primary = lower.split('-')[0];
  return LOCALES.includes(primary) ? primary : null;
}

/**
 * Resolution order: an explicit ?lang=, what the visitor chose last time, then
 * the browser's own languages, then English. Shared by the provider (at boot)
 * and the API client (per request).
 */
export function detectLocale() {
  try {
    const fromQuery = normaliseTag(new URLSearchParams(window.location.search).get('lang'));
    if (fromQuery) return fromQuery;

    const stored = normaliseTag(localStorage.getItem(STORAGE_KEY));
    if (stored) return stored;

    for (const tag of navigator.languages || [navigator.language]) {
      const match = normaliseTag(tag);
      if (match) return match;
    }
  } catch (_err) {
    // Private mode, blocked storage: fall through to the default.
  }
  return DEFAULT_LOCALE;
}
