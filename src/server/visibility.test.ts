import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Integration coverage for the rules that decide who sees what. These are the
 * rules a manager relies on when they suspend an account, so they are worth
 * exercising against a real database rather than a mock.
 */

const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "n5deal-test-")), "test.db");
process.env.DATABASE_URL = dbFile;

type Mod = typeof import("./queries");
type Schema = typeof import("@/db/schema");

let queries: Mod;
let schema: Schema;
let db: typeof import("@/db/client").db;

const ids = {
  seller: "seller-1",
  otherSeller: "seller-2",
  buyer: "buyer-1",
  hiddenBuyer: "buyer-2",
  manager: "manager-1",
  livePublished: "asset-live",
  draft: "asset-draft",
  suspended: "asset-suspended",
  otherSellerAsset: "asset-other",
};

beforeAll(async () => {
  db = (await import("@/db/client")).db;
  schema = await import("@/db/schema");
  queries = await import("./queries");

  db.insert(schema.users)
    .values([
      { id: ids.seller, email: "s1@example.com", name: "Seller One", role: "SELLER" },
      { id: ids.otherSeller, email: "s2@example.com", name: "Seller Two", role: "SELLER" },
      { id: ids.buyer, email: "b1@example.com", name: "Buyer One", role: "BUYER" },
      { id: ids.hiddenBuyer, email: "b2@example.com", name: "Buyer Two", role: "BUYER" },
      { id: ids.manager, email: "m1@example.com", name: "Manager", role: "MANAGER" },
    ])
    .run();

  db.insert(schema.buyerProfiles)
    .values([
      {
        userId: ids.buyer,
        headline: "EMI mandate",
        sectors: JSON.stringify(["EMI"]),
        jurisdictions: JSON.stringify(["LT"]),
        dealTypes: JSON.stringify(["FULL_SALE"]),
        ticketMinCents: 100_000_000,
        ticketMaxCents: 1_000_000_000,
        timeline: "NOW",
        listedInDirectory: true,
      },
      { userId: ids.hiddenBuyer, headline: "Quiet mandate", listedInDirectory: false },
    ])
    .run();

  const base = {
    sector: "EMI" as const,
    country: "LT",
    dealType: "FULL_SALE" as const,
    askingPriceCents: 500_000_000,
    summary: "",
    description: "",
  };

  db.insert(schema.assets)
    .values([
      { id: ids.livePublished, reference: "T-1", sellerId: ids.seller, title: "Live", status: "PUBLISHED", ...base },
      { id: ids.draft, reference: "T-2", sellerId: ids.seller, title: "Draft", status: "DRAFT", ...base },
      { id: ids.suspended, reference: "T-3", sellerId: ids.seller, title: "Suspended", status: "SUSPENDED", ...base },
      { id: ids.otherSellerAsset, reference: "T-4", sellerId: ids.otherSeller, title: "Other", status: "PUBLISHED", ...base },
    ])
    .run();
});

afterAll(() => {
  fs.rmSync(path.dirname(dbFile), { recursive: true, force: true });
});

const emptyFilters = () => ({
  q: "",
  sectors: [],
  countries: [],
  businessStatuses: [],
  dealTypes: [],
  minPriceCents: null,
  maxPriceCents: null,
  sort: "NEWEST" as const,
});

const user = (id: string) => db.select().from(schema.users).where(eq(schema.users.id, id)).get()!;

describe("asset visibility", () => {
  it("shows only published listings to a signed-out visitor", () => {
    const titles = queries.listAssets(emptyFilters(), null).rows.map((r) => r.asset.title);
    expect(titles.sort()).toEqual(["Live", "Other"]);
  });

  it("shows a seller their own drafts and suspensions alongside the public set", () => {
    const titles = queries
      .listAssets(emptyFilters(), user(ids.seller))
      .rows.map((r) => r.asset.title);
    expect(titles.sort()).toEqual(["Draft", "Live", "Other", "Suspended"]);
  });

  it("does not leak another seller's draft", () => {
    const titles = queries
      .listAssets(emptyFilters(), user(ids.otherSeller))
      .rows.map((r) => r.asset.title);
    expect(titles).not.toContain("Draft");
  });

  it("shows a manager everything", () => {
    expect(queries.listAssets(emptyFilters(), user(ids.manager)).total).toBe(4);
  });

  it("hides a suspended seller's listings from the public marketplace", () => {
    db.update(schema.users)
      .set({ status: "SUSPENDED", statusReason: "Failed verification" })
      .where(eq(schema.users.id, ids.otherSeller))
      .run();

    const titles = queries.listAssets(emptyFilters(), null).rows.map((r) => r.asset.title);
    expect(titles).toEqual(["Live"]);

    // The manager still sees it, so the action stays reviewable and reversible.
    expect(queries.listAssets(emptyFilters(), user(ids.manager)).total).toBe(4);

    db.update(schema.users)
      .set({ status: "ACTIVE", statusReason: null })
      .where(eq(schema.users.id, ids.otherSeller))
      .run();
  });

  it("returns null for a listing the viewer may not see", () => {
    expect(queries.getAsset(ids.draft, null)).toBeNull();
    expect(queries.getAsset(ids.draft, user(ids.seller))).not.toBeNull();
  });

  it("scores listings for a buyer and leaves them unscored for everyone else", () => {
    const forBuyer = queries.listAssets(emptyFilters(), user(ids.buyer)).rows;
    expect(forBuyer[0].match).not.toBeNull();
    expect(queries.listAssets(emptyFilters(), null).rows[0].match).toBeNull();
  });
});

describe("buyer directory visibility", () => {
  const buyerFilters = () => ({
    q: "",
    sectors: [],
    jurisdictions: [],
    investorTypes: [],
    timelines: [],
    minTicketCents: null,
    proofOfFundsOnly: false,
    sort: "NEWEST" as const,
  });

  it("hides a buyer who opted out of the directory", () => {
    const names = queries.listBuyers(buyerFilters(), user(ids.seller)).rows.map((r) => r.user.name);
    expect(names).toEqual(["Buyer One"]);
  });

  it("still shows the opted-out buyer to a manager", () => {
    expect(queries.listBuyers(buyerFilters(), user(ids.manager)).total).toBe(2);
  });

  it("refuses a direct link to a hidden buyer profile", () => {
    expect(queries.getBuyer(ids.hiddenBuyer, user(ids.seller))).toBeNull();
    expect(queries.getBuyer(ids.hiddenBuyer, user(ids.manager))).not.toBeNull();
  });
});
