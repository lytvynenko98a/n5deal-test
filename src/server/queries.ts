import "server-only";

import { and, count, desc, eq, gte, inArray, like, lte, ne, or, sql } from "drizzle-orm";

import { getDb, type Database } from "@/db/client";
import {
  assets,
  buyerProfiles,
  conversations,
  messages,
  moderationLog,
  savedAssets,
  sellerProfiles,
  users,
  type Asset,
  type User,
} from "@/db/schema";
import { scoreMatch, type MatchResult } from "@/domain/matching";
import type { AssetFilters, BuyerFilters } from "@/domain/search";
import type { Sector } from "@/domain/taxonomy";
import { toBuyerView, type AssetView, type BuyerView } from "./mappers";

/**
 * Read model for the whole app.
 *
 * Visibility is decided here rather than in each page, because "who can see a
 * suspended listing" is the kind of rule that drifts once three pages answer it
 * separately. Every asset query goes through `visibilityFilter`.
 */

/** Statuses the public marketplace shows. Sold listings stay up as price comparables. */
const PUBLIC_ASSET_STATUSES = ["PUBLISHED", "UNDER_OFFER", "SOLD"] as const;

type Viewer = User | null;

function visibilityFilter(viewer: Viewer) {
  if (viewer?.role === "MANAGER") return undefined;

  const publicOnly = and(
    inArray(assets.status, [...PUBLIC_ASSET_STATUSES]),
    eq(users.status, "ACTIVE"),
  );

  // A seller always sees their own listings, including drafts and suspensions.
  if (viewer?.role === "SELLER") {
    return or(publicOnly, eq(assets.sellerId, viewer.id));
  }
  return publicOnly;
}

function assetQuery(db: Database) {
  return db
    .select({ asset: assets, seller: users, sellerProfile: sellerProfiles })
    .from(assets)
    .innerJoin(users, eq(users.id, assets.sellerId))
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, assets.sellerId));
}

export async function getBuyerProfile(userId: string): Promise<BuyerView | null> {
  const db = await getDb();
  const [row] = await db
    .select({ user: users, profile: buyerProfiles })
    .from(buyerProfiles)
    .innerJoin(users, eq(users.id, buyerProfiles.userId))
    .where(eq(buyerProfiles.userId, userId));
  return row ? toBuyerView(row.user, row.profile) : null;
}

export async function getSellerProfile(userId: string) {
  const db = await getDb();
  const [row] = await db.select().from(sellerProfiles).where(eq(sellerProfiles.userId, userId));
  return row ?? null;
}

export type ScoredAsset = AssetView & { match: MatchResult | null; saved: boolean };

