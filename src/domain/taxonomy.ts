export const SECTORS = [
  "BANK",
  "FINTECH",
  "PAYMENT",
  "EMI",
  "CRYPTO",
  "LENDING",
  "WEALTH",
] as const;
export type Sector = (typeof SECTORS)[number];

export const BUSINESS_STATUSES = ["ACTIVE", "LICENSE_ONLY", "PRE_REVENUE"] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

export const DEAL_TYPES = ["FULL_SALE", "MAJORITY", "MINORITY", "ASSET_PURCHASE"] as const;
export type DealType = (typeof DEAL_TYPES)[number];

export const ASSET_STATUSES = [
  "DRAFT",
  "PUBLISHED",
  "UNDER_OFFER",
  "SOLD",
  "SUSPENDED",
] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const INVESTOR_TYPES = [
  "STRATEGIC",
  "PE_VC",
  "FAMILY_OFFICE",
  "ANGEL",
  "SEARCH_FUND",
] as const;
export type InvestorType = (typeof INVESTOR_TYPES)[number];

export const TIMELINES = ["NOW", "3_MONTHS", "6_MONTHS", "EXPLORING"] as const;
export type Timeline = (typeof TIMELINES)[number];

export const USER_ROLES = ["BUYER", "SELLER", "MANAGER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Jurisdictions offered in filters and profile forms, with flag emoji for cards. */
export const COUNTRIES: ReadonlyArray<{ code: string; name: string; nameUk: string; flag: string }> = [
  { code: "LT", name: "Lithuania", nameUk: "Литва", flag: "🇱🇹" },
  { code: "CY", name: "Cyprus", nameUk: "Кіпр", flag: "🇨🇾" },
  { code: "MT", name: "Malta", nameUk: "Мальта", flag: "🇲🇹" },
  { code: "EE", name: "Estonia", nameUk: "Естонія", flag: "🇪🇪" },
  { code: "GB", name: "United Kingdom", nameUk: "Велика Британія", flag: "🇬🇧" },
  { code: "IE", name: "Ireland", nameUk: "Ірландія", flag: "🇮🇪" },
  { code: "NL", name: "Netherlands", nameUk: "Нідерланди", flag: "🇳🇱" },
  { code: "DE", name: "Germany", nameUk: "Німеччина", flag: "🇩🇪" },
  { code: "CH", name: "Switzerland", nameUk: "Швейцарія", flag: "🇨🇭" },
  { code: "PL", name: "Poland", nameUk: "Польща", flag: "🇵🇱" },
  { code: "CZ", name: "Czechia", nameUk: "Чехія", flag: "🇨🇿" },
  { code: "BG", name: "Bulgaria", nameUk: "Болгарія", flag: "🇧🇬" },
  { code: "US", name: "United States", nameUk: "США", flag: "🇺🇸" },
  { code: "CA", name: "Canada", nameUk: "Канада", flag: "🇨🇦" },
  { code: "AE", name: "United Arab Emirates", nameUk: "ОАЕ", flag: "🇦🇪" },
  { code: "SG", name: "Singapore", nameUk: "Сінгапур", flag: "🇸🇬" },
  { code: "HK", name: "Hong Kong", nameUk: "Гонконг", flag: "🇭🇰" },
  { code: "AU", name: "Australia", nameUk: "Австралія", flag: "🇦🇺" },
  { code: "BR", name: "Brazil", nameUk: "Бразилія", flag: "🇧🇷" },
  { code: "KY", name: "Cayman Islands", nameUk: "Кайманові Острови", flag: "🇰🇾" },
];

const byCode = new Map(COUNTRIES.map((c) => [c.code, c]));

/** Country label for a locale. Falls back to the raw code for unknown values. */
export function country(code: string, locale = "en") {
  const found = byCode.get(code);
  if (!found) return { code, name: code, flag: "🏳️" };
  return { code: found.code, name: locale === "uk" ? found.nameUk : found.name, flag: found.flag };
}

export function countryOptions(locale = "en") {
  return COUNTRIES.map((c) => ({
    code: c.code,
    name: locale === "uk" ? c.nameUk : c.name,
    flag: c.flag,
  })).sort((a, b) => a.name.localeCompare(b.name, locale));
}

/**
 * Sectors a buyer is likely to accept as a near-miss. Used by the match engine
 * to award partial credit instead of dropping an asset to zero on one mismatch.
 */
export const ADJACENT_SECTORS: Record<Sector, Sector[]> = {
  BANK: ["LENDING", "WEALTH"],
  FINTECH: ["PAYMENT", "EMI", "LENDING"],
  PAYMENT: ["EMI", "FINTECH"],
  EMI: ["PAYMENT", "FINTECH"],
  CRYPTO: ["FINTECH"],
  LENDING: ["BANK", "FINTECH"],
  WEALTH: ["BANK", "FINTECH"],
};
