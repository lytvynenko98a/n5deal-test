import { describe, expect, it } from "vitest";

import { parseSmartQuery } from "./search";

describe("parseSmartQuery", () => {
  it("pulls sector, country and a price ceiling out of a sentence", () => {
    const { filters, understood } = parseSmartQuery("operating EMI in Lithuania under 5m");

    expect(filters.sectors).toContain("EMI");
    expect(filters.countries).toEqual(["LT"]);
    expect(filters.businessStatuses).toContain("ACTIVE");
    expect(filters.maxPriceCents).toBe(500_000_000);
    expect(understood.length).toBeGreaterThan(2);
  });

  it("reads a range", () => {
    const { filters } = parseSmartQuery("payment institution between 1m and 10m");
    expect(filters.minPriceCents).toBe(100_000_000);
    expect(filters.maxPriceCents).toBe(1_000_000_000);
  });

  it("reads a trailing plus as a floor", () => {
    const { filters } = parseSmartQuery("crypto exchange 2m+");
    expect(filters.minPriceCents).toBe(200_000_000);
    expect(filters.sectors).toContain("CRYPTO");
  });

  it("maps industry shorthand onto sectors", () => {
    expect(parseSmartQuery("psp for sale").filters.sectors).toContain("PAYMENT");
    expect(parseSmartQuery("vasp with custody").filters.sectors).toContain("CRYPTO");
    expect(parseSmartQuery("shelf company").filters.businessStatuses).toContain("LICENSE_ONLY");
  });

  it("keeps unmatched words as free text", () => {
    const { filters } = parseSmartQuery("EMI with card issuing");
    expect(filters.q).toContain("card");
    expect(filters.q).toContain("issuing");
  });

  it("returns nothing recognised for an empty or opaque query", () => {
    expect(parseSmartQuery("").understood).toEqual([]);
    expect(parseSmartQuery("something entirely unrelated").understood).toEqual([]);
  });

  it("handles k and b magnitudes", () => {
    expect(parseSmartQuery("under 800k").filters.maxPriceCents).toBe(80_000_000);
    expect(parseSmartQuery("under 1.5b").filters.maxPriceCents).toBe(150_000_000_000);
  });
});
