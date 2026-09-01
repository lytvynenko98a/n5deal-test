import "server-only";

import { and, count, desc, eq, gte, inArray, like, lte, ne, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
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

function assetQuery() {
  return db
    .select({ asset: assets, seller: users, sellerProfile: sellerProfiles })
    .from(assets)
    .innerJoin(users, eq(users.id, assets.sellerId))
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, assets.sellerId));
}

export function getBuyerProfile(userId: string): BuyerView | null {
  const row = db
    .select({ user: users, profile: buyerProfiles })
    .from(buyerProfiles)
    .innerJoin(users, eq(users.id, buyerProfiles.userId))
    .where(eq(buyerProfiles.userId, userId))
    .get();
  return row ? toBuyerView(row.user, row.profile) : null;
}

export function getSellerProfile(userId: string) {
  return (
    db.select().from(sellerProfiles).where(eq(sellerProfiles.userId, userId)).get() ?? null
  );
}

export type ScoredAsset = AssetView & { match: MatchResult | null; saved: boolean };

export function listAssets(
  filters: AssetFilters,
  viewer: Viewer,
  options: { limit?: number; statuses?: Array<Asset["status"]> } = {},
): { rows: ScoredAsset[]; total: number } {
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
    // SQLite LIKE is case-insensitive for ASCII, which covers the demo corpus.
    const needle = `%${filters.q.trim()}%`;
    conditions.push(
      or(
        like(assets.title, needle),
        like(assets.summary, needle),
        like(assets.description, needle),
        like(assets.reference, needle),
        like(assets.licenseType, needle),
        like(assets.jurisdiction, needle),
      )!,
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const rows = assetQuery().where(where).all();

  const buyer = viewer?.role === "BUYER" ? getBuyerProfile(viewer.id) : null;
  const savedIds =
    viewer?.role === "BUYER"
      ? new Set(
          db
            .select({ assetId: savedAssets.assetId })
            .from(savedAssets)
            .where(eq(savedAssets.buyerId, viewer.id))
            .all()
            .map((r) => r.assetId),
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
      // fresher listing wins the tie rather than whatever SQLite returned first.
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

export function getAsset(id: string, viewer: Viewer): ScoredAsset | null {
  const row = assetQuery()
    .where(and(eq(assets.id, id), visibilityFilter(viewer)))
    .get();
  if (!row) return null;

  const buyer = viewer?.role === "BUYER" ? getBuyerProfile(viewer.id) : null;
  const saved =
    viewer?.role === "BUYER"
      ? Boolean(
          db
            .select({ assetId: savedAssets.assetId })
            .from(savedAssets)
            .where(and(eq(savedAssets.buyerId, viewer.id), eq(savedAssets.assetId, id)))
            .get(),
        )
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
export function similarAssets(asset: Asset, viewer: Viewer, limit = 3): ScoredAsset[] {
  const rows = assetQuery()
    .where(
      and(
        visibilityFilter(viewer),
        ne(assets.id, asset.id),
        or(eq(assets.sector, asset.sector), eq(assets.country, asset.country)),
      ),
    )
    .all();

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

export function listSellerAssets(sellerId: string): Asset[] {
  return db
    .select()
    .from(assets)
    .where(eq(assets.sellerId, sellerId))
    .orderBy(desc(assets.updatedAt))
    .all();
}

export type ScoredBuyer = BuyerView & { match: MatchResult | null; unreadFromThem: number };

export function listBuyers(
  filters: BuyerFilters,
  viewer: Viewer,
  matchAgainst?: Asset | null,
): { rows: ScoredBuyer[]; total: number } {
  const conditions = [eq(users.role, "BUYER")];

  if (viewer?.role !== "MANAGER") {
    conditions.push(eq(users.status, "ACTIVE"));
    conditions.push(eq(buyerProfiles.listedInDirectory, true));
  }

  if (filters.q.trim()) {
    const needle = `%${filters.q.trim()}%`;
    conditions.push(
      or(
        like(users.name, needle),
        like(buyerProfiles.headline, needle),
        like(buyerProfiles.about, needle),
        like(buyerProfiles.country, needle),
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

  const rows = db
    .select({ user: users, profile: buyerProfiles })
    .from(buyerProfiles)
    .innerJoin(users, eq(users.id, buyerProfiles.userId))
    .where(and(...conditions))
    .all()
    .map((r) => toBuyerView(r.user, r.profile));

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
    unreadFromThem: 0,
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

export function getBuyer(id: string, viewer: Viewer): BuyerView | null {
  const row = db
    .select({ user: users, profile: buyerProfiles })
    .from(buyerProfiles)
    .innerJoin(users, eq(users.id, buyerProfiles.userId))
    .where(eq(buyerProfiles.userId, id))
    .get();
  if (!row) return null;

  const isSelf = viewer?.id === id;
  if (viewer?.role !== "MANAGER" && !isSelf) {
    if (row.user.status !== "ACTIVE" || !row.profile.listedInDirectory) return null;
  }
  return toBuyerView(row.user, row.profile);
}

export function getSavedAssets(buyerId: string): AssetView[] {
  return db
    .select({ asset: assets, seller: users, sellerProfile: sellerProfiles })
    .from(savedAssets)
    .innerJoin(assets, eq(assets.id, savedAssets.assetId))
    .innerJoin(users, eq(users.id, assets.sellerId))
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, assets.sellerId))
    .where(eq(savedAssets.buyerId, buyerId))
    .orderBy(desc(savedAssets.createdAt))
    .all();
}

export type ThreadSummary = {
  id: string;
  asset: Asset | null;
  counterparty: User;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
};

export function listThreads(user: User): ThreadSummary[] {
  const isBuyer = user.role === "BUYER";
  const rows = db
    .select({ conversation: conversations, asset: assets })
    .from(conversations)
    .leftJoin(assets, eq(assets.id, conversations.assetId))
    .where(isBuyer ? eq(conversations.buyerId, user.id) : eq(conversations.sellerId, user.id))
    .orderBy(desc(conversations.lastMessageAt))
    .all();

  return rows.map((row) => {
    const counterpartyId = isBuyer ? row.conversation.sellerId : row.conversation.buyerId;
    const counterparty = db.select().from(users).where(eq(users.id, counterpartyId)).get()!;
    const last = db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, row.conversation.id))
      .orderBy(desc(messages.createdAt))
      .get();
    const unread = db
      .select({ n: count() })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, row.conversation.id),
          ne(messages.senderId, user.id),
          sql`${messages.readAt} is null`,
        ),
      )
      .get();

    return {
      id: row.conversation.id,
      asset: row.asset,
      counterparty,
      lastMessage: last?.body ?? "",
      lastMessageAt: row.conversation.lastMessageAt,
      unread: unread?.n ?? 0,
    };
  });
}

export function getThread(id: string, user: User) {
  const conversation = db.select().from(conversations).where(eq(conversations.id, id)).get();
  if (!conversation) return null;
  if (conversation.buyerId !== user.id && conversation.sellerId !== user.id) return null;

  const counterpartyId =
    conversation.buyerId === user.id ? conversation.sellerId : conversation.buyerId;

  return {
    conversation,
    counterparty: db.select().from(users).where(eq(users.id, counterpartyId)).get()!,
    asset: conversation.assetId
      ? (db.select().from(assets).where(eq(assets.id, conversation.assetId)).get() ?? null)
      : null,
    messages: db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt)
      .all(),
  };
}

export function findThread(buyerId: string, sellerId: string, assetId: string | null) {
  return (
    db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.buyerId, buyerId),
          eq(conversations.sellerId, sellerId),
          assetId ? eq(conversations.assetId, assetId) : sql`${conversations.assetId} is null`,
        ),
      )
      .get() ?? null
  );
}

