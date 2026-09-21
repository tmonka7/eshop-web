'use strict';

/** Rounds to 2 decimals without binary float drift (e.g. 1.005 -> 1.01). */
function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

module.exports = { round2 };
