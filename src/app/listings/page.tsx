import Link from "next/link";

import { AssetCard } from "@/components/asset-card";
import {
  CheckboxFilter,
  ChipToggle,
  RangeFilter,
  ResetFilters,
  SearchableCheckboxList,
  SortSelect,
} from "@/components/filters/controls";
import { SmartSearch } from "@/components/filters/smart-search";
import { EmptyState } from "@/components/ui";
import { BUSINESS_STATUSES, countryOptions, DEAL_TYPES, SECTORS } from "@/domain/taxonomy";
import { isAIEnabled } from "@/lib/ai";
import { countActiveAssetFilters, parseAssetFilters } from "@/lib/filter-params";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";
import { listAssets } from "@/server/queries";

export default async function ListingsPage(props: PageProps<"/listings">) {
  const searchParams = await props.searchParams;
  const [{ t, locale }, user] = await Promise.all([getT(), getCurrentUser()]);

  const filters = parseAssetFilters(searchParams);
  const { rows, total } = listAssets(filters, user);

  // Sector chip counts come from the same result set with the sector facet
  // removed, so a chip shows what selecting it would actually return.
  const withoutSector = listAssets({ ...filters, sectors: [] }, user).rows;
  const perSector = new Map<string, number>();
  for (const row of withoutSector) {
    perSector.set(row.asset.sector, (perSector.get(row.asset.sector) ?? 0) + 1);
  }

  const activeCount = countActiveAssetFilters(filters);
  const sortOptions: Array<[string, string]> = [
    ["NEWEST", t("sort.NEWEST")],
    ["PRICE_DESC", t("sort.PRICE_DESC")],
    ["PRICE_ASC", t("sort.PRICE_ASC")],
    ["POPULAR", t("sort.POPULAR")],
    ...(user?.role === "BUYER" ? ([["MATCH", t("sort.MATCH")]] as Array<[string, string]>) : []),
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <nav className="mb-4 flex items-center gap-2 text-[13px] text-[var(--color-muted)]">
        <Link href="/" className="hover:text-[var(--color-ink)]">
          N5Deal
        </Link>
        <span>›</span>
        <span className="text-[var(--color-ink)]">{t("listings.title")}</span>
      </nav>

      <div className="mb-5">
        <SmartSearch aiEnabled={isAIEnabled()} />
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        <ChipToggle paramKey="sector" value={null} label={t("common.all")} count={withoutSector.length} />
        {SECTORS.map((sector) => (
          <ChipToggle
            key={sector}
            paramKey="sector"
            value={sector}
            label={t(`sector.${sector}`)}
            count={perSector.get(sector) ?? 0}
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card divide-y divide-[var(--color-line)]">
            <FilterBlock title={t("listings.country")}>
              <SearchableCheckboxList
                paramKey="country"
                searchPlaceholder={t("listings.searchCountry")}
                options={countryOptions(locale).map((c) => ({
                  value: c.code,
                  label: `${c.flag}  ${c.name}`,
                  meta: c.code,
                }))}
              />
            </FilterBlock>

            <FilterBlock title={t("listings.priceRange")}>
              <RangeFilter
                minKey="min"
                maxKey="max"
                minLabel={t("common.min")}
                maxLabel={t("common.max")}
              />
              <p className="mt-1.5 text-[11.5px] text-[var(--color-muted)]">USD</p>
            </FilterBlock>

            <FilterBlock title={t("listings.businessStatus")}>
              {BUSINESS_STATUSES.map((status) => (
                <CheckboxFilter
                  key={status}
                  paramKey="status"
                  value={status}
                  label={t(`businessStatus.${status}`)}
                />
              ))}
            </FilterBlock>

            <FilterBlock title={t("listings.dealType")}>
              {DEAL_TYPES.map((deal) => (
                <CheckboxFilter key={deal} paramKey="deal" value={deal} label={t(`dealType.${deal}`)} />
              ))}
            </FilterBlock>

            <div className="p-3">
              <ResetFilters label={t("common.reset")} count={activeCount} />
            </div>
          </div>
        </aside>

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-semibold tracking-tight">
              {t("listings.title")}{" "}
              <span className="text-[var(--color-muted)]">({total})</span>
            </h1>
            <SortSelect options={sortOptions} label={t("common.sortBy")} />
          </div>

          {rows.length === 0 ? (
            <EmptyState title={t("common.noResults")} body={t("common.noResultsHint")} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((row) => (
                <AssetCard
                  key={row.asset.id}
                  row={row}
                  t={t}
                  locale={locale}
                  showStatus={user?.role === "SELLER" || user?.role === "MANAGER"}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function FilterBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-3">
      <p className="mb-2 text-[13px] font-semibold">{title}</p>
      {children}
    </div>
  );
}
