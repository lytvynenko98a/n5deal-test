"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/client";
import {
  assets,
  buyerProfiles,
  conversations,
  messages,
  moderationLog,
  savedAssets,
  sellerProfiles,
  sessions,
  users,
} from "@/db/schema";
import { newAssetReference, newId } from "@/lib/ids";
import { getCurrentUser, requireUser, signIn, signOut } from "@/lib/session";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n";
import { draftOpener, interpretQuery } from "@/lib/ai";
import { reviewListing } from "@/domain/listing-quality";
import {
  BUSINESS_STATUSES,
  DEAL_TYPES,
  INVESTOR_TYPES,
  SECTORS,
  TIMELINES,
} from "@/domain/taxonomy";
import { findThread } from "./queries";

/**
 * Every mutation in the app. Server actions rather than REST route handlers:
 * the forms are progressively enhanced for free, and the validation schema sits
 * next to the write instead of being duplicated on both sides of a fetch.
 *
 * Each action re-reads the session on the server. A form field never decides
 * who the actor is.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ActionState = { ok: boolean; message?: string; errors?: Record<string, string> };

const money = z.coerce.number().min(0).max(100_000_000_000).default(0);
const list = (values: readonly string[]) =>
  z.array(z.enum(values as [string, ...string[]])).default([]);

/* ------------------------------ session ------------------------------ */

export async function signInAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  if (!UUID.test(userId)) redirect("/login?error=unknown");

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId));

  if (!user) redirect("/login?error=unknown");
  if (user.status !== "ACTIVE") {
    redirect(`/login?error=suspended&reason=${encodeURIComponent(user.statusReason ?? "")}`);
  }

  await signIn(user.id);
  redirect("/dashboard");
}

export async function signOutAction() {
  await signOut();
  redirect("/");
}

export async function setLocaleAction(formData: FormData) {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;

  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}

/* ------------------------------ profiles ------------------------------ */

const buyerProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  headline: z.string().trim().max(160).default(""),
  about: z.string().trim().max(4000).default(""),
  country: z.string().trim().max(2).default(""),
  investorType: z.enum(INVESTOR_TYPES),
  ticketMin: money,
  ticketMax: money,
  sectors: list(SECTORS),
  jurisdictions: z.array(z.string().max(2)).default([]),
  dealTypes: list(DEAL_TYPES),
  timeline: z.enum(TIMELINES),
  proofOfFunds: z.boolean().default(false),
  listedInDirectory: z.boolean().default(true),
});

export async function saveBuyerProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("BUYER");
  const db = await getDb();

  const parsed = buyerProfileSchema.safeParse({
    name: formData.get("name"),
    headline: formData.get("headline"),
    about: formData.get("about"),
    country: formData.get("country"),
    investorType: formData.get("investorType"),
    ticketMin: formData.get("ticketMin") || 0,
    ticketMax: formData.get("ticketMax") || 0,
    sectors: formData.getAll("sectors"),
    jurisdictions: formData.getAll("jurisdictions"),
    dealTypes: formData.getAll("dealTypes"),
    timeline: formData.get("timeline"),
    proofOfFunds: formData.get("proofOfFunds") === "on",
    listedInDirectory: formData.get("listedInDirectory") === "on",
  });

  if (!parsed.success) {
    return { ok: false, errors: flatten(parsed.error) };
  }
  const data = parsed.data;

  if (data.ticketMax && data.ticketMin > data.ticketMax) {
    return { ok: false, errors: { ticketMax: "Maximum ticket must be at or above the minimum." } };
  }

  await db.update(users).set({ name: data.name }).where(eq(users.id, user.id));
  await db.update(buyerProfiles)
    .set({
      headline: data.headline,
      about: data.about,
      country: data.country,
      investorType: data.investorType,
      ticketMinCents: Math.round(data.ticketMin * 100),
      ticketMaxCents: Math.round(data.ticketMax * 100),
      sectors: JSON.stringify(data.sectors),
      jurisdictions: JSON.stringify(data.jurisdictions),
      dealTypes: JSON.stringify(data.dealTypes),
      timeline: data.timeline,
      proofOfFunds: data.proofOfFunds,
      listedInDirectory: data.listedInDirectory,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(buyerProfiles.userId, user.id))
    ;

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true, message: "saved" };
}

const sellerProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().min(2).max(160),
  country: z.string().trim().max(2),
  website: z.string().trim().max(200).default(""),
  about: z.string().trim().max(4000).default(""),
});