export async function listAssets(
  filters: AssetFilters,
  viewer: Viewer,
  options: { limit?: number; statuses?: Array<Asset["status"]> } = {},
): Promise<{ rows: ScoredAsset[]; total: number }> {
  const db = await getDb();
  const conditions = [visibilityFilter(viewer)].filter(Boolean);

  if (options.statuses?.length) conditions.push(inArray(assets.status, options.statuses));
  if (filters.sectors.length) conditions.push(inArray(assets.sector, filters.sectors));
  if (filters.countries.length) conditions.push(inArray(assets.country, filters.countries));
  if (filters.businessStatuses.length) {
    conditions.push(inArray(assets.businessStatus, filters.businessStatuses));
  }
  if (filters.dealTypes.length) conditions.push(inArray(assets.dealType, filters.dealTypes));
  if (filters.minPriceCents) conditions.push(gte(assets.askingPriceCents, filters.minPriceCents));
  if (filters.maxPriceCents) conditions.push(lte(assets.askingPriceCents, filters.maxPriceCents));

  if (filters.q.trim()) {
    // ILIKE keeps the free-text match case-insensitive without a functional index.
    const needle = `%${filters.q.trim()}%`;
    const ci = (column: Parameters<typeof like>[0]) => sql`${column} ilike ${needle}`;
    conditions.push(
      or(
        ci(assets.title),
        ci(assets.summary),
        ci(assets.description),
        ci(assets.reference),
        ci(assets.licenseType),
        ci(assets.jurisdiction),
      )!,
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const rows = await assetQuery(db).where(where);

  const buyer = viewer?.role === "BUYER" ? await getBuyerProfile(viewer.id) : null;
  const savedIds =
    viewer?.role === "BUYER"
      ? new Set(
          (
            await db
              .select({ assetId: savedAssets.assetId })
              .from(savedAssets)
              .where(eq(savedAssets.buyerId, viewer.id))
          ).map((r) => r.assetId),
        )
      : new Set<string>();

  const scored: ScoredAsset[] = rows.map((row) => ({
    asset: row.asset,
    seller: row.seller,
    sellerProfile: row.sellerProfile,
    saved: savedIds.has(row.asset.id),
    match: buyer ? scoreMatch({ buyer: mandateOf(buyer), asset: assetMandate(row.asset) }) : null,
  }));

  sortAssets(scored, filters.sort);

  return {
    rows: options.limit ? scored.slice(0, options.limit) : scored,
    total: scored.length,
  };
}

function sortAssets(rows: ScoredAsset[], sort: AssetFilters["sort"]) {
  switch (sort) {
    case "PRICE_ASC":
      rows.sort((a, b) => a.asset.askingPriceCents - b.asset.askingPriceCents);
      break;
    case "PRICE_DESC":
      rows.sort((a, b) => b.asset.askingPriceCents - a.asset.askingPriceCents);
      break;
    case "POPULAR":
      rows.sort((a, b) => b.asset.views - a.asset.views);
      break;
    case "MATCH":
      // Equal scores are common once a mandate matches on every factor, so the
      // fresher listing wins the tie rather than whatever the planner returned.
      rows.sort(
        (a, b) =>
          (b.match?.score ?? 0) - (a.match?.score ?? 0) ||
          b.asset.createdAt.localeCompare(a.asset.createdAt),
      );
      break;
    default:
      rows.sort((a, b) => b.asset.createdAt.localeCompare(a.asset.createdAt));
  }
}

export function mandateOf(buyer: BuyerView) {
  return {
    sectors: buyer.sectors,
    jurisdictions: buyer.jurisdictions,
    dealTypes: buyer.dealTypes,
    ticketMinCents: buyer.profile.ticketMinCents,
    ticketMaxCents: buyer.profile.ticketMaxCents,
    timeline: buyer.profile.timeline,
    proofOfFunds: buyer.profile.proofOfFunds,
  };
}

export function assetMandate(asset: Asset) {
  return {
    sector: asset.sector as Sector,
    country: asset.country,
    dealType: asset.dealType,
    askingPriceCents: asset.askingPriceCents,
  };
}

export async function getAsset(id: string, viewer: Viewer): Promise<ScoredAsset | null> {
  const db = await getDb();
  const [row] = await assetQuery(db).where(and(eq(assets.id, id), visibilityFilter(viewer)));
  if (!row) return null;

  const buyer = viewer?.role === "BUYER" ? await getBuyerProfile(viewer.id) : null;
  const saved =
    viewer?.role === "BUYER"
      ? (
          await db
            .select({ assetId: savedAssets.assetId })
            .from(savedAssets)
            .where(and(eq(savedAssets.buyerId, viewer.id), eq(savedAssets.assetId, id)))
        ).length > 0
      : false;

  return {
    asset: row.asset,
    seller: row.seller,
    sellerProfile: row.sellerProfile,
    saved,
    match: buyer ? scoreMatch({ buyer: mandateOf(buyer), asset: assetMandate(row.asset) }) : null,
  };
}

/** Same sector or same country, cheapest signal that avoids an empty panel. */
export async function similarAssets(
  asset: Asset,
  viewer: Viewer,
  limit = 3,
): Promise<ScoredAsset[]> {
  const db = await getDb();
  const rows = await assetQuery(db).where(
    and(
      visibilityFilter(viewer),
      ne(assets.id, asset.id),
      or(eq(assets.sector, asset.sector), eq(assets.country, asset.country)),
    ),
  );

  return rows
    .map((row) => ({
      asset: row.asset,
      seller: row.seller,
      sellerProfile: row.sellerProfile,
      saved: false,
      match: null,
      affinity:
        (row.asset.sector === asset.sector ? 2 : 0) + (row.asset.country === asset.country ? 1 : 0),
    }))
    .sort((a, b) => b.affinity - a.affinity || b.asset.views - a.asset.views)
    .slice(0, limit);
}

export async function listSellerAssets(sellerId: string): Promise<Asset[]> {
  const db = await getDb();
  return db.select().from(assets).where(eq(assets.sellerId, sellerId)).orderBy(desc(assets.updatedAt));
}

export type ScoredBuyer = BuyerView & { match: MatchResult | null };

export async function listBuyers(
  filters: BuyerFilters,
  viewer: Viewer,
  matchAgainst?: Asset | null,
): Promise<{ rows: ScoredBuyer[]; total: number }> {
  const db = await getDb();
  const conditions = [eq(users.role, "BUYER")];

  if (viewer?.role !== "MANAGER") {
    conditions.push(eq(users.status, "ACTIVE"));
    conditions.push(eq(buyerProfiles.listedInDirectory, true));
  }

  if (filters.q.trim()) {
    const needle = `%${filters.q.trim()}%`;
    const ci = (column: Parameters<typeof like>[0]) => sql`${column} ilike ${needle}`;
    conditions.push(
      or(
        ci(users.name),
        ci(buyerProfiles.headline),
        ci(buyerProfiles.about),
        ci(buyerProfiles.country),
      )!,
    );
  }
  if (filters.investorTypes.length) {
    conditions.push(
      inArray(buyerProfiles.investorType, filters.investorTypes as ("STRATEGIC" | "PE_VC")[]),
    );
  }
  if (filters.timelines.length) {
    conditions.push(inArray(buyerProfiles.timeline, filters.timelines as ("NOW" | "3_MONTHS")[]));
  }
  if (filters.proofOfFundsOnly) conditions.push(eq(buyerProfiles.proofOfFunds, true));
  if (filters.minTicketCents) {
    conditions.push(gte(buyerProfiles.ticketMaxCents, filters.minTicketCents));
  }

  const rows = (
    await db
      .select({ user: users, profile: buyerProfiles })
      .from(buyerProfiles)
      .innerJoin(users, eq(users.id, buyerProfiles.userId))
      .where(and(...conditions))
  ).map((r) => toBuyerView(r.user, r.profile));

  // Sector and jurisdiction live in JSON columns, so they filter in memory.
  const filtered = rows.filter((buyer) => {
    if (filters.sectors.length && !filters.sectors.some((s) => buyer.sectors.includes(s))) {
      return false;
    }
    if (
      filters.jurisdictions.length &&
      !filters.jurisdictions.some((j) => buyer.jurisdictions.includes(j))
    ) {
      return false;
    }
    return true;
  });

  const scored: ScoredBuyer[] = filtered.map((buyer) => ({
    ...buyer,
    match: matchAgainst
      ? scoreMatch({ buyer: mandateOf(buyer), asset: assetMandate(matchAgainst) })
      : null,
  }));

  switch (filters.sort) {
    case "TICKET_DESC":
      scored.sort((a, b) => b.profile.ticketMaxCents - a.profile.ticketMaxCents);
      break;
    case "READINESS": {
      const order = { NOW: 0, "3_MONTHS": 1, "6_MONTHS": 2, EXPLORING: 3 };
      scored.sort((a, b) => order[a.profile.timeline] - order[b.profile.timeline]);
      break;
    }
    case "MATCH":
      scored.sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0));
      break;
    default:
      scored.sort((a, b) => b.user.createdAt.localeCompare(a.user.createdAt));
  }

  return { rows: scored, total: scored.length };
}

