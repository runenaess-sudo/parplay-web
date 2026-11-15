// Presentation only. Keep payloads and rating calculations at full precision.
const integerFormat = new Intl.NumberFormat('en-US', {
  useGrouping: false, maximumFractionDigits: 0,
});
export function formatMomentRating(value: unknown, signed = false): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  // Round magnitude so positive and negative half-points behave symmetrically.
  const magnitude = Math.round(Math.abs(value));
  if (magnitude === 0) return '0';
  return (value < 0 ? '-' : signed ? '+' : '') + integerFormat.format(magnitude);
}

// Derive only the displayed change from the two displayed endpoint ratings.
export function formatMomentRatingChange(previous: unknown, next: unknown): string {
  if (typeof previous !== 'number' || !Number.isFinite(previous)
    || typeof next !== 'number' || !Number.isFinite(next)) return formatMomentRating(null);
  return formatMomentRating(Math.round(next) - Math.round(previous), true);
}
