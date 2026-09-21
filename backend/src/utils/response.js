'use strict';

/** Uniform success envelope used by every controller. */
function ok(res, data = null, message = 'OK', statusCode = 200, extra = {}) {
  return res.status(statusCode).json({ success: true, message, data, ...extra });
}

function created(res, data = null, message = 'Created') {
  return ok(res, data, message, 201);
}

/** Paginated envelope: { success, message, data: [...], pagination: {...} }. */
function paginated(res, items, { page, limit, total }, message = 'OK') {
  return res.status(200).json({
    success: true,
    message,
    data: items,
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

module.exports = { ok, created, paginated };
