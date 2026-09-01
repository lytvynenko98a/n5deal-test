"use client";

import { useEffect, useState } from "react";

import { useFilterNav } from "./use-filter-nav";

/** Debounced free-text filter that writes straight to the URL. */
export function SearchInput({ paramKey = "q", placeholder }: { paramKey?: string; placeholder: string }) {
  const { searchParams, set } = useFilterNav();
  const [value, setValue] = useState(searchParams.get(paramKey) ?? "");

  useEffect(() => {
    const timer = setTimeout(() => {
      if ((searchParams.get(paramKey) ?? "") !== value) set(paramKey, value || null);
    }, 250);
    return () => clearTimeout(timer);
  }, [value, paramKey, searchParams, set]);

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      className="field max-w-md"
    />
  );
}

export function SelectFilter({
  paramKey,
  options,
  allLabel,
}: {
  paramKey: string;
  options: Array<[string, string]>;
  allLabel: string;
}) {
  const { searchParams, set } = useFilterNav();

  return (
    <select
      value={searchParams.get(paramKey) ?? ""}
      onChange={(e) => set(paramKey, e.target.value || null)}
      className="rounded-full border border-[var(--color-line)] bg-white px-3 py-2 text-[13px] font-medium outline-none"
    >
      <option value="">{allLabel}</option>
      {options.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
