"use client";

import { useFilterNav } from "./use-filter-nav";

/** Picks which of the seller's own listings the buyer list is scored against. */
export function MatchAgainstSelect({
  options,
  placeholder,
}: {
  options: Array<{ value: string; label: string }>;
  placeholder: string;
}) {
  const { searchParams, set } = useFilterNav();

  return (
    <select
      value={searchParams.get("against") ?? ""}
      onChange={(e) => set("against", e.target.value || null)}
      className="field ml-auto max-w-sm py-2 text-[13px]"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
