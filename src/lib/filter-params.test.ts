import { describe, expect, it } from "vitest";

import { assetFiltersToParams, countActiveAssetFilters, parseAssetFilters } from "./filter-params";

describe("parseAssetFilters", () => {
  it("reads repeated params into arrays", () => {
    const params = new URLSearchParams("sector=EMI&sector=PAYMENT&country=LT&max=5000000");
    const filters = parseAssetFilters(params);

    expect(filters.sectors).toEqual(["EMI", "PAYMENT"]);
    expect(filters.countries).toEqual(["LT"]);
    expect(filters.maxPriceCents).toBe(500_000_000);
  });

  it("drops values outside the taxonomy instead of trusting the URL", () => {
    const filters = parseAssetFilters(new URLSearchParams("sector=NONSENSE&country=lt&sort=HACK"));
    expect(filters.sectors).toEqual([]);
    expect(filters.countries).toEqual([]);
    expect(filters.sort).toBe("NEWEST");
  });

  it("round-trips through the URL unchanged", () => {
    const original = parseAssetFilters(
      new URLSearchParams("q=iban&sector=EMI&country=LT&status=ACTIVE&deal=FULL_SALE&min=1&max=9&sort=POPULAR"),
    );
    expect(parseAssetFilters(assetFiltersToParams(original))).toEqual(original);
  });

  it("counts only the facets a person set", () => {
    const filters = parseAssetFilters(new URLSearchParams("q=iban&sector=EMI&max=5&sort=POPULAR"));
    expect(countActiveAssetFilters(filters)).toBe(2);
  });
});
