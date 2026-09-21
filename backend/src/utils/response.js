'use strict';
const { t, DEFAULT_LOCALE } = require('../i18n');
const { localizePayload } = require('./localize');

/** The locale detectLocale() stashed on this response, or the default. */
function localeOf(res) {
  return (res.locals && res.locals.locale) || (res.req && res.req.locale) || DEFAULT_LOCALE;
}

/**
 * Admin routes set res.locals.rawTranslations so the panel receives the whole
 * `translations` sub-document and can edit every language. Storefront traffic
 * gets the folded, single-language shape.
 */
function shape(res, data) {
  if (res.locals && res.locals.rawTranslations) return data;
  return localizePayload(data, localeOf(res));
}

/**
 * Uniform success envelope used by every controller.
 * `message` is a catalogue key ('success.orderPlaced'); unknown strings are
 * emitted verbatim so dynamic messages still work.
 */
function ok(res, data = null, message = 'success.ok', statusCode = 200, extra = {}, params) {
  return res.status(statusCode).json({
    success: true,
    message: t(message, localeOf(res), params),
    data: shape(res, data),
    ...extra,
  });
}

function created(res, data = null, message = 'success.created', params) {
  return ok(res, data, message, 201, {}, params);
}

/** Paginated envelope: { success, message, data: [...], pagination: {...} }. */
function paginated(res, items, { page, limit, total }, message = 'success.ok') {
  return res.status(200).json({
    success: true,
    message: t(message, localeOf(res)),
    data: shape(res, items),
    pagination: {
      page,
      limit,
      total,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  });
}

module.exports = { ok, created, paginated, localeOf };
