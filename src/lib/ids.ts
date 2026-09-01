import { randomUUID } from "node:crypto";

export const newId = () => randomUUID();

/** Short public reference for a listing, e.g. "N5-4821". */
export function newAssetReference(): string {
  return `N5-${Math.floor(1000 + Math.random() * 9000)}`;
}
