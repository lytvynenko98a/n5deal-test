import {
  EMPTY_ASSET_FILTERS,
  EMPTY_BUYER_FILTERS,
  type AssetFilters,
  type AssetSort,
  type BuyerFilters,
  type BuyerSort,
} from "@/domain/search";
import {
  BUSINESS_STATUSES,
  DEAL_TYPES,
  INVESTOR_TYPES,
  SECTORS,
  TIMELINES,
  type BusinessStatus,
  type DealType,
  type Sector,
} from "@/domain/taxonomy";

/**
 * Filters live in the URL, not in component state. A buyer can send a colleague
 * a link to "operating EMIs in Lithuania under 5M" and it opens the same page,
 * and the server renders the first paint already filtered.
 */

type Params = URLSearchParams | Record<string, string | string[] | undefined>;

function read(params: Params, key: string): string[] {
  if (params instanceof URLSearchParams) return params.getAll(key);
  const value = params[key];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function one(params: Params, key: string): string {
  return read(params, key)[0] ?? "";
}

function intersect<T extends string>(values: string[], allowed: readonly T[]): T[] {
  return values.filter((v): v is T => (allowed as readonly string[]).includes(v));
}

function cents(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

export function parseAssetFilters(params: Params): AssetFilters {
  const sort = one(params, "sort") as AssetSort;
  return {
    q: one(params, "q"),
    sectors: intersect<Sector>(read(params, "sector"), SECTORS),
    countries: read(params, "country").filter((c) => /^[A-Z]{2}$/.test(c)),
    businessStatuses: intersect<BusinessStatus>(read(params, "status"), BUSINESS_STATUSES),
    dealTypes: intersect<DealType>(read(params, "deal"), DEAL_TYPES),
    minPriceCents: cents(one(params, "min")),
    maxPriceCents: cents(one(params, "max")),
    sort: (["NEWEST", "PRICE_ASC", "PRICE_DESC", "POPULAR", "MATCH"] as const).includes(sort)
      ? sort
      : EMPTY_ASSET_FILTERS.sort,
  };
}

export function assetFiltersToParams(filters: Partial<AssetFilters>): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  filters.sectors?.forEach((v) => params.append("sector", v));
  filters.countries?.forEach((v) => params.append("country", v));
  filters.businessStatuses?.forEach((v) => params.append("status", v));
  filters.dealTypes?.forEach((v) => params.append("deal", v));
  if (filters.minPriceCents) params.set("min", String(filters.minPriceCents / 100));
  if (filters.maxPriceCents) params.set("max", String(filters.maxPriceCents / 100));
  if (filters.sort && filters.sort !== "NEWEST") params.set("sort", filters.sort);
  return params;
}

export function countActiveAssetFilters(filters: AssetFilters): number {
  return (
    filters.sectors.length +
    filters.countries.length +
    filters.businessStatuses.length +
    filters.dealTypes.length +
    (filters.minPriceCents ? 1 : 0) +
    (filters.maxPriceCents ? 1 : 0)
  );
}

export function parseBuyerFilters(params: Params): BuyerFilters {
  const sort = one(params, "sort") as BuyerSort;
  return {
    q: one(params, "q"),
    sectors: intersect<Sector>(read(params, "sector"), SECTORS),
    jurisdictions: read(params, "country").filter((c) => /^[A-Z]{2}$/.test(c)),
    investorTypes: intersect(read(params, "investor"), INVESTOR_TYPES),
    timelines: intersect(read(params, "timeline"), TIMELINES),
    minTicketCents: cents(one(params, "ticket")),
    proofOfFundsOnly: one(params, "pof") === "1",
    sort: (["NEWEST", "TICKET_DESC", "READINESS", "MATCH"] as const).includes(sort)
      ? sort
      : EMPTY_BUYER_FILTERS.sort,
  };
}

export function buyerFiltersToParams(filters: Partial<BuyerFilters>): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  filters.sectors?.forEach((v) => params.append("sector", v));
  filters.jurisdictions?.forEach((v) => params.append("country", v));
  filters.investorTypes?.forEach((v) => params.append("investor", v));
  filters.timelines?.forEach((v) => params.append("timeline", v));
  if (filters.minTicketCents) params.set("ticket", String(filters.minTicketCents / 100));
  if (filters.proofOfFundsOnly) params.set("pof", "1");
  if (filters.sort && filters.sort !== "NEWEST") params.set("sort", filters.sort);
  return params;
}

export function countActiveBuyerFilters(filters: BuyerFilters): number {
  return (
    filters.sectors.length +
    filters.jurisdictions.length +
    filters.investorTypes.length +
    filters.timelines.length +
    (filters.minTicketCents ? 1 : 0) +
    (filters.proofOfFundsOnly ? 1 : 0)
  );
}