export async function saveSellerProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("SELLER");
  const db = await getDb();

  const parsed = sellerProfileSchema.safeParse({
    name: formData.get("name"),
    company: formData.get("company"),
    country: formData.get("country"),
    website: formData.get("website"),
    about: formData.get("about"),
  });
  if (!parsed.success) return { ok: false, errors: flatten(parsed.error) };

  await db.update(users).set({ name: parsed.data.name }).where(eq(users.id, user.id));
  await db.update(sellerProfiles)
    .set({
      company: parsed.data.company,
      country: parsed.data.country,
      website: parsed.data.website,
      about: parsed.data.about,
    })
    .where(eq(sellerProfiles.userId, user.id))
    ;

  revalidatePath("/profile");
  return { ok: true, message: "saved" };
}

/* ------------------------------ listings ------------------------------ */

const assetSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().max(200).default(""),
  summary: z.string().trim().max(500).default(""),
  description: z.string().trim().max(20_000).default(""),
  sector: z.enum(SECTORS).or(z.literal("")),
  country: z.string().trim().max(2).default(""),
  jurisdiction: z.string().trim().max(160).default(""),
  licenseType: z.string().trim().max(160).default(""),
  businessStatus: z.enum(BUSINESS_STATUSES),
  dealType: z.enum(DEAL_TYPES),
  stakeOffered: z.coerce.number().min(1).max(100).default(100),
  askingPrice: money,
  revenue: money,
  ebitda: money,
  employees: z.coerce.number().min(0).max(1_000_000).default(0),
  foundedYear: z.union([z.coerce.number().int(), z.literal("")]).optional(),
});

export async function saveAssetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("SELLER");
  const db = await getDb();
  const intent = String(formData.get("intent") ?? "draft");

  const parsed = assetSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    summary: formData.get("summary"),
    description: formData.get("description"),
    sector: formData.get("sector") ?? "",
    country: formData.get("country"),
    jurisdiction: formData.get("jurisdiction"),
    licenseType: formData.get("licenseType"),
    businessStatus: formData.get("businessStatus"),
    dealType: formData.get("dealType"),
    stakeOffered: formData.get("stakeOffered") || 100,
    askingPrice: formData.get("askingPrice") || 0,
    revenue: formData.get("revenue") || 0,
    ebitda: formData.get("ebitda") || 0,
    employees: formData.get("employees") || 0,
    foundedYear: formData.get("foundedYear") || "",
  });
  if (!parsed.success) return { ok: false, errors: flatten(parsed.error) };

  const d = parsed.data;
  const foundedYear = typeof d.foundedYear === "number" ? d.foundedYear : null;

  const review = reviewListing({
    title: d.title,
    summary: d.summary,
    description: d.description,
    sector: d.sector,
    country: d.country,
    jurisdiction: d.jurisdiction,
    licenseType: d.licenseType,
    businessStatus: d.businessStatus,
    dealType: d.dealType,
    stakeOffered: d.stakeOffered,
    askingPriceCents: Math.round(d.askingPrice * 100),
    revenueCents: Math.round(d.revenue * 100),
    ebitdaCents: Math.round(d.ebitda * 100),
    employees: d.employees,
    foundedYear,
  });

  // The same rules that colour the review panel gate the publish button. A draft
  // can hold anything; a live listing cannot.
  if (intent === "publish" && !review.canPublish) {
    return { ok: false, message: "blocked" };
  }

  const [existing] = d.id
    ? await db.select().from(assets).where(and(eq(assets.id, d.id), eq(assets.sellerId, user.id)))
    : [null];

  if (d.id && !existing) return { ok: false, message: "notfound" };

  const values = {
    title: d.title,
    summary: d.summary,
    description: d.description,
    sector: (d.sector || "FINTECH") as (typeof SECTORS)[number],
    country: d.country,
    jurisdiction: d.jurisdiction,
    licenseType: d.licenseType,
    businessStatus: d.businessStatus,
    dealType: d.dealType,
    stakeOffered: d.stakeOffered,
    askingPriceCents: Math.round(d.askingPrice * 100),
    revenueCents: Math.round(d.revenue * 100),
    ebitdaCents: Math.round(d.ebitda * 100),
    employees: d.employees,
    foundedYear,
    updatedAt: new Date().toISOString(),
  };

  let assetId = d.id;

  if (existing) {
    // A manager's suspension outranks the seller: they cannot publish out of it.
    const nextStatus =
      existing.status === "SUSPENDED"
        ? "SUSPENDED"
        : intent === "publish"
          ? "PUBLISHED"
          : intent === "unpublish"
            ? "DRAFT"
            : existing.status;

    await db.update(assets)
      .set({ ...values, status: nextStatus })
      .where(eq(assets.id, existing.id))
      ;
  } else {
    assetId = newId();
    await db.insert(assets)
      .values({
        ...values,
        id: assetId,
        reference: newAssetReference(),
        sellerId: user.id,
        status: intent === "publish" ? "PUBLISHED" : "DRAFT",
      })
      ;
  }

  revalidatePath("/listings");
  revalidatePath("/dashboard");
  if (assetId) revalidatePath(`/listings/${assetId}`);

  if (!d.id && assetId) redirect(`/assets/${assetId}/edit?created=1`);
  return { ok: true, message: intent === "publish" ? "published" : "saved" };
}

