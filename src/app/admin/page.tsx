import Link from "next/link";

import { ModerationPanel } from "@/components/moderation-panel";
import { SearchInput, SelectFilter } from "@/components/filters/search-input";
import { Badge, EmptyState, SectionHeading, Stat } from "@/components/ui";
import { formatCompact, formatRange } from "@/domain/money";
import { ASSET_STATUSES, country, USER_ROLES } from "@/domain/taxonomy";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";
import { adminAssets, adminParticipants, auditTrail, moderationStats } from "@/server/queries";

const TABS = ["overview", "participants", "assets", "audit"] as const;
type Tab = (typeof TABS)[number];

export default async function AdminPage(props: PageProps<"/admin">) {
  await requireUser("MANAGER");
  const searchParams = await props.searchParams;
  const { t, locale } = await getT();

  const raw = typeof searchParams.tab === "string" ? searchParams.tab : "overview";
  const tab: Tab = (TABS as readonly string[]).includes(raw) ? (raw as Tab) : "overview";
  const q = typeof searchParams.q === "string" ? searchParams.q : "";
  const role = typeof searchParams.role === "string" ? searchParams.role : "";
  const status = typeof searchParams.status === "string" ? searchParams.status : "";

  const stats = moderationStats();

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.title")}</h1>
      <p className="mt-1 text-[14.5px] text-[var(--color-muted)]">{t("dashboard.managerSubtitle")}</p>

      <nav className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((value) => (
          <Link
            key={value}
            href={`/admin?tab=${value}`}
            className={`chip ${value === tab ? "chip-active" : ""}`}
          >
            {t(`admin.${value}`)}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat value={stats.buyers} label={t("admin.statBuyers")} />
          <Stat value={stats.sellers} label={t("admin.statSellers")} />
          <Stat value={stats.liveAssets} label={t("admin.statAssets")} />
          <Stat value={stats.suspended} label={t("admin.statSuspended")} />
          <Stat value={stats.threads} label={t("admin.statThreads")} />
        </div>
      )}

      {tab === "participants" && (
        <div className="mt-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SearchInput placeholder={t("admin.searchParticipants")} />
            <SelectFilter
              paramKey="role"
              allLabel={t("admin.role")}
              options={USER_ROLES.filter((r) => r !== "MANAGER").map((r) => [r, t(`role.${r}`)])}
            />
            <SelectFilter
              paramKey="status"
              allLabel={t("admin.status")}
              options={[
                ["ACTIVE", t("userStatus.ACTIVE")],
                ["SUSPENDED", t("userStatus.SUSPENDED")],
                ["REMOVED", t("userStatus.REMOVED")],
              ]}
            />
          </div>

          <div className="card divide-y divide-[var(--color-line)]">
            {adminParticipants(q, role, status).map(({ user: person, seller, buyer }) => (
              <div key={person.id} className="flex flex-wrap items-start gap-4 p-4">
                <div className="min-w-[220px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {person.role === "BUYER" ? (
                      <Link
                        href={`/buyers/${person.id}`}
                        className="text-[14.5px] font-semibold tracking-tight hover:underline"
                      >
                        {person.name}
                      </Link>
                    ) : (
                      <span className="text-[14.5px] font-semibold tracking-tight">
                        {person.name}
                      </span>
                    )}
                    <Badge tone="neutral">{t(`role.${person.role}`)}</Badge>
                    <Badge
                      tone={
                        person.status === "ACTIVE"
                          ? "positive"
                          : person.status === "SUSPENDED"
                            ? "warn"
                            : "danger"
                      }
                    >
                      {t(`userStatus.${person.status}`)}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-[var(--color-muted)]">{person.email}</p>
                  <p className="mt-1 text-[13px] text-[var(--color-ink-soft)]">
                    {seller?.company ?? buyer?.headline ?? "—"}
                  </p>
                  {person.statusReason && (
                    <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">
                      {person.statusReason}
                    </p>
                  )}
                </div>

                <div className="text-right text-[12.5px] text-[var(--color-muted)]">
                  <p>{country(seller?.country ?? buyer?.country ?? "", locale).name}</p>
                  {buyer && (
                    <p>{formatRange(buyer.ticketMinCents, buyer.ticketMaxCents, locale)}</p>
                  )}
                  <p>
                    {t("admin.joined")} {person.createdAt.slice(0, 10)}
                  </p>
                </div>

                <ModerationPanel
                  compact
                  targetType="USER"
                  targetId={person.id}
                  targetLabel={person.name}
                  suspended={person.status === "SUSPENDED"}
                  removed={person.status === "REMOVED"}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "assets" && (
        <div className="mt-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SearchInput placeholder={t("admin.searchAssets")} />
            <SelectFilter
              paramKey="status"
              allLabel={t("admin.status")}
              options={ASSET_STATUSES.map((s) => [s, t(`assetStatus.${s}`)])}
            />
          </div>

          <div className="card divide-y divide-[var(--color-line)]">
            {adminAssets(q, status).map(({ asset, seller }) => (
              <div key={asset.id} className="flex flex-wrap items-start gap-4 p-4">
                <div className="min-w-[240px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/listings/${asset.id}`}
                      className="text-[14.5px] font-semibold tracking-tight hover:underline"
                    >
                      {asset.title || "—"}
                    </Link>
                    <Badge
                      tone={
                        asset.status === "SUSPENDED"
                          ? "danger"
                          : asset.status === "PUBLISHED"
                            ? "positive"
                            : "neutral"
                      }
                    >
                      {t(`assetStatus.${asset.status}`)}
                    </Badge>
                  </div>
                  <p className="mt-0.5 font-mono text-[12px] text-[var(--color-muted)]">
                    {asset.reference} · {seller.name}
                  </p>
                  {asset.statusReason && (
                    <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">
                      {asset.statusReason}
                    </p>
                  )}
                </div>

                <div className="text-right text-[12.5px] text-[var(--color-muted)]">
                  <p className="text-[14px] font-semibold text-[var(--color-ink)]">
                    {formatCompact(asset.askingPriceCents, locale)}
                  </p>
                  <p>
                    {country(asset.country, locale).name} · {t(`sector.${asset.sector}`)}
                  </p>
                </div>

                <ModerationPanel
                  compact
                  targetType="ASSET"
                  targetId={asset.id}
                  targetLabel={asset.title}
                  suspended={asset.status === "SUSPENDED"}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "audit" && (
        <div className="mt-6">
          <SectionHeading title={t("admin.audit")} />
          {auditTrail().length === 0 ? (
            <EmptyState title={t("admin.noAudit")} />
          ) : (
            <ol className="card divide-y divide-[var(--color-line)]">
              {auditTrail().map(({ entry, actor }) => (
                <li key={entry.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      tone={
                        entry.action === "REINSTATE" || entry.action === "RELIST_ASSET"
                          ? "positive"
                          : "danger"
                      }
                    >
                      {t(`admin.action.${entry.action}`)}
                    </Badge>
                    <span className="text-[14px] font-semibold tracking-tight">
                      {entry.targetLabel}
                    </span>
                    <span className="text-[12.5px] text-[var(--color-muted)]">
                      {t("admin.actionBy", { name: actor.name })} ·{" "}
                      {new Date(entry.createdAt).toLocaleDateString(
                        locale === "uk" ? "uk-UA" : "en-GB",
                        { day: "numeric", month: "short", year: "numeric" },
                      )}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
                    {entry.reason}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
