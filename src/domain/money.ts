/** Amounts live in the database as integer USD cents. Convert only at the edges. */

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/** "$4.2M", "$750K", "$12,500". Deal pages are scanned, not read. */
export function formatCompact(cents: number, locale = "en"): string {
  if (!cents) return "—";
  const usd = cents / 100;
  const nf = (value: number, digits: number) =>
    new Intl.NumberFormat(locale === "uk" ? "uk-UA" : "en-US", {
      maximumFractionDigits: digits,
    }).format(value);

  if (usd >= 1_000_000_000) return `$${nf(usd / 1_000_000_000, 1)}B`;
  if (usd >= 1_000_000) return `$${nf(usd / 1_000_000, usd >= 10_000_000 ? 0 : 1)}M`;
  if (usd >= 1_000) return `$${nf(usd / 1_000, 0)}K`;
  return `$${nf(usd, 0)}`;
}

export function formatExact(cents: number, locale = "en"): string {
  return new Intl.NumberFormat(locale === "uk" ? "uk-UA" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatRange(minCents: number, maxCents: number, locale = "en"): string {
  if (!minCents && !maxCents) return "—";
  if (!maxCents) return `${formatCompact(minCents, locale)}+`;
  if (!minCents) return `up to ${formatCompact(maxCents, locale)}`;
  return `${formatCompact(minCents, locale)} – ${formatCompact(maxCents, locale)}`;
}