export async function getBuyer(id: string, viewer: Viewer): Promise<BuyerView | null> {
  const db = await getDb();
  const [row] = await db
    .select({ user: users, profile: buyerProfiles })
    .from(buyerProfiles)
    .innerJoin(users, eq(users.id, buyerProfiles.userId))
    .where(eq(buyerProfiles.userId, id));
  if (!row) return null;

  const isSelf = viewer?.id === id;
  if (viewer?.role !== "MANAGER" && !isSelf) {
    if (row.user.status !== "ACTIVE" || !row.profile.listedInDirectory) return null;
  }
  return toBuyerView(row.user, row.profile);
}

export async function getSavedAssets(buyerId: string): Promise<AssetView[]> {
  const db = await getDb();
  return db
    .select({ asset: assets, seller: users, sellerProfile: sellerProfiles })
    .from(savedAssets)
    .innerJoin(assets, eq(assets.id, savedAssets.assetId))
    .innerJoin(users, eq(users.id, assets.sellerId))
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, assets.sellerId))
    .where(eq(savedAssets.buyerId, buyerId))
    .orderBy(desc(savedAssets.createdAt));
}

export type ThreadSummary = {
  id: string;
  asset: Asset | null;
  counterparty: User;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
};

export async function listThreads(user: User): Promise<ThreadSummary[]> {
  const db = await getDb();
  const isBuyer = user.role === "BUYER";

  const rows = await db
    .select({ conversation: conversations, asset: assets, counterparty: users })
    .from(conversations)
    .leftJoin(assets, eq(assets.id, conversations.assetId))
    .innerJoin(
      users,
      eq(users.id, isBuyer ? conversations.sellerId : conversations.buyerId),
    )
    .where(isBuyer ? eq(conversations.buyerId, user.id) : eq(conversations.sellerId, user.id))
    .orderBy(desc(conversations.lastMessageAt));

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.conversation.id);

  // One pass for the newest message per thread and one for the unread counts,
  // rather than two queries per row.
  const latest = await db
    .select({
      conversationId: messages.conversationId,
      body: messages.body,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(inArray(messages.conversationId, ids))
    .orderBy(messages.conversationId, desc(messages.createdAt));

  const newest = new Map<string, string>();
  for (const row of latest) {
    if (!newest.has(row.conversationId)) newest.set(row.conversationId, row.body);
  }

  const unreadRows = await db
    .select({ conversationId: messages.conversationId, n: count() })
    .from(messages)
    .where(
      and(
        inArray(messages.conversationId, ids),
        ne(messages.senderId, user.id),
        sql`${messages.readAt} is null`,
      ),
    )
    .groupBy(messages.conversationId);

  const unread = new Map(unreadRows.map((r) => [r.conversationId, r.n]));

  return rows.map((row) => ({
    id: row.conversation.id,
    asset: row.asset,
    counterparty: row.counterparty,
    lastMessage: newest.get(row.conversation.id) ?? "",
    lastMessageAt: row.conversation.lastMessageAt,
    unread: unread.get(row.conversation.id) ?? 0,
  }));
}

export async function getThread(id: string, user: User) {
  const db = await getDb();
  const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!conversation) return null;
  if (conversation.buyerId !== user.id && conversation.sellerId !== user.id) return null;

  const counterpartyId =
    conversation.buyerId === user.id ? conversation.sellerId : conversation.buyerId;

  const [counterparty] = await db.select().from(users).where(eq(users.id, counterpartyId));
  const asset = conversation.assetId
    ? (await db.select().from(assets).where(eq(assets.id, conversation.assetId)))[0] ?? null
    : null;

  return {
    conversation,
    counterparty,
    asset,
    messages: await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt),
  };
}

