'use strict';
const { resolveLocale, fromAcceptLanguage, LOCALES, DEFAULT_LOCALE, t } = require('../i18n');

/**
 * Decides which language this request should answer in, most explicit first:
 *
 *   1. ?lang=ja            - a deliberate override, e.g. a shared link
 *   2. X-Language: ja      - what the SPAs and the Android client send
 *   3. Accept-Language     - the browser's own setting
 *   4. 'en'
 *
 * Mounted app-wide before the routes, so failures raised on the way in are
 * localised too. That means req.user is not known yet; the saved account
 * preference slots in through applyUserLocale once auth has run.
 */
function detectLocale(req, res, next) {
  const locale = resolveLocale(
    req.query.lang,
    req.get('X-Language'),
    req.user && req.user.language,
    fromAcceptLanguage(req.get('Accept-Language')),
  );

  req.locale = locale;
  res.locals.locale = locale;

  // Lets callers translate without importing the catalogue everywhere.
  req.t = (key, params) => t(key, locale, params);

  res.set('Content-Language', locale);
  res.vary('Accept-Language');
  return next();
}

/**
 * Re-resolves the locale once req.user is known.
 *
 * detectLocale runs before authentication so that errors raised on the way in
 * are still localised, which means it never sees req.user. The auth middleware
 * calls this as soon as it has attached one, so a saved account preference
 * actually takes effect — while an explicit ?lang= or X-Language still wins,
 * since that is the caller being deliberate about this one request.
 */
function applyUserLocale(req, res) {
  if (!req.user || !req.user.language) return;
  if (req.query.lang || req.get('X-Language')) return;

  const locale = resolveLocale(req.user.language);
  req.locale = locale;
  res.locals.locale = locale;
  req.t = (key, params) => t(key, locale, params);
  res.set('Content-Language', locale);
}

/**
 * Hands the panel the whole `translations` sub-document instead of the folded,
 * single-language shape, so an editor can see and edit all three languages.
 * Mounted on the admin router only.
 */
function rawTranslations(_req, res, next) {
  res.locals.rawTranslations = true;
  return next();
}

module.exports = { detectLocale, applyUserLocale, rawTranslations, LOCALES, DEFAULT_LOCALE };