export async function deleteAssetAction(formData: FormData) {
  const user = await requireUser("SELLER");
  const db = await getDb();
  const id = String(formData.get("id") ?? "");

  await db.delete(assets).where(and(eq(assets.id, id), eq(assets.sellerId, user.id)));

  revalidatePath("/listings");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function toggleSaveAssetAction(formData: FormData) {
  const user = await requireUser("BUYER");
  const db = await getDb();
  const assetId = String(formData.get("assetId") ?? "");

  const [existing] = await db
    .select()
    .from(savedAssets)
    .where(and(eq(savedAssets.buyerId, user.id), eq(savedAssets.assetId, assetId)));

  if (existing) {
    await db.delete(savedAssets)
      .where(and(eq(savedAssets.buyerId, user.id), eq(savedAssets.assetId, assetId)))
      ;
  } else {
    await db.insert(savedAssets).values({ buyerId: user.id, assetId });
  }

  revalidatePath(`/listings/${assetId}`);
  revalidatePath("/listings");
  revalidatePath("/dashboard");
}

export async function recordAssetViewAction(assetId: string) {
  const db = await getDb();
  await db.update(assets)
    .set({ views: sql`${assets.views} + 1` })
    .where(eq(assets.id, assetId))
    ;
}

/* ------------------------------ messaging ------------------------------ */

const messageSchema = z.string().trim().min(2).max(5000);

export async function startConversationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  const db = await getDb();
  if (!user) redirect("/login");

  const body = messageSchema.safeParse(formData.get("body"));
  if (!body.success) return { ok: false, errors: { body: "Write at least a couple of words." } };

  const assetId = (formData.get("assetId") as string) || null;
  const counterpartyId = String(formData.get("counterpartyId") ?? "");

  const [counterparty] = await db.select().from(users).where(eq(users.id, counterpartyId));
  if (!counterparty || counterparty.status !== "ACTIVE") {
    return { ok: false, message: "unavailable" };
  }

  const buyerId = user.role === "BUYER" ? user.id : counterparty.id;
  const sellerId = user.role === "SELLER" ? user.id : counterparty.id;

  if (user.role === "MANAGER" || counterparty.role === "MANAGER" || buyerId === sellerId) {
    return { ok: false, message: "unavailable" };
  }

  // A listing can only be attached by the parties to it.
  let attachedAssetId: string | null = null;
  if (assetId) {
    const [asset] = await db.select().from(assets).where(eq(assets.id, assetId));
    if (asset && asset.sellerId === sellerId) attachedAssetId = asset.id;
  }

  const existing = await findThread(buyerId, sellerId, attachedAssetId);
  const conversationId = existing?.id ?? newId();

  if (!existing) {
    await db.insert(conversations)
      .values({
        id: conversationId,
        assetId: attachedAssetId,
        buyerId,
        sellerId,
        startedBy: user.role === "BUYER" ? "BUYER" : "SELLER",
      })
      ;
  }

  await db.insert(messages)
    .values({ id: newId(), conversationId, senderId: user.id, body: body.data })
    ;
  await db.update(conversations)
    .set({ lastMessageAt: new Date().toISOString() })
    .where(eq(conversations.id, conversationId))
    ;

  redirect(`/inbox/${conversationId}`);
}

export async function sendMessageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("BUYER", "SELLER");
  const db = await getDb();
  const conversationId = String(formData.get("conversationId") ?? "");

  const body = messageSchema.safeParse(formData.get("body"));
  if (!body.success) return { ok: false, errors: { body: "Write at least a couple of words." } };

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId));
  if (!conversation) return { ok: false, message: "notfound" };
  if (conversation.buyerId !== user.id && conversation.sellerId !== user.id) {
    return { ok: false, message: "forbidden" };
  }

  await db.insert(messages)
    .values({ id: newId(), conversationId, senderId: user.id, body: body.data })
    ;
  await db.update(conversations)
    .set({ lastMessageAt: new Date().toISOString() })
    .where(eq(conversations.id, conversationId))
    ;

  revalidatePath(`/inbox/${conversationId}`);
  revalidatePath("/inbox");
  return { ok: true };
}

export async function markThreadRead(conversationId: string, userId: string) {
  const db = await getDb();
  await db.update(messages)
    .set({ readAt: new Date().toISOString() })
    .where(
      and(
        eq(messages.conversationId, conversationId),
        ne(messages.senderId, userId),
        sql`${messages.readAt} is null`,
      ),
    )
    ;
}

/* ------------------------------ moderation ------------------------------ */