export function unreadCount(user: User): number {
  const owned = db
    .select({ id: conversations.id })
    .from(conversations)
    .where(user.role === "BUYER" ? eq(conversations.buyerId, user.id) : eq(conversations.sellerId, user.id))
    .all()
    .map((r) => r.id);
  if (!owned.length) return 0;

  const row = db
    .select({ n: count() })
    .from(messages)
    .where(
      and(
        inArray(messages.conversationId, owned),
        ne(messages.senderId, user.id),
        sql`${messages.readAt} is null`,
      ),
    )
    .get();
  return row?.n ?? 0;
}

/* ------------------------------------------------------------------ *
 * Manager views
 * ------------------------------------------------------------------ */

export function moderationStats() {
  const one = <T,>(value: T | undefined, fallback: T) => value ?? fallback;

  return {
    buyers: one(
      db.select({ n: count() }).from(users).where(eq(users.role, "BUYER")).get()?.n,
      0,
    ),
    sellers: one(
      db.select({ n: count() }).from(users).where(eq(users.role, "SELLER")).get()?.n,
      0,
    ),
    liveAssets: one(
      db.select({ n: count() }).from(assets).where(eq(assets.status, "PUBLISHED")).get()?.n,
      0,
    ),
    suspended:
      one(db.select({ n: count() }).from(users).where(eq(users.status, "SUSPENDED")).get()?.n, 0) +
      one(db.select({ n: count() }).from(assets).where(eq(assets.status, "SUSPENDED")).get()?.n, 0),
    threads: one(db.select({ n: count() }).from(conversations).get()?.n, 0),
  };
}

