import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { parseSmartQuery, type AssetFilters, type ParsedQuery } from "@/domain/search";
import { BUSINESS_STATUSES, COUNTRIES, DEAL_TYPES, SECTORS } from "@/domain/taxonomy";

/**
 * Model-backed features, each with a deterministic fallback.
 *
 * The marketplace works with no API key: search falls back to the rules parser
 * in src/domain/search.ts, and the message drafter simply does not appear. That
 * ordering is deliberate. A deal platform cannot have its search box stop
 * working because a provider is rate-limiting, so the model only handles what
 * the rules miss.
 */

const MODEL = "claude-opus-5";

/**
 * Bracket access on purpose. A bundler replaces `process.env.NAME` with the
 * build-time value, and Vercel withholds variables marked sensitive from the
 * build, so dot access bakes in `undefined` and silently disables the feature
 * on a deployment that does have the key. Bracket access stays a runtime read.
 */
function apiKey(): string | undefined {
  return process.env["ANTHROPIC_API_KEY"]?.trim() || undefined;
}

export function isAIEnabled(): boolean {
  return apiKey() !== undefined;
}

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  const key = apiKey();
  if (!key) return null;
  client ??= new Anthropic({ apiKey: key });
  return client;
}

/* --------------------------- smart search --------------------------- */

const filterSchema = z.object({
  sectors: z.array(z.enum(SECTORS)),
  countries: z.array(z.enum(COUNTRIES.map((c) => c.code) as [string, ...string[]])),
  businessStatuses: z.array(z.enum(BUSINESS_STATUSES)),
  dealTypes: z.array(z.enum(DEAL_TYPES)),
  minPriceUsd: z.number().nullable(),
  maxPriceUsd: z.number().nullable(),
  keywords: z.string(),
  interpretation: z.string(),
});

export type SmartQueryResult = ParsedQuery & { source: "rules" | "model"; note?: string };

/**
 * Rules first, model second. If the regex parser already pulled a sector, a
 * country or a price out of the sentence, the model adds nothing and costs a
 * round trip, so it never runs.
 */
export async function interpretQuery(input: string): Promise<SmartQueryResult> {
  const rules = parseSmartQuery(input);
  if (rules.understood.length > 0 || !input.trim()) {
    return { ...rules, source: "rules" };
  }

  const anthropic = getClient();
  if (!anthropic) return { ...rules, source: "rules" };

  try {
    const response = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: "low", format: zodOutputFormat(filterSchema) },
      system:
        "You turn a buyer's plain-language request into marketplace filters for an M&A platform " +
        "trading regulated fintech assets. Use only the enum values available. Leave a list empty " +
        "and a price null when the request does not state it. Put anything you could not map into " +
        "keywords. Keep interpretation to one short sentence in the language of the request.",
      messages: [{ role: "user", content: input.slice(0, 500) }],
    });

    const parsed = response.parsed_output;
    if (!parsed) return { ...rules, source: "rules" };

    const filters: Partial<AssetFilters> = {
      sectors: parsed.sectors,
      countries: parsed.countries,
      businessStatuses: parsed.businessStatuses,
      dealTypes: parsed.dealTypes,
      minPriceCents: parsed.minPriceUsd ? Math.round(parsed.minPriceUsd * 100) : null,
      maxPriceCents: parsed.maxPriceUsd ? Math.round(parsed.maxPriceUsd * 100) : null,
      q: parsed.keywords,
    };

    const understood = [
      ...parsed.sectors.map((value) => ({ label: "sector", value })),
      ...parsed.countries.map((value) => ({ label: "country", value })),
      ...parsed.businessStatuses.map((value) => ({ label: "status", value })),
      ...parsed.dealTypes.map((value) => ({ label: "deal", value })),
    ];
    if (parsed.maxPriceUsd) understood.push({ label: "max price", value: String(parsed.maxPriceUsd) });
    if (parsed.minPriceUsd) understood.push({ label: "min price", value: String(parsed.minPriceUsd) });

    return {
      filters,
      understood,
      leftover: parsed.keywords,
      source: "model",
      note: parsed.interpretation,
    };
  } catch {
    // A provider outage degrades search to the rules parser, never to an error page.
    return { ...rules, source: "rules" };
  }
}

/* --------------------------- message drafting --------------------------- */

export type OpenerContext = {
  senderRole: "BUYER" | "SELLER";
  senderName: string;
  counterpartyName: string;
  locale: string;
  asset?: {
    title: string;
    sector: string;
    country: string;
    askingPriceUsd: number;
    summary: string;
  } | null;
  mandate?: {
    headline: string;
    sectors: string[];
    ticketMinUsd: number;
    ticketMaxUsd: number;
  } | null;
};

/**
 * Drafts a first message. It stays a draft: the composer fills the textarea and
 * the person sends it, so nothing reaches a counterparty that a human did not
 * read. The prompt asks for questions grounded in the listing, because the
 * generic "I am interested, please send details" opener is what sellers ignore.
 */
export async function draftOpener(context: OpenerContext): Promise<string | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  const facts = [
    `Sender is a ${context.senderRole.toLowerCase()} named ${context.senderName}.`,
    `Recipient is ${context.counterpartyName}.`,
    context.asset
      ? `Listing: "${context.asset.title}", ${context.asset.sector} in ${context.asset.country}, ` +
        `asking $${context.asset.askingPriceUsd.toLocaleString("en-US")}. ${context.asset.summary}`
      : "",
    context.mandate
      ? `Buyer mandate: ${context.mandate.headline}. Sectors: ${context.mandate.sectors.join(", ") || "any"}. ` +
        `Ticket $${context.mandate.ticketMinUsd.toLocaleString("en-US")}–$${context.mandate.ticketMaxUsd.toLocaleString("en-US")}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 800,
      output_config: { effort: "low" },
      system:
        "Draft the opening message on an M&A marketplace. Three to five sentences. Say who is " +
        "writing and why this specific asset or mandate fits, then ask one or two concrete " +
        "questions a deal team would ask first, drawn from the facts given. No greeting boilerplate, " +
        "no flattery, no invented numbers, no placeholders in brackets. " +
        (context.locale === "uk" ? "Write in Ukrainian." : "Write in English."),
      messages: [{ role: "user", content: facts }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    return text || null;
  } catch {
    return null;
  }
}