const moderationSchema = z.object({
  targetId: z.string().min(1),
  action: z.enum(["SUSPEND", "REINSTATE", "REMOVE", "UNLIST_ASSET", "RELIST_ASSET"]),
  reason: z.string().trim().min(8).max(1000),
});

export async function moderateUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const manager = await requireUser("MANAGER");
  const db = await getDb();

  const parsed = moderationSchema.safeParse({
    targetId: formData.get("targetId"),
    action: formData.get("action"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { ok: false, errors: { reason: "reasonRequired" } };

  const [target] = await db.select().from(users).where(eq(users.id, parsed.data.targetId));
  if (!target || target.role === "MANAGER") return { ok: false, message: "forbidden" };

  const status =
    parsed.data.action === "SUSPEND"
      ? "SUSPENDED"
      : parsed.data.action === "REMOVE"
        ? "REMOVED"
        : "ACTIVE";

  await db.update(users)
    .set({
      status,
      statusReason: status === "ACTIVE" ? null : parsed.data.reason,
      statusChangedAt: new Date().toISOString(),
    })
    .where(eq(users.id, target.id))
    ;

  // Sessions are rows, so ending them logs the account out on its next request.
  if (status !== "ACTIVE") {
    await db.delete(sessions).where(eq(sessions.userId, target.id));
  }

  await db.insert(moderationLog)
    .values({
      id: newId(),
      actorId: manager.id,
      targetType: "USER",
      targetId: target.id,
      targetLabel: target.name,
      action: parsed.data.action,
      reason: parsed.data.reason,
    })
    ;

  revalidatePath("/admin");
  revalidatePath("/listings");
  revalidatePath("/buyers");
  return { ok: true };
}

export async function moderateAssetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const manager = await requireUser("MANAGER");
  const db = await getDb();

  const parsed = moderationSchema.safeParse({
    targetId: formData.get("targetId"),
    action: formData.get("action"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { ok: false, errors: { reason: "reasonRequired" } };

  const [asset] = await db.select().from(assets).where(eq(assets.id, parsed.data.targetId));
  if (!asset) return { ok: false, message: "notfound" };

  const unlisting = parsed.data.action === "UNLIST_ASSET";

  await db.update(assets)
    .set({
      status: unlisting ? "SUSPENDED" : "PUBLISHED",
      statusReason: unlisting ? parsed.data.reason : null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(assets.id, asset.id))
    ;

  await db.insert(moderationLog)
    .values({
      id: newId(),
      actorId: manager.id,
      targetType: "ASSET",
      targetId: asset.id,
      targetLabel: asset.title,
      action: parsed.data.action,
      reason: parsed.data.reason,
    })
    ;

  revalidatePath("/admin");
  revalidatePath("/listings");
  revalidatePath(`/listings/${asset.id}`);
  return { ok: true };
}

/* ------------------------------ helpers ------------------------------ */

function flatten(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/* ------------------------------ smart search ------------------------------ */

/**
 * Called by the search box when its local rules parser recognised nothing.
 * Returns filters for the client to put in the URL rather than redirecting, so
 * the box can show what it understood before the page reloads.
 */
export async function interpretQueryAction(input: string) {
  const result = await interpretQuery(input);
  return {
    filters: result.filters,
    understood: result.understood,
    source: result.source,
    note: result.note ?? null,
  };
}

export async function draftOpenerAction(payload: {
  counterpartyId: string;
  assetId: string | null;
}): Promise<{ text: string | null }> {
  const user = await getCurrentUser();
  const db = await getDb();
  if (!user || user.role === "MANAGER") return { text: null };

  const [counterparty] = await db.select().from(users).where(eq(users.id, payload.counterpartyId));
  if (!counterparty) return { text: null };

  const [asset] = payload.assetId
    ? await db.select().from(assets).where(eq(assets.id, payload.assetId))
    : [null];

  const [mandateRow] = await db
    .select()
    .from(buyerProfiles)
    .where(eq(buyerProfiles.userId, user.role === "BUYER" ? user.id : counterparty.id));

  const locale = (await cookies()).get(LOCALE_COOKIE)?.value ?? "en";

  const text = await draftOpener({
    senderRole: user.role === "BUYER" ? "BUYER" : "SELLER",
    senderName: user.name,
    counterpartyName: counterparty.name,
    locale,
    asset: asset
      ? {
          title: asset.title,
          sector: asset.sector,
          country: asset.country,
          askingPriceUsd: asset.askingPriceCents / 100,
          summary: asset.summary,
        }
      : null,
    mandate: mandateRow
      ? {
          headline: mandateRow.headline,
          sectors: JSON.parse(mandateRow.sectors || "[]") as string[],
          ticketMinUsd: mandateRow.ticketMinCents / 100,
          ticketMaxUsd: mandateRow.ticketMaxCents / 100,
        }
      : null,
  });

  return { text };
}
