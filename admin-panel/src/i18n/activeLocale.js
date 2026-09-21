import { DEFAULT_LOCALE } from './constants';

/**
 * The locale the app is currently rendering in, readable from plain modules.
 *
 * Formatters and the API client need the locale but are not components, and
 * threading it through every `currency()` call would touch every line that
 * prints a price. The provider writes here on every change; because the whole
 * tree re-renders when the locale changes, anything that reads this during
 * render always sees the current value.
 */
let active = DEFAULT_LOCALE;

export function setActiveLocale(locale) {
  active = locale;
}

export function getActiveLocale() {
  return active;
}