export async function findThread(buyerId: string, sellerId: string, assetId: string | null) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.buyerId, buyerId),
        eq(conversations.sellerId, sellerId),
        assetId ? eq(conversations.assetId, assetId) : sql`${conversations.assetId} is null`,
      ),
    );
  return row ?? null;
}

export async function unreadCount(user: User): Promise<number> {
  const db = await getDb();
  const owned = (
    await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        user.role === "BUYER"
          ? eq(conversations.buyerId, user.id)
          : eq(conversations.sellerId, user.id),
      )
  ).map((r) => r.id);
  if (!owned.length) return 0;

  const [row] = await db
    .select({ n: count() })
    .from(messages)
    .where(
      and(
        inArray(messages.conversationId, owned),
        ne(messages.senderId, user.id),
        sql`${messages.readAt} is null`,
      ),
    );
  return row?.n ?? 0;
}

/* ------------------------------------------------------------------ *
 * Manager views
 * ------------------------------------------------------------------ */

export async function moderationStats() {
  const db = await getDb();
  const [row] = await db
    .select({
      buyers: sql<number>`count(*) filter (where ${users.role} = 'BUYER')`.mapWith(Number),
      sellers: sql<number>`count(*) filter (where ${users.role} = 'SELLER')`.mapWith(Number),
      suspendedUsers: sql<number>`count(*) filter (where ${users.status} = 'SUSPENDED')`.mapWith(
        Number,
      ),
    })
    .from(users);

  const [assetRow] = await db
    .select({
      live: sql<number>`count(*) filter (where ${assets.status} = 'PUBLISHED')`.mapWith(Number),
      suspended: sql<number>`count(*) filter (where ${assets.status} = 'SUSPENDED')`.mapWith(
        Number,
      ),
    })
    .from(assets);

  const [threadRow] = await db.select({ n: count() }).from(conversations);

  return {
    buyers: row?.buyers ?? 0,
    sellers: row?.sellers ?? 0,
    liveAssets: assetRow?.live ?? 0,
    suspended: (row?.suspendedUsers ?? 0) + (assetRow?.suspended ?? 0),
    threads: threadRow?.n ?? 0,
  };
}

