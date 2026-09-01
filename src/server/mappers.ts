import type { Asset, BuyerProfile, SellerProfile, User } from "@/db/schema";
import type { DealType, Sector } from "@/domain/taxonomy";

/** JSON columns are read through these so a malformed row cannot crash a page. */
function parseList(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export type BuyerView = {
  user: User;
  profile: BuyerProfile;
  sectors: Sector[];
  jurisdictions: string[];
  dealTypes: DealType[];
};

export function toBuyerView(user: User, profile: BuyerProfile): BuyerView {
  return {
    user,
    profile,
    sectors: parseList(profile.sectors) as Sector[],
    jurisdictions: parseList(profile.jurisdictions),
    dealTypes: parseList(profile.dealTypes) as DealType[],
  };
}

export type AssetView = {
  asset: Asset;
  seller: User;
  sellerProfile: SellerProfile | null;
};

export { parseList };
