import { CHART_SERIES_CAP } from './constants';

/**
 * Collapses a ranked segment list down to the palette's series cap.
 *
 * Categorical hues are a fixed, finite order — cycling them makes the 9th
 * segment wear the 1st segment's colour, and on a donut the two sit in the same
 * ring with no way to tell them apart. Everything past the cap is summed into a
 * single "Other" segment instead, which is also what keeps the chart inside the
 * colour separation the palette was validated for.
 *
 * `segments` are expected pre-sorted by size, which is how the API returns them.
 */
export function foldSegments(segments, otherLabel, cap = CHART_SERIES_CAP) {
  if (!Array.isArray(segments) || segments.length <= cap) return segments || [];

  const head = segments.slice(0, cap);
  const tail = segments.slice(cap);

  const other = tail.reduce(
    (acc, seg) => ({
      category: otherLabel,
      revenue: acc.revenue + (seg.revenue || 0),
      units: acc.units + (seg.units || 0),
      percent: acc.percent + (seg.percent || 0),
    }),
    { category: otherLabel, revenue: 0, units: 0, percent: 0 },
  );

  // Percentages are rounded server-side, so re-round the accumulated total
  // rather than letting the drift show up as "33.99999%".
  other.percent = Math.round(other.percent * 100) / 100;
  other.revenue = Math.round(other.revenue * 100) / 100;

  return [...head, other];
}

/** Neutral grey for the folded "Other" slot — it is a remainder, not an entity. */
export const OTHER_COLOR = '#9ab0a3';