export function adminParticipants(q: string, role: string, status: string) {
  const conditions = [ne(users.role, "MANAGER")];
  if (role) conditions.push(eq(users.role, role as "BUYER"));
  if (status) conditions.push(eq(users.status, status as "ACTIVE"));

  const rows = db
    .select({ user: users, seller: sellerProfiles, buyer: buyerProfiles })
    .from(users)
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, users.id))
    .leftJoin(buyerProfiles, eq(buyerProfiles.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(users.createdAt))
    .all();

  const needle = q.trim().toLowerCase();
  if (!needle) return rows;

  return rows.filter((row) =>
    [row.user.name, row.user.email, row.seller?.company, row.buyer?.headline]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(needle)),
  );
}

export function adminAssets(q: string, status: string) {
  const rows = db
    .select({ asset: assets, seller: users })
    .from(assets)
    .innerJoin(users, eq(users.id, assets.sellerId))
    .where(status ? eq(assets.status, status as "PUBLISHED") : undefined)
    .orderBy(desc(assets.createdAt))
    .all();

  const needle = q.trim().toLowerCase();
  if (!needle) return rows;

  return rows.filter((row) =>
    [row.asset.title, row.asset.reference, row.seller.name]
      .some((value) => value.toLowerCase().includes(needle)),
  );
}

export function auditTrail(limit = 100) {
  return db
    .select({ entry: moderationLog, actor: users })
    .from(moderationLog)
    .innerJoin(users, eq(users.id, moderationLog.actorId))
    .orderBy(desc(moderationLog.createdAt))
    .limit(limit)
    .all();
}

/** Accounts offered on the demo sign-in screen. */
export function demoAccounts() {
  return db
    .select({ user: users, seller: sellerProfiles, buyer: buyerProfiles })
    .from(users)
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, users.id))
    .leftJoin(buyerProfiles, eq(buyerProfiles.userId, users.id))
    .orderBy(users.role, users.name)
    .all();
}

export function publicStats() {
  return {
    assets:
      db
        .select({ n: count() })
        .from(assets)
        .where(inArray(assets.status, ["PUBLISHED", "UNDER_OFFER"]))
        .get()?.n ?? 0,
    buyers:
      db
        .select({ n: count() })
        .from(buyerProfiles)
        .innerJoin(users, eq(users.id, buyerProfiles.userId))
        .where(and(eq(users.status, "ACTIVE"), eq(buyerProfiles.listedInDirectory, true)))
        .get()?.n ?? 0,
  };
}
