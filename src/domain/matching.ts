import { ADJACENT_SECTORS, type DealType, type Sector, type Timeline } from "./taxonomy";

/**
 * Deterministic match engine between a buyer mandate and a listed asset.
 *
 * Both sides of the marketplace read the same score: a buyer sees "recommended
 * for you", a seller sees "buyers who fit this asset". Keeping one scorer means
 * the two views can never disagree about who fits whom.
 *
 * The scorer is a pure function over plain inputs so it runs in tests, in a
 * server action, and inside a list render without touching the database. Every
 * point it awards comes back as a reason string, so the UI can show a buyer
 * why an asset surfaced instead of asking them to trust a number.
 */

export type MatchInput = {
  buyer: {
    sectors: Sector[];
    jurisdictions: string[];
    dealTypes: DealType[];
    ticketMinCents: number;
    ticketMaxCents: number;
    timeline: Timeline;
    proofOfFunds: boolean;
  };
  asset: {
    sector: Sector;
    country: string;
    dealType: DealType;
    askingPriceCents: number;
  };
};

export type MatchReason = {
  factor: "sector" | "budget" | "jurisdiction" | "dealType" | "readiness";
  points: number;
  max: number;
  /** i18n key plus interpolation values, resolved by the caller. */
  key: string;
  values?: Record<string, string | number>;
};

export type MatchResult = {
  score: number;
  band: "STRONG" | "GOOD" | "POSSIBLE" | "WEAK";
  reasons: MatchReason[];
};

const WEIGHTS = {
  sector: 30,
  budget: 30,
  jurisdiction: 20,
  dealType: 12,
  readiness: 8,
} as const;

/** How far outside a stated ticket range an asset can sit and still score half. */
const BUDGET_TOLERANCE = 0.25;

const TIMELINE_POINTS: Record<Timeline, number> = {
  NOW: 8,
  "3_MONTHS": 6,
  "6_MONTHS": 4,
  EXPLORING: 2,
};

function scoreSector(buyerSectors: Sector[], assetSector: Sector): MatchReason {
  const max = WEIGHTS.sector;
  if (buyerSectors.length === 0) {
    return { factor: "sector", points: max / 2, max, key: "match.sector.open" };
  }
  if (buyerSectors.includes(assetSector)) {
    return {
      factor: "sector",
      points: max,
      max,
      key: "match.sector.exact",
      values: { sector: assetSector },
    };
  }
  const adjacent = buyerSectors.find((s) => ADJACENT_SECTORS[s]?.includes(assetSector));
  if (adjacent) {
    return {
      factor: "sector",
      points: max / 2,
      max,
      key: "match.sector.adjacent",
      values: { sector: assetSector, mandate: adjacent },
    };
  }
  return { factor: "sector", points: 0, max, key: "match.sector.miss", values: { sector: assetSector } };
}

function scoreBudget(min: number, max: number, price: number): MatchReason {
  const weight = WEIGHTS.budget;
  if (!min && !max) {
    return { factor: "budget", points: weight / 2, max: weight, key: "match.budget.open" };
  }
  if (!price) {
    return { factor: "budget", points: weight / 2, max: weight, key: "match.budget.undisclosed" };
  }
  const lower = min || 0;
  const upper = max || Number.MAX_SAFE_INTEGER;
  if (price >= lower && price <= upper) {
    return { factor: "budget", points: weight, max: weight, key: "match.budget.inRange" };
  }
  const stretchedUpper = upper === Number.MAX_SAFE_INTEGER ? upper : upper * (1 + BUDGET_TOLERANCE);
  const stretchedLower = lower * (1 - BUDGET_TOLERANCE);
  if (price <= stretchedUpper && price >= stretchedLower) {
    return {
      factor: "budget",
      points: weight / 2,
      max: weight,
      key: price > upper ? "match.budget.slightlyAbove" : "match.budget.slightlyBelow",
    };
  }
  return {
    factor: "budget",
    points: 0,
    max: weight,
    key: price > upper ? "match.budget.above" : "match.budget.below",
  };
}

function scoreJurisdiction(buyerJurisdictions: string[], assetCountry: string): MatchReason {
  const max = WEIGHTS.jurisdiction;
  if (buyerJurisdictions.length === 0) {
    return { factor: "jurisdiction", points: max / 2, max, key: "match.jurisdiction.open" };
  }
  if (buyerJurisdictions.includes(assetCountry)) {
    return {
      factor: "jurisdiction",
      points: max,
      max,
      key: "match.jurisdiction.exact",
      values: { country: assetCountry },
    };
  }
  return {
    factor: "jurisdiction",
    points: 0,
    max,
    key: "match.jurisdiction.miss",
    values: { country: assetCountry },
  };
}

function scoreDealType(buyerDealTypes: DealType[], assetDealType: DealType): MatchReason {
  const max = WEIGHTS.dealType;
  if (buyerDealTypes.length === 0) {
    return { factor: "dealType", points: max / 2, max, key: "match.dealType.open" };
  }
  if (buyerDealTypes.includes(assetDealType)) {
    return {
      factor: "dealType",
      points: max,
      max,
      key: "match.dealType.exact",
      values: { dealType: assetDealType },
    };
  }
  return { factor: "dealType", points: 0, max, key: "match.dealType.miss" };
}

function scoreReadiness(timeline: Timeline, proofOfFunds: boolean): MatchReason {
  const max = WEIGHTS.readiness;
  const base = TIMELINE_POINTS[timeline];
  const points = Math.min(max, proofOfFunds ? base + 2 : base);
  return {
    factor: "readiness",
    points,
    max,
    key: proofOfFunds ? "match.readiness.funded" : "match.readiness.timeline",
    values: { timeline },
  };
}

export function bandFor(score: number): MatchResult["band"] {
  if (score >= 80) return "STRONG";
  if (score >= 60) return "GOOD";
  if (score >= 40) return "POSSIBLE";
  return "WEAK";
}

export function scoreMatch({ buyer, asset }: MatchInput): MatchResult {
  const reasons = [
    scoreSector(buyer.sectors, asset.sector),
    scoreBudget(buyer.ticketMinCents, buyer.ticketMaxCents, asset.askingPriceCents),
    scoreJurisdiction(buyer.jurisdictions, asset.country),
    scoreDealType(buyer.dealTypes, asset.dealType),
    scoreReadiness(buyer.timeline, buyer.proofOfFunds),
  ];

  const score = Math.round(reasons.reduce((sum, r) => sum + r.points, 0));
  return { score, band: bandFor(score), reasons };
}

/** Reasons worth showing on a card: the ones that carried the score. */
export function topReasons(result: MatchResult, limit = 2): MatchReason[] {
  return [...result.reasons]
    .filter((r) => r.points > 0)
    .sort((a, b) => b.points / b.max - a.points / a.max || b.points - a.points)
    .slice(0, limit);
}
