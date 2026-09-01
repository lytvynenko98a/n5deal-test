import { describe, expect, it } from "vitest";

import { bandFor, scoreMatch, topReasons, type MatchInput } from "./matching";

const buyer: MatchInput["buyer"] = {
  sectors: ["EMI", "PAYMENT"],
  jurisdictions: ["LT", "CY"],
  dealTypes: ["FULL_SALE"],
  ticketMinCents: 200_000_000,
  ticketMaxCents: 1_200_000_000,
  timeline: "NOW",
  proofOfFunds: true,
};

const asset: MatchInput["asset"] = {
  sector: "EMI",
  country: "LT",
  dealType: "FULL_SALE",
  askingPriceCents: 840_000_000,
};

describe("scoreMatch", () => {
  it("gives a perfect score when every factor lines up", () => {
    expect(scoreMatch({ buyer, asset }).score).toBe(100);
  });

  it("halves the sector points for an adjacent sector", () => {
    const result = scoreMatch({ buyer, asset: { ...asset, sector: "FINTECH" } });
    const sector = result.reasons.find((r) => r.factor === "sector")!;
    expect(sector.points).toBe(15);
    expect(sector.key).toBe("match.sector.adjacent");
  });

  it("drops sector points to zero when nothing is adjacent", () => {
    const result = scoreMatch({ buyer, asset: { ...asset, sector: "WEALTH" } });
    expect(result.reasons.find((r) => r.factor === "sector")!.points).toBe(0);
  });

  it("scores a near miss on price at half, and a far miss at zero", () => {
    const near = scoreMatch({ buyer, asset: { ...asset, askingPriceCents: 1_400_000_000 } });
    const far = scoreMatch({ buyer, asset: { ...asset, askingPriceCents: 4_000_000_000 } });

    expect(near.reasons.find((r) => r.factor === "budget")!.points).toBe(15);
    expect(near.reasons.find((r) => r.factor === "budget")!.key).toBe("match.budget.slightlyAbove");
    expect(far.reasons.find((r) => r.factor === "budget")!.points).toBe(0);
  });

  it("treats an unstated mandate as neutral rather than a mismatch", () => {
    const open = scoreMatch({
      buyer: { ...buyer, sectors: [], jurisdictions: [], dealTypes: [] },
      asset,
    });
    expect(open.reasons.find((r) => r.factor === "sector")!.key).toBe("match.sector.open");
    expect(open.score).toBeLessThan(100);
    expect(open.score).toBeGreaterThan(40);
  });

  it("caps a price-on-request listing at half the budget weight", () => {
    const result = scoreMatch({ buyer, asset: { ...asset, askingPriceCents: 0 } });
    expect(result.reasons.find((r) => r.factor === "budget")!.key).toBe("match.budget.undisclosed");
  });

  it("never returns a score outside 0–100", () => {
    const worst = scoreMatch({
      buyer: {
        sectors: ["BANK"],
        jurisdictions: ["US"],
        dealTypes: ["MINORITY"],
        ticketMinCents: 1,
        ticketMaxCents: 2,
        timeline: "EXPLORING",
        proofOfFunds: false,
      },
      asset,
    });
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(100);
  });
});

describe("bandFor", () => {
  it("maps scores onto the four labels", () => {
    expect(bandFor(95)).toBe("STRONG");
    expect(bandFor(80)).toBe("STRONG");
    expect(bandFor(79)).toBe("GOOD");
    expect(bandFor(40)).toBe("POSSIBLE");
    expect(bandFor(39)).toBe("WEAK");
  });
});

describe("topReasons", () => {
  it("returns only reasons that earned points", () => {
    const result = scoreMatch({ buyer, asset: { ...asset, sector: "WEALTH", country: "US" } });
    expect(topReasons(result).every((r) => r.points > 0)).toBe(true);
  });
});