export async function adminParticipants(q: string, role: string, status: string) {
  const db = await getDb();
  const conditions = [ne(users.role, "MANAGER")];
  if (role) conditions.push(eq(users.role, role as "BUYER"));
  if (status) conditions.push(eq(users.status, status as "ACTIVE"));

  const rows = await db
    .select({ user: users, seller: sellerProfiles, buyer: buyerProfiles })
    .from(users)
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, users.id))
    .leftJoin(buyerProfiles, eq(buyerProfiles.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(users.createdAt));

  const needle = q.trim().toLowerCase();
  if (!needle) return rows;

  return rows.filter((row) =>
    [row.user.name, row.user.email, row.seller?.company, row.buyer?.headline]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(needle)),
  );
}

export async function adminAssets(q: string, status: string) {
  const db = await getDb();
  const rows = await db
    .select({ asset: assets, seller: users })
    .from(assets)
    .innerJoin(users, eq(users.id, assets.sellerId))
    .where(status ? eq(assets.status, status as "PUBLISHED") : undefined)
    .orderBy(desc(assets.createdAt));

  const needle = q.trim().toLowerCase();
  if (!needle) return rows;

  return rows.filter((row) =>
    [row.asset.title, row.asset.reference, row.seller.name].some((value) =>
      value.toLowerCase().includes(needle),
    ),
  );
}

export async function auditTrail(limit = 100) {
  const db = await getDb();
  return db
    .select({ entry: moderationLog, actor: users })
    .from(moderationLog)
    .innerJoin(users, eq(users.id, moderationLog.actorId))
    .orderBy(desc(moderationLog.createdAt))
    .limit(limit);
}

/** Accounts offered on the demo sign-in screen. */
export async function demoAccounts() {
  const db = await getDb();
  return db
    .select({ user: users, seller: sellerProfiles, buyer: buyerProfiles })
    .from(users)
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, users.id))
    .leftJoin(buyerProfiles, eq(buyerProfiles.userId, users.id))
    .orderBy(users.role, users.name);
}

export async function publicStats() {
  const db = await getDb();
  const [assetRow] = await db
    .select({ n: count() })
    .from(assets)
    .where(inArray(assets.status, ["PUBLISHED", "UNDER_OFFER"]));

  const [buyerRow] = await db
    .select({ n: count() })
    .from(buyerProfiles)
    .innerJoin(users, eq(users.id, buyerProfiles.userId))
    .where(and(eq(users.status, "ACTIVE"), eq(buyerProfiles.listedInDirectory, true)));

  return { assets: assetRow?.n ?? 0, buyers: buyerRow?.n ?? 0 };
}
