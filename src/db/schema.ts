import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Money is stored as integer cents in USD. SQLite has no decimal type and
 * floats lose precision on deal-sized numbers, so every amount in the schema
 * is `*Cents` and formatting happens at the edge (src/domain/money.ts).
 *
 * Multi-value fields (sectors, jurisdictions, deal types) are stored as JSON
 * text. SQLite has no array type; a join table per attribute would be more
 * normalised but these lists are short, always read as a whole, and never
 * filtered in SQL — filtering happens in the query layer over a small result
 * set. See README "Data model" for the trade-off.
 */

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: text("role", { enum: ["BUYER", "SELLER", "MANAGER"] }).notNull(),
    status: text("status", { enum: ["ACTIVE", "SUSPENDED", "REMOVED"] })
      .notNull()
      .default("ACTIVE"),
    /** Reason recorded by a manager when suspending or removing the account. */
    statusReason: text("status_reason"),
    statusChangedAt: text("status_changed_at"),
    locale: text("locale", { enum: ["en", "uk"] }).notNull().default("en"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email), index("users_role_idx").on(t.role, t.status)],
);

export const sellerProfiles = sqliteTable("seller_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  company: text("company").notNull(),
  country: text("country").notNull(),
  website: text("website"),
  about: text("about").notNull().default(""),
  verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  dealsClosed: integer("deals_closed").notNull().default(0),
});

export const buyerProfiles = sqliteTable(
  "buyer_profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    headline: text("headline").notNull().default(""),
    about: text("about").notNull().default(""),
    country: text("country").notNull().default(""),
    investorType: text("investor_type", {
      enum: ["STRATEGIC", "PE_VC", "FAMILY_OFFICE", "ANGEL", "SEARCH_FUND"],
    })
      .notNull()
      .default("STRATEGIC"),
    ticketMinCents: integer("ticket_min_cents").notNull().default(0),
    ticketMaxCents: integer("ticket_max_cents").notNull().default(0),
    /** JSON string[] — see note at top of file. */
    sectors: text("sectors").notNull().default("[]"),
    jurisdictions: text("jurisdictions").notNull().default("[]"),
    dealTypes: text("deal_types").notNull().default("[]"),
    timeline: text("timeline", { enum: ["NOW", "3_MONTHS", "6_MONTHS", "EXPLORING"] })
      .notNull()
      .default("EXPLORING"),
    proofOfFunds: integer("proof_of_funds", { mode: "boolean" }).notNull().default(false),
    /** Buyers can hide themselves from the seller-facing directory. */
    listedInDirectory: integer("listed_in_directory", { mode: "boolean" })
      .notNull()
      .default(true),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [index("buyer_directory_idx").on(t.listedInDirectory)],
);

export const assets = sqliteTable(
  "assets",
  {
    id: text("id").primaryKey(),
    /** Human-facing reference shown on cards, mirrors N5Deal's "Asset ID #814". */
    reference: text("reference").notNull(),
    sellerId: text("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    description: text("description").notNull().default(""),
    sector: text("sector", {
      enum: ["BANK", "FINTECH", "PAYMENT", "EMI", "CRYPTO", "LENDING", "WEALTH"],
    }).notNull(),
    country: text("country").notNull(),
    jurisdiction: text("jurisdiction").notNull().default(""),
    licenseType: text("license_type").notNull().default(""),
    businessStatus: text("business_status", {
      enum: ["ACTIVE", "LICENSE_ONLY", "PRE_REVENUE"],
    })
      .notNull()
      .default("ACTIVE"),
    dealType: text("deal_type", {
      enum: ["FULL_SALE", "MAJORITY", "MINORITY", "ASSET_PURCHASE"],
    })
      .notNull()
      .default("FULL_SALE"),
    stakeOffered: integer("stake_offered").notNull().default(100),
    askingPriceCents: integer("asking_price_cents").notNull().default(0),
    revenueCents: integer("revenue_cents").notNull().default(0),
    ebitdaCents: integer("ebitda_cents").notNull().default(0),
    employees: integer("employees").notNull().default(0),
    foundedYear: integer("founded_year"),
    status: text("status", {
      enum: ["DRAFT", "PUBLISHED", "UNDER_OFFER", "SOLD", "SUSPENDED"],
    })
      .notNull()
      .default("DRAFT"),
    statusReason: text("status_reason"),
    views: integer("views").notNull().default(0),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("assets_reference_idx").on(t.reference),
    index("assets_status_idx").on(t.status, t.sector),
    index("assets_seller_idx").on(t.sellerId),
  ],
);

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    /** Null when a seller opens a conversation from the buyer directory. */
    assetId: text("asset_id").references(() => assets.id, { onDelete: "set null" }),
    buyerId: text("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sellerId: text("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedBy: text("started_by", { enum: ["BUYER", "SELLER"] }).notNull(),
    createdAt: text("created_at").notNull().default(now),
    lastMessageAt: text("last_message_at").notNull().default(now),
  },
  (t) => [
    /** One thread per (buyer, seller, asset) keeps the inbox from fragmenting. */
    uniqueIndex("conversations_pair_idx").on(t.buyerId, t.sellerId, t.assetId),
    index("conversations_buyer_idx").on(t.buyerId, t.lastMessageAt),
    index("conversations_seller_idx").on(t.sellerId, t.lastMessageAt),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull().default(now),
    readAt: text("read_at"),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

export const savedAssets = sqliteTable(
  "saved_assets",
  {
    buyerId: text("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.buyerId, t.assetId] })],
);

/** Append-only audit trail. Managers never hard-delete, so actions stay reviewable. */
export const moderationLog = sqliteTable(
  "moderation_log",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id),
    targetType: text("target_type", { enum: ["USER", "ASSET"] }).notNull(),
    targetId: text("target_id").notNull(),
    targetLabel: text("target_label").notNull(),
    action: text("action", {
      enum: ["SUSPEND", "REINSTATE", "REMOVE", "UNLIST_ASSET", "RELIST_ASSET"],
    }).notNull(),
    reason: text("reason").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("moderation_created_idx").on(t.createdAt)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(now),
    expiresAt: text("expires_at").notNull(),
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
