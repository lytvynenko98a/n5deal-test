"use client";

import { useState } from "react";

import { useFilterNav } from "./use-filter-nav";

export function CheckboxFilter({
  paramKey,
  value,
  label,
  meta,
}: {
  paramKey: string;
  value: string;
  label: string;
  meta?: string;
}) {
  const { searchParams, toggle } = useFilterNav();
  const checked = searchParams.getAll(paramKey).includes(value);

  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1.5 text-[13px]">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => toggle(paramKey, value)}
        className="h-4 w-4 shrink-0 rounded border-[var(--color-line-strong)] accent-[var(--color-ink)]"
      />
      <span className="flex-1 text-[var(--color-ink-soft)]">{label}</span>
      {meta && <span className="text-[12px] text-[var(--color-muted)]">{meta}</span>}
    </label>
  );
}

export function ChipToggle({
  paramKey,
  value,
  label,
  count,
}: {
  paramKey: string;
  value: string | null;
  label: string;
  count?: number;
}) {
  const { searchParams, toggle, set } = useFilterNav();
  const selected = searchParams.getAll(paramKey);
  const active = value === null ? selected.length === 0 : selected.includes(value);

  return (
    <button
      type="button"
      onClick={() => (value === null ? set(paramKey, null) : toggle(paramKey, value))}
      className={`chip whitespace-nowrap ${active ? "chip-active" : ""}`}
    >
      {label}
      {count !== undefined && (
        <span className={active ? "text-white/70" : "text-[var(--color-muted)]"}>({count})</span>
      )}
    </button>
  );
}

export function RangeFilter({
  minKey,
  maxKey,
  minLabel,
  maxLabel,
}: {
  minKey: string;
  maxKey: string;
  minLabel: string;
  maxLabel: string;
}) {
  const { searchParams, replaceAll } = useFilterNav();
  const [min, setMin] = useState(searchParams.get(minKey) ?? "");
  const [max, setMax] = useState(searchParams.get(maxKey) ?? "");

  const apply = () => {
    const next = new URLSearchParams(searchParams);
    if (min) next.set(minKey, min);
    else next.delete(minKey);
    if (max) next.set(maxKey, max);
    else next.delete(maxKey);
    replaceAll(next);
  };

  return (
    <div className="flex gap-2">
      <input
        inputMode="numeric"
        value={min}
        onChange={(e) => setMin(e.target.value.replace(/[^\d]/g, ""))}
        onBlur={apply}
        onKeyDown={(e) => e.key === "Enter" && apply()}
        placeholder={minLabel}
        className="field py-2 text-[13px]"
      />
      <input
        inputMode="numeric"
        value={max}
        onChange={(e) => setMax(e.target.value.replace(/[^\d]/g, ""))}
        onBlur={apply}
        onKeyDown={(e) => e.key === "Enter" && apply()}
        placeholder={maxLabel}
        className="field py-2 text-[13px]"
      />
    </div>
  );
}

export function SortSelect({ options, label }: { options: Array<[string, string]>; label: string }) {
  const { searchParams, set } = useFilterNav();
  const current = searchParams.get("sort") ?? options[0][0];

  return (
    <label className="flex items-center gap-2 text-[13px] text-[var(--color-muted)]">
      <span className="hidden sm:inline">{label}</span>
      <select
        value={current}
        onChange={(e) => set("sort", e.target.value === options[0][0] ? null : e.target.value)}
        className="rounded-full border border-[var(--color-line)] bg-white px-3 py-1.5 text-[13px] font-medium text-[var(--color-ink)] outline-none"
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SearchableCheckboxList({
  paramKey,
  options,
  searchPlaceholder,
}: {
  paramKey: string;
  options: Array<{ value: string; label: string; meta?: string }>;
  searchPlaceholder: string;
}) {
  const [query, setQuery] = useState("");
  const visible = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchPlaceholder}
        className="field mb-2 py-2 text-[13px]"
      />
      <div className="thin-scroll max-h-56 overflow-y-auto pr-1">
        {visible.map((option) => (
          <CheckboxFilter
            key={option.value}
            paramKey={paramKey}
            value={option.value}
            label={option.label}
            meta={option.meta}
          />
        ))}
        {visible.length === 0 && (
          <p className="py-2 text-[13px] text-[var(--color-muted)]">—</p>
        )}
      </div>
    </div>
  );
}

export function ResetFilters({ label, count }: { label: string; count: number }) {
  const { clear } = useFilterNav();
  if (!count) return null;

  return (
    <button type="button" onClick={clear} className="btn-secondary btn-sm w-full">
      {label} ({count})
    </button>
  );
}

export function ToggleFilter({ paramKey, label }: { paramKey: string; label: string }) {
  const { searchParams, set } = useFilterNav();
  const active = searchParams.get(paramKey) === "1";

  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1.5 text-[13px]">
      <input
        type="checkbox"
        checked={active}
        onChange={() => set(paramKey, active ? null : "1")}
        className="h-4 w-4 rounded border-[var(--color-line-strong)] accent-[var(--color-ink)]"
      />
      <span className="text-[var(--color-ink-soft)]">{label}</span>
    </label>
  );
}
