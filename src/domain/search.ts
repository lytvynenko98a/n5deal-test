import { COUNTRIES, type BusinessStatus, type DealType, type Sector } from "./taxonomy";

export type AssetSort = "NEWEST" | "PRICE_ASC" | "PRICE_DESC" | "POPULAR" | "MATCH";

export type AssetFilters = {
  q: string;
  sectors: Sector[];
  countries: string[];
  businessStatuses: BusinessStatus[];
  dealTypes: DealType[];
  minPriceCents: number | null;
  maxPriceCents: number | null;
  sort: AssetSort;
};

export const EMPTY_ASSET_FILTERS: AssetFilters = {
  q: "",
  sectors: [],
  countries: [],
  businessStatuses: [],
  dealTypes: [],
  minPriceCents: null,
  maxPriceCents: null,
  sort: "NEWEST",
};

export type BuyerSort = "NEWEST" | "TICKET_DESC" | "READINESS" | "MATCH";

export type BuyerFilters = {
  q: string;
  sectors: Sector[];
  jurisdictions: string[];
  investorTypes: string[];
  timelines: string[];
  minTicketCents: number | null;
  proofOfFundsOnly: boolean;
  sort: BuyerSort;
};

export const EMPTY_BUYER_FILTERS: BuyerFilters = {
  q: "",
  sectors: [],
  jurisdictions: [],
  investorTypes: [],
  timelines: [],
  minTicketCents: null,
  proofOfFundsOnly: false,
  sort: "NEWEST",
};

/* ------------------------------------------------------------------ *
 * Natural-language query parsing
 * ------------------------------------------------------------------ */

const SECTOR_WORDS: Array<[RegExp, Sector]> = [
  [/\b(emi|e-money|electronic money)\b/i, "EMI"],
  [/\b(psp|payments?|acquir\w*|payment institution|pi licen\w*)\b/i, "PAYMENT"],
  [/\b(banks?|banking|credit institution)\b/i, "BANK"],
  [/\b(crypto|vasp|casp|digital assets?|blockchain|exchange)\b/i, "CRYPTO"],
  [/\b(lend\w*|credit|bnpl|consumer finance|mortgage)\b/i, "LENDING"],
  [/\b(wealth|asset manage\w*|brokerage|investment firm)\b/i, "WEALTH"],
  [/\b(fintech|neobank|saas)\b/i, "FINTECH"],
];

const STATUS_WORDS: Array<[RegExp, BusinessStatus]> = [
  [/\b(licen[cs]e[- ]only|shelf|clean|dormant|ready[- ]made)\b/i, "LICENSE_ONLY"],
  [/\b(operating|operational|revenue[- ]generating|active|trading)\b/i, "ACTIVE"],
  [/\b(pre[- ]revenue|early stage|greenfield)\b/i, "PRE_REVENUE"],
];

const DEAL_WORDS: Array<[RegExp, DealType]> = [
  [/\b(full sale|100%|outright|full acquisition)\b/i, "FULL_SALE"],
  [/\bmajority\b/i, "MAJORITY"],
  [/\b(minority|stake in)\b/i, "MINORITY"],
  [/\b(asset purchase|carve[- ]out|licen[cs]e transfer)\b/i, "ASSET_PURCHASE"],
];

const MULTIPLIERS: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9 };

function magnitude(raw: string, suffix?: string): number {
  const value = Number(raw.replace(/[\s,](?=\d{3}\b)/g, "").replace(/,/g, "."));
  if (!Number.isFinite(value)) return 0;
  const mult = suffix ? (MULTIPLIERS[suffix.toLowerCase()] ?? 1) : 1;
  return Math.round(value * mult * 100);
}

export type ParsedQuery = {
  filters: Partial<AssetFilters>;
  /** Human-readable list of what the parser took from the sentence. */
  understood: Array<{ label: string; value: string }>;
  /** Words the parser could not classify; they become the free-text search. */
  leftover: string;
};

/**
 * Turns "operating EMI in Lithuania under 5m" into filters.
 *
 * A rules parser handles the phrasings buyers actually type on a deal site:
 * a sector, a country, a price ceiling. It runs on every keystroke with no
 * network call and no key, and it explains what it matched so a buyer can
 * correct it. `enrichQueryWithLLM` in src/lib/ai.ts layers a model on top for
 * the sentences these rules miss.
 */
export function parseSmartQuery(input: string): ParsedQuery {
  const filters: Partial<AssetFilters> = {};
  const understood: ParsedQuery["understood"] = [];
  let rest = ` ${input} `;

  const consume = (re: RegExp) => {
    rest = rest.replace(re, " ");
  };

  const between = rest.match(
    /\b(?:between|from)\s*\$?\s*([\d.,]+)\s*([kmb])?\s*(?:and|to|-|–)\s*\$?\s*([\d.,]+)\s*([kmb])?/i,
  );
  if (between) {
    filters.minPriceCents = magnitude(between[1], between[2] ?? between[4]);
    filters.maxPriceCents = magnitude(between[3], between[4]);
    understood.push({ label: "price", value: `${between[1]}${between[2] ?? ""} – ${between[3]}${between[4] ?? ""}` });
    consume(new RegExp(between[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  } else {
    const under = rest.match(/\b(?:under|below|up to|less than|max|cheaper than|<)\s*\$?\s*([\d.,]+)\s*([kmb])?/i);
    if (under) {
      filters.maxPriceCents = magnitude(under[1], under[2]);
      understood.push({ label: "max price", value: `${under[1]}${under[2] ?? ""}` });
      consume(new RegExp(under[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    }
    const over = rest.match(/\b(?:over|above|from|at least|more than|min|>)\s*\$?\s*([\d.,]+)\s*([kmb])?|\$?\s*([\d.,]+)\s*([kmb])\s*\+/i);
    if (over) {
      filters.minPriceCents = magnitude(over[1] ?? over[3], over[2] ?? over[4]);
      understood.push({ label: "min price", value: `${over[1] ?? over[3]}${over[2] ?? over[4] ?? ""}` });
      consume(new RegExp(over[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    }
  }

  const sectors = new Set<Sector>();
  for (const [re, sector] of SECTOR_WORDS) {
    const hit = rest.match(re);
    if (hit) {
      sectors.add(sector);
      understood.push({ label: "sector", value: sector });
      consume(re);
    }
  }
  if (sectors.size) filters.sectors = [...sectors];

  const countries = new Set<string>();
  for (const c of COUNTRIES) {
    const re = new RegExp(`\\b${c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(rest)) {
      countries.add(c.code);
      understood.push({ label: "country", value: c.name });
      consume(re);
    }
  }
  if (countries.size) filters.countries = [...countries];

  const statuses = new Set<BusinessStatus>();
  for (const [re, status] of STATUS_WORDS) {
    if (re.test(rest)) {
      statuses.add(status);
      understood.push({ label: "status", value: status });
      consume(re);
    }
  }
  if (statuses.size) filters.businessStatuses = [...statuses];

  const deals = new Set<DealType>();
  for (const [re, deal] of DEAL_WORDS) {
    if (re.test(rest)) {
      deals.add(deal);
      understood.push({ label: "deal", value: deal });
      consume(re);
    }
  }
  if (deals.size) filters.dealTypes = [...deals];

  const leftover = rest
    .replace(/\b(in|with|for|and|or|the|a|an|of|looking|want|need|show|me|find|business|company|assets?)\b/gi, " ")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (leftover) filters.q = leftover;

  return { filters, understood, leftover };
}
