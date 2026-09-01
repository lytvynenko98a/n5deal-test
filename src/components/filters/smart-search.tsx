"use client";

import { useMemo, useState, useTransition } from "react";

import { parseSmartQuery } from "@/domain/search";
import { assetFiltersToParams } from "@/lib/filter-params";
import { useI18n } from "@/lib/i18n/client";
import { interpretQueryAction } from "@/server/actions";
import { useFilterNav } from "./use-filter-nav";

/**
 * The rules parser runs on every keystroke, so the chips under the box update
 * with no latency and no cost. The model is asked only on submit, and only when
 * the rules recognised nothing — which is the case it exists for.
 */
export function SmartSearch({ aiEnabled }: { aiEnabled: boolean }) {
  const { t } = useI18n();
  const { searchParams, replaceAll } = useFilterNav();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const [modelNote, setModelNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const local = useMemo(() => parseSmartQuery(value), [value]);

  const submit = () => {
    setModelNote(null);

    if (local.understood.length > 0 || !aiEnabled || !value.trim()) {
      replaceAll(carryOverSort(searchParams, assetFiltersToParams(local.filters)));
      return;
    }

    startTransition(async () => {
      const result = await interpretQueryAction(value);
      setModelNote(result.source === "model" ? result.note : null);
      replaceAll(carryOverSort(searchParams, assetFiltersToParams(result.filters)));
    });
  };

  return (
    <div>
      <div className="flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-white px-4 py-2.5 focus-within:border-[var(--color-ink)]">
        <SearchIcon />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={t("listings.smartPlaceholder")}
          aria-label={t("common.search")}
          className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-muted)]"
        />
        <button type="button" onClick={submit} disabled={pending} className="btn-primary btn-sm">
          {pending ? "…" : t("common.search")}
        </button>
      </div>

      {(local.understood.length > 0 || modelNote) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 px-1">
          <span className="text-[12px] text-[var(--color-muted)]">{t("listings.smartHint")}</span>
          {local.understood.map((item, index) => (
            <span key={`${item.label}-${index}`} className="tag">
              {item.label}: <strong className="font-semibold">{item.value}</strong>
            </span>
          ))}
          {modelNote && <span className="tag">{modelNote}</span>}
        </div>
      )}
    </div>
  );
}

/** Sorting is a view preference, not part of the query, so it survives a search. */
function carryOverSort(current: URLSearchParams, next: URLSearchParams): URLSearchParams {
  const sort = current.get("sort");
  if (sort) next.set("sort", sort);
  return next;
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" opacity="0.5" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}
