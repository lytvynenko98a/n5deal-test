import { BuyerCard } from "@/components/buyer-card";
import {
  CheckboxFilter,
  ChipToggle,
  ResetFilters,
  SearchableCheckboxList,
  SortSelect,
  ToggleFilter,
} from "@/components/filters/controls";
import { MatchAgainstSelect } from "@/components/filters/match-against";
import { EmptyState } from "@/components/ui";
import { countryOptions, INVESTOR_TYPES, SECTORS, TIMELINES } from "@/domain/taxonomy";
import { countActiveBuyerFilters, parseBuyerFilters } from "@/lib/filter-params";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";
import { listBuyers, listSellerAssets } from "@/server/queries";

export default async function BuyersPage(props: PageProps<"/buyers">) {
  const user = await requireUser("SELLER", "MANAGER");
  const searchParams = await props.searchParams;
  const { t, locale } = await getT();

  const filters = parseBuyerFilters(searchParams);
  const myAssets = user.role === "SELLER" ? listSellerAssets(user.id) : [];
  const againstId = typeof searchParams.against === "string" ? searchParams.against : "";
  const against = myAssets.find((a) => a.id === againstId) ?? null;

  const { rows, total } = listBuyers(
    { ...filters, sort: against ? "MATCH" : filters.sort },
    user,
    against,
  );

  const activeCount = countActiveBuyerFilters(filters);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("buyers.title")}</h1>
          <p className="mt-1 text-[14px] text-[var(--color-muted)]">
            {t("buyers.count", { count: total })}
          </p>
        </div>
        <SortSelect
          label={t("common.sortBy")}
          options={[
            ["NEWEST", t("sort.NEWEST")],
            ["TICKET_DESC", t("sort.TICKET_DESC")],
            ["READINESS", t("sort.READINESS")],
          ]}
        />
      </div>

      {myAssets.length > 0 && (
        <div className="card mb-5 flex flex-wrap items-center gap-3 p-4">
          <div>
            <p className="text-[13px] font-semibold">{t("buyers.matchFor")}</p>
            <p className="text-[12.5px] text-[var(--color-muted)]">{t("buyers.matchPick")}</p>
          </div>
          <MatchAgainstSelect
            options={myAssets.map((a) => ({ value: a.id, label: a.title }))}
            placeholder={t("common.none")}
          />
        </div>
      )}

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        <ChipToggle paramKey="sector" value={null} label={t("common.all")} />
        {SECTORS.map((sector) => (
          <ChipToggle
            key={sector}
            paramKey="sector"
            value={sector}
            label={t(`sector.${sector}`)}
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card divide-y divide-[var(--color-line)]">
            <div className="p-3">
              <p className="mb-2 text-[13px] font-semibold">{t("buyers.jurisdictions")}</p>
              <SearchableCheckboxList
                paramKey="country"
                searchPlaceholder={t("listings.searchCountry")}
                options={countryOptions(locale).map((c) => ({
                  value: c.code,
                  label: `${c.flag}  ${c.name}`,
                  meta: c.code,
                }))}
              />
            </div>

            <div className="p-3">
              <p className="mb-2 text-[13px] font-semibold">{t("buyers.investorType")}</p>
              {INVESTOR_TYPES.map((type) => (
                <CheckboxFilter
                  key={type}
                  paramKey="investor"
                  value={type}
                  label={t(`investorType.${type}`)}
                />
              ))}
            </div>

            <div className="p-3">
              <p className="mb-2 text-[13px] font-semibold">{t("buyers.timeline")}</p>
              {TIMELINES.map((value) => (
                <CheckboxFilter
                  key={value}
                  paramKey="timeline"
                  value={value}
                  label={t(`timeline.${value}`)}
                />
              ))}
            </div>

            <div className="p-3">
              <ToggleFilter paramKey="pof" label={t("buyers.proofOfFunds")} />
            </div>

            <div className="p-3">
              <ResetFilters label={t("common.reset")} count={activeCount} />
            </div>
          </div>
        </aside>

        <section>
          {rows.length === 0 ? (
            <EmptyState title={t("common.noResults")} body={t("common.noResultsHint")} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((row) => (
                <BuyerCard key={row.user.id} row={row} t={t} locale={locale} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
