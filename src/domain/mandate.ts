import type { DealType, Sector } from "./taxonomy";

/**
 * How much of a buyer's mandate is filled in. Sellers rank buyers by fit, and a
 * mandate with three empty fields scores as "no restriction stated" on each,
 * which reads as a tyre-kicker. The percentage tells the buyer what that costs
 * them before a seller has to guess.
 */
export type MandateInput = {
  headline: string;
  about: string;
  country: string;
  sectors: Sector[];
  jurisdictions: string[];
  dealTypes: DealType[];
  ticketMinCents: number;
  ticketMaxCents: number;
  proofOfFunds: boolean;
};

const WEIGHTS: Array<[keyof MandateInput | "ticket", number, (m: MandateInput) => boolean]> = [
  ["headline", 15, (m) => m.headline.trim().length >= 10],
  ["about", 20, (m) => m.about.trim().length >= 80],
  ["country", 5, (m) => m.country.length === 2],
  ["sectors", 20, (m) => m.sectors.length > 0],
  ["jurisdictions", 15, (m) => m.jurisdictions.length > 0],
  ["dealTypes", 10, (m) => m.dealTypes.length > 0],
  ["ticket", 10, (m) => m.ticketMaxCents > 0],
  ["proofOfFunds", 5, (m) => m.proofOfFunds],
];

export function mandateCompleteness(mandate: MandateInput): number {
  return WEIGHTS.reduce((sum, [, weight, test]) => (test(mandate) ? sum + weight : sum), 0);
}
