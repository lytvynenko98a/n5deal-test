import { describe, expect, it } from "vitest";

import { reviewListing, type ListingDraft } from "./listing-quality";

const good: ListingDraft = {
  title: "EMI licence holder with live IBAN issuing, Lithuania",
  summary:
    "Bank of Lithuania EMI licence, SEPA and SWIFT access through two partner banks, 4,100 active business accounts.",
  description: "x".repeat(400),
  sector: "EMI",
  country: "LT",
  jurisdiction: "Bank of Lithuania",
  licenseType: "Electronic Money Institution licence",
  businessStatus: "ACTIVE",
  dealType: "FULL_SALE",
  stakeOffered: 100,
  askingPriceCents: 840_000_000,
  revenueCents: 390_000_000,
  ebitdaCents: 115_000_000,
  employees: 31,
  foundedYear: 2018,
};

describe("reviewListing", () => {
  it("passes a complete listing with no issues", () => {
    const review = reviewListing(good);
    expect(review.issues).toEqual([]);
    expect(review.score).toBe(100);
    expect(review.canPublish).toBe(true);
  });

  it("blocks publishing when the price is missing", () => {
    const review = reviewListing({ ...good, askingPriceCents: 0 });
    expect(review.canPublish).toBe(false);
    expect(review.issues.some((i) => i.key === "review.price.missing")).toBe(true);
  });

  it("catches EBITDA above revenue", () => {
    const review = reviewListing({ ...good, ebitdaCents: 500_000_000 });
    expect(review.issues.some((i) => i.key === "review.ebitda.exceedsRevenue")).toBe(true);
    expect(review.canPublish).toBe(false);
  });

  it("flags an operating business reporting zero revenue", () => {
    const review = reviewListing({ ...good, revenueCents: 0 });
    expect(review.issues.some((i) => i.key === "review.revenue.activeButZero")).toBe(true);
    // A contradiction between two fields is a warning, not a publish blocker.
    expect(review.canPublish).toBe(true);
  });

  it("flags a licence-only listing that reports revenue", () => {
    const review = reviewListing({ ...good, businessStatus: "LICENSE_ONLY" });
    expect(review.issues.some((i) => i.key === "review.status.licenseButRevenue")).toBe(true);
  });

  it("asks a regulated sector for its licence", () => {
    const review = reviewListing({ ...good, licenseType: "  " });
    expect(review.issues.some((i) => i.key === "review.license.missing")).toBe(true);
  });

  it("questions a stake that contradicts the deal type", () => {
    expect(
      reviewListing({ ...good, dealType: "MINORITY", stakeOffered: 80 }).issues.some(
        (i) => i.key === "review.stake.minorityAbove50",
      ),
    ).toBe(true);
    expect(
      reviewListing({ ...good, dealType: "MAJORITY", stakeOffered: 30 }).issues.some(
        (i) => i.key === "review.stake.majorityBelow50",
      ),
    ).toBe(true);
  });

  it("asks for justification above a 12x revenue multiple", () => {
    const review = reviewListing({ ...good, askingPriceCents: 6_000_000_000 });
    const issue = review.issues.find((i) => i.key === "review.price.highMultiple");
    expect(issue?.values?.multiple).toBe(15);
  });

  it("rejects an impossible founding year", () => {
    expect(reviewListing({ ...good, foundedYear: 2199 }).canPublish).toBe(false);
    expect(reviewListing({ ...good, foundedYear: 1800 }).canPublish).toBe(false);
  });

  it("never drops the score below zero", () => {
    const empty = reviewListing({
      ...good,
      title: "",
      summary: "",
      description: "",
      sector: "",
      country: "",
      jurisdiction: "",
      licenseType: "",
      askingPriceCents: 0,
      revenueCents: 0,
      employees: 0,
      foundedYear: 3000,
    });
    expect(empty.score).toBe(0);
    expect(empty.canPublish).toBe(false);
  });
});
