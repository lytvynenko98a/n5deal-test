import type { BusinessStatus, DealType, Sector } from "./taxonomy";

/**
 * Pre-publication review of a listing draft.
 *
 * A seller filling in a form gets three kinds of feedback: errors that block
 * publishing, inconsistencies between fields they entered themselves, and tips
 * that raise how much a buyer can judge before making contact. The rules encode
 * what a deal desk would query on a first read, so a seller fixes the listing
 * before a buyer wastes a message asking.
 */

export type IssueSeverity = "error" | "warning" | "tip";

export type ListingIssue = {
  severity: IssueSeverity;
  field: string;
  key: string;
  values?: Record<string, string | number>;
};

export type ListingDraft = {
  title: string;
  summary: string;
  description: string;
  sector: Sector | "";
  country: string;
  jurisdiction: string;
  licenseType: string;
  businessStatus: BusinessStatus;
  dealType: DealType;
  stakeOffered: number;
  askingPriceCents: number;
  revenueCents: number;
  ebitdaCents: number;
  employees: number;
  foundedYear: number | null;
};

export type ListingReview = {
  issues: ListingIssue[];
  /** 0–100, weighted by severity. Shown to the seller as "listing strength". */
  score: number;
  canPublish: boolean;
};

const REGULATED: Sector[] = ["BANK", "EMI", "PAYMENT", "CRYPTO", "LENDING"];

/** Revenue multiple above which a buyer will ask the seller to justify the ask. */
const HIGH_MULTIPLE = 12;

export function reviewListing(draft: ListingDraft): ListingReview {
  const issues: ListingIssue[] = [];
  const add = (
    severity: IssueSeverity,
    field: string,
    key: string,
    values?: Record<string, string | number>,
  ) => issues.push({ severity, field, key, values });

  if (draft.title.trim().length < 10) add("error", "title", "review.title.short");
  if (!draft.sector) add("error", "sector", "review.sector.missing");
  if (!draft.country) add("error", "country", "review.country.missing");
  if (draft.askingPriceCents <= 0) add("error", "askingPriceCents", "review.price.missing");
  if (draft.summary.trim().length < 60) add("error", "summary", "review.summary.short");

  if (draft.ebitdaCents > draft.revenueCents && draft.revenueCents > 0) {
    add("error", "ebitdaCents", "review.ebitda.exceedsRevenue");
  }
  const year = draft.foundedYear;
  if (year !== null && (year < 1900 || year > new Date().getFullYear())) {
    add("error", "foundedYear", "review.foundedYear.range");
  }

  if (draft.description.trim().length < 250) {
    add("warning", "description", "review.description.thin");
  }
  if (draft.sector && REGULATED.includes(draft.sector) && !draft.licenseType.trim()) {
    add("warning", "licenseType", "review.license.missing", { sector: draft.sector });
  }
  if (!draft.jurisdiction.trim()) add("tip", "jurisdiction", "review.jurisdiction.missing");

  if (draft.businessStatus === "ACTIVE" && draft.revenueCents === 0) {
    add("warning", "revenueCents", "review.revenue.activeButZero");
  }
  if (draft.businessStatus === "LICENSE_ONLY" && draft.revenueCents > 0) {
    add("warning", "businessStatus", "review.status.licenseButRevenue");
  }
  if (draft.businessStatus === "ACTIVE" && draft.employees === 0) {
    add("tip", "employees", "review.employees.activeButZero");
  }

  if (draft.dealType === "FULL_SALE" && draft.stakeOffered !== 100) {
    add("warning", "stakeOffered", "review.stake.fullSaleNot100");
  }
  if (draft.dealType === "MINORITY" && draft.stakeOffered > 50) {
    add("warning", "stakeOffered", "review.stake.minorityAbove50");
  }
  if (draft.dealType === "MAJORITY" && draft.stakeOffered <= 50) {
    add("warning", "stakeOffered", "review.stake.majorityBelow50");
  }

  if (draft.revenueCents > 0 && draft.askingPriceCents > 0) {
    const multiple = draft.askingPriceCents / draft.revenueCents;
    if (multiple > HIGH_MULTIPLE) {
      add("warning", "askingPriceCents", "review.price.highMultiple", {
        multiple: Math.round(multiple),
      });
    }
  }

  const penalty = issues.reduce(
    (sum, i) => sum + (i.severity === "error" ? 22 : i.severity === "warning" ? 9 : 3),
    0,
  );

  return {
    issues,
    score: Math.max(0, 100 - penalty),
    canPublish: !issues.some((i) => i.severity === "error"),
  };
}
