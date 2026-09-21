'use strict';

const MAX_LIMIT = 100;

/** Normalises ?page & ?limit into safe integers. */
function getPagination(query, defaultLimit = 12) {
  let page = Number.parseInt(query.page, 10);
  let limit = Number.parseInt(query.limit, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  return { page, limit, skip: (page - 1) * limit };
}

module.exports = { getPagination, MAX_LIMIT };
