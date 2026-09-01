import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Money is stored as integer USD cents in `bigint` columns. Postgres `integer`
 * tops out near 2.1e9, which a $60M mandate in cents overflows, and floats lose
 * precision at deal sizes. Formatting happens at the edge (src/domain/money.ts).
 *
 * Multi-value fields (sectors, jurisdictions, deal types) are stored as JSON
 * text. A join table per attribute would be more normalised; these lists are
 * short, always read as a whole, and filtered over a small result set in the
 * query layer. See README "Data model" for the trade-off.
 */

/** USD cents. Postgres `integer` is too narrow for the amounts this market trades. */
const cents = (name: string) => bigint(name, { mode: "number" });

/** ISO-8601 strings in and out, so ordering and formatting stay string-based. */
const moment = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });

export const userRole = pgEnum("user_role", ["BUYER", "SELLER", "MANAGER"]);
export const userStatus = pgEnum("user_status", ["ACTIVE", "SUSPENDED", "REMOVED"]);
export const locale = pgEnum("locale", ["en", "uk"]);
export const investorType = pgEnum("investor_type", [
  "STRATEGIC",
  "PE_VC",
  "FAMILY_OFFICE",
  "ANGEL",
  "SEARCH_FUND",
]);
export const timeline = pgEnum("timeline", ["NOW", "3_MONTHS", "6_MONTHS", "EXPLORING"]);
export const sector = pgEnum("sector", [
  "BANK",
  "FINTECH",
  "PAYMENT",
  "EMI",
  "CRYPTO",
  "LENDING",
  "WEALTH",
]);
export const businessStatus = pgEnum("business_status", [
  "ACTIVE",
  "LICENSE_ONLY",
  "PRE_REVENUE",
]);
export const dealType = pgEnum("deal_type", [
  "FULL_SALE",
  "MAJORITY",
  "MINORITY",
  "ASSET_PURCHASE",
]);
export const assetStatus = pgEnum("asset_status", [
  "DRAFT",
  "PUBLISHED",
  "UNDER_OFFER",
  "SOLD",
  "SUSPENDED",
]);
export const startedBy = pgEnum("started_by", ["BUYER", "SELLER"]);
export const moderationTarget = pgEnum("moderation_target", ["USER", "ASSET"]);
export const moderationAction = pgEnum("moderation_action", [
  "SUSPEND",
  "REINSTATE",
  "REMOVE",
  "UNLIST_ASSET",
  "RELIST_ASSET",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: userRole("role").notNull(),
    status: userStatus("status").notNull().default("ACTIVE"),
    /** Reason recorded by a manager when suspending or removing the account. */
    statusReason: text("status_reason"),
    statusChangedAt: moment("status_changed_at"),
    locale: locale("locale").notNull().default("en"),
    createdAt: moment("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
    index("users_role_idx").on(t.role, t.status),
  ],
);

export const sellerProfiles = pgTable("seller_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  company: text("company").notNull(),
  country: text("country").notNull(),
  website: text("website"),
  about: text("about").notNull().default(""),
  verified: boolean("verified").notNull().default(false),
  dealsClosed: integer("deals_closed").notNull().default(0),
});

export const buyerProfiles = pgTable(
  "buyer_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    headline: text("headline").notNull().default(""),
    about: text("about").notNull().default(""),
    country: text("country").notNull().default(""),
    investorType: investorType("investor_type").notNull().default("STRATEGIC"),
    ticketMinCents: cents("ticket_min_cents").notNull().default(0),
    ticketMaxCents: cents("ticket_max_cents").notNull().default(0),
    /** JSON string[] — see note at top of file. */
    sectors: text("sectors").notNull().default("[]"),
    jurisdictions: text("jurisdictions").notNull().default("[]"),
    dealTypes: text("deal_types").notNull().default("[]"),
    timeline: timeline("timeline").notNull().default("EXPLORING"),
    proofOfFunds: boolean("proof_of_funds").notNull().default(false),
    /** Buyers can hide themselves from the seller-facing directory. */
    listedInDirectory: boolean("listed_in_directory").notNull().default(true),
    updatedAt: moment("updated_at").notNull().defaultNow(),
  },
  (t) => [index("buyer_directory_idx").on(t.listedInDirectory)],
);

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey(),
    /** Human-facing reference shown on cards, mirrors N5Deal's "Asset ID #814". */
    reference: text("reference").notNull(),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    description: text("description").notNull().default(""),
    sector: sector("sector").notNull(),
    country: text("country").notNull(),
    jurisdiction: text("jurisdiction").notNull().default(""),
    licenseType: text("license_type").notNull().default(""),
    businessStatus: businessStatus("business_status").notNull().default("ACTIVE"),
    dealType: dealType("deal_type").notNull().default("FULL_SALE"),
    stakeOffered: integer("stake_offered").notNull().default(100),
    askingPriceCents: cents("asking_price_cents").notNull().default(0),
    revenueCents: cents("revenue_cents").notNull().default(0),
    ebitdaCents: cents("ebitda_cents").notNull().default(0),
    employees: integer("employees").notNull().default(0),
    foundedYear: integer("founded_year"),
    status: assetStatus("status").notNull().default("DRAFT"),
    statusReason: text("status_reason"),
    views: integer("views").notNull().default(0),
    createdAt: moment("created_at").notNull().defaultNow(),
    updatedAt: moment("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("assets_reference_idx").on(t.reference),
    index("assets_status_idx").on(t.status, t.sector),
    index("assets_seller_idx").on(t.sellerId),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey(),
    /** Null when a seller opens a conversation from the buyer directory. */
    assetId: uuid("asset_id").references(() => assets.id, { onDelete: "set null" }),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedBy: startedBy("started_by").notNull(),
    createdAt: moment("created_at").notNull().defaultNow(),
    lastMessageAt: moment("last_message_at").notNull().defaultNow(),
  },
  (t) => [
    /**
     * One thread per (buyer, seller, asset) keeps the inbox from fragmenting.
     * Postgres treats NULLs as distinct in a unique index, so the asset-less
     * case is pinned separately with a partial index below.
     */
    uniqueIndex("conversations_pair_idx")
      .on(t.buyerId, t.sellerId, t.assetId)
      .where(sql`${t.assetId} is not null`),
    uniqueIndex("conversations_pair_no_asset_idx")
      .on(t.buyerId, t.sellerId)
      .where(sql`${t.assetId} is null`),
    index("conversations_buyer_idx").on(t.buyerId, t.lastMessageAt),
    index("conversations_seller_idx").on(t.sellerId, t.lastMessageAt),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: moment("created_at").notNull().defaultNow(),
    readAt: moment("read_at"),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

export const savedAssets = pgTable(
  "saved_assets",
  {
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    createdAt: moment("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.buyerId, t.assetId] })],
);

/** Append-only audit trail. Managers never hard-delete, so actions stay reviewable. */
export const moderationLog = pgTable(
  "moderation_log",
  {
    id: uuid("id").primaryKey(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    targetType: moderationTarget("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    targetLabel: text("target_label").notNull(),
    action: moderationAction("action").notNull(),
    reason: text("reason").notNull(),
    createdAt: moment("created_at").notNull().defaultNow(),
  },
  (t) => [index("moderation_created_idx").on(t.createdAt)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: moment("created_at").notNull().defaultNow(),
    expiresAt: moment("expires_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export type User = typeof users.$inferSelect;
export type SellerProfile = typeof sellerProfiles.$inferSelect;
export type BuyerProfile = typeof buyerProfiles.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type ModerationEntry = typeof moderationLog.$inferSelect;
