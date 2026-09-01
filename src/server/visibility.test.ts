import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Integration coverage for the rules that decide who sees what. These are the
 * rules a manager relies on when they suspend an account, so they run against a
 * real Postgres (PGlite in memory) rather than a mock. The database lives for
 * the life of the process and vitest forks one per test file, so there is
 * nothing to tear down.
 */

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

type Queries = typeof import("./queries");
type Schema = typeof import("@/db/schema");

let queries: Queries;
let schema: Schema;
let db: Awaited<ReturnType<typeof import("@/db/client").getDb>>;

const ids = {
  seller: randomUUID(),
  otherSeller: randomUUID(),
  buyer: randomUUID(),
  hiddenBuyer: randomUUID(),
  manager: randomUUID(),
  livePublished: randomUUID(),
  draft: randomUUID(),
  suspended: randomUUID(),
  otherSellerAsset: randomUUID(),
};

beforeAll(async () => {
  db = await (await import("@/db/client")).getDb();
  schema = await import("@/db/schema");
  queries = await import("./queries");

  await db.insert(schema.users).values([
    { id: ids.seller, email: "s1@example.com", name: "Seller One", role: "SELLER" },
    { id: ids.otherSeller, email: "s2@example.com", name: "Seller Two", role: "SELLER" },
    { id: ids.buyer, email: "b1@example.com", name: "Buyer One", role: "BUYER" },
    { id: ids.hiddenBuyer, email: "b2@example.com", name: "Buyer Two", role: "BUYER" },
    { id: ids.manager, email: "m1@example.com", name: "Manager", role: "MANAGER" },
  ]);

  await db.insert(schema.buyerProfiles).values([
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
  ]);

  const base = {
    sector: "EMI" as const,
    country: "LT",
    dealType: "FULL_SALE" as const,
    askingPriceCents: 500_000_000,
    summary: "",
    description: "",
  };

  await db.insert(schema.assets).values([
    { id: ids.livePublished, reference: "T-1", sellerId: ids.seller, title: "Live", status: "PUBLISHED", ...base },
    { id: ids.draft, reference: "T-2", sellerId: ids.seller, title: "Draft", status: "DRAFT", ...base },
    { id: ids.suspended, reference: "T-3", sellerId: ids.seller, title: "Suspended", status: "SUSPENDED", ...base },
    { id: ids.otherSellerAsset, reference: "T-4", sellerId: ids.otherSeller, title: "Other", status: "PUBLISHED", ...base },
  ]);
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

async function user(id: string) {
  const [row] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  return row;
}

describe("asset visibility", () => {
  it("shows only published listings to a signed-out visitor", async () => {
    const { rows } = await queries.listAssets(emptyFilters(), null);
    expect(rows.map((r) => r.asset.title).sort()).toEqual(["Live", "Other"]);
  });

  it("shows a seller their own drafts and suspensions alongside the public set", async () => {
    const { rows } = await queries.listAssets(emptyFilters(), await user(ids.seller));
    expect(rows.map((r) => r.asset.title).sort()).toEqual(["Draft", "Live", "Other", "Suspended"]);
  });

  it("does not leak another seller's draft", async () => {
    const { rows } = await queries.listAssets(emptyFilters(), await user(ids.otherSeller));
    expect(rows.map((r) => r.asset.title)).not.toContain("Draft");
  });

  it("shows a manager everything", async () => {
    const { total } = await queries.listAssets(emptyFilters(), await user(ids.manager));
    expect(total).toBe(4);
  });

  it("hides a suspended seller's listings from the public marketplace", async () => {
    await db
      .update(schema.users)
      .set({ status: "SUSPENDED", statusReason: "Failed verification" })
      .where(eq(schema.users.id, ids.otherSeller));

    const { rows } = await queries.listAssets(emptyFilters(), null);
    expect(rows.map((r) => r.asset.title)).toEqual(["Live"]);

    // The manager still sees it, so the action stays reviewable and reversible.
    const forManager = await queries.listAssets(emptyFilters(), await user(ids.manager));
    expect(forManager.total).toBe(4);

    await db
      .update(schema.users)
      .set({ status: "ACTIVE", statusReason: null })
      .where(eq(schema.users.id, ids.otherSeller));
  });

  it("returns null for a listing the viewer may not see", async () => {
    expect(await queries.getAsset(ids.draft, null)).toBeNull();
    expect(await queries.getAsset(ids.draft, await user(ids.seller))).not.toBeNull();
  });

  it("scores listings for a buyer and leaves them unscored for everyone else", async () => {
    const forBuyer = await queries.listAssets(emptyFilters(), await user(ids.buyer));
    expect(forBuyer.rows[0].match).not.toBeNull();

    const anonymous = await queries.listAssets(emptyFilters(), null);
    expect(anonymous.rows[0].match).toBeNull();
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

  it("hides a buyer who opted out of the directory", async () => {
    const { rows } = await queries.listBuyers(buyerFilters(), await user(ids.seller));
    expect(rows.map((r) => r.user.name)).toEqual(["Buyer One"]);
  });

  it("still shows the opted-out buyer to a manager", async () => {
    const { total } = await queries.listBuyers(buyerFilters(), await user(ids.manager));
    expect(total).toBe(2);
  });

  it("refuses a direct link to a hidden buyer profile", async () => {
    expect(await queries.getBuyer(ids.hiddenBuyer, await user(ids.seller))).toBeNull();
    expect(await queries.getBuyer(ids.hiddenBuyer, await user(ids.manager))).not.toBeNull();
  });
});
