import Link from "next/link";
import { redirect } from "next/navigation";

import { AssetCard } from "@/components/asset-card";
import { BuyerCard } from "@/components/buyer-card";
import { Badge, EmptyState, SectionHeading, Stat } from "@/components/ui";
import { mandateCompleteness } from "@/domain/mandate";
import { formatCompact } from "@/domain/money";
import { EMPTY_ASSET_FILTERS, EMPTY_BUYER_FILTERS } from "@/domain/search";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";
import {
  getBuyerProfile,
  getSavedAssets,
  listAssets,
  listBuyers,
  listSellerAssets,
  listThreads,
} from "@/server/queries";

export default async function DashboardPage() {
  const user = await requireUser("BUYER", "SELLER", "MANAGER");
  if (user.role === "MANAGER") redirect("/admin");

  const { t, locale } = await getT();
  const threads = listThreads(user);
  const unread = threads.reduce((sum, thread) => sum + thread.unread, 0);

  if (user.role === "BUYER") {
    const buyer = getBuyerProfile(user.id)!;
    const completeness = mandateCompleteness({
      headline: buyer.profile.headline,
      about: buyer.profile.about,
      country: buyer.profile.country,
      sectors: buyer.sectors,
      jurisdictions: buyer.jurisdictions,
      dealTypes: buyer.dealTypes,
      ticketMinCents: buyer.profile.ticketMinCents,
      ticketMaxCents: buyer.profile.ticketMaxCents,
      proofOfFunds: buyer.profile.proofOfFunds,
    });

    // Recommendations only surface listings a buyer can still act on.
    const recommended = listAssets({ ...EMPTY_ASSET_FILTERS, sort: "MATCH" }, user, {
      limit: 6,
      statuses: ["PUBLISHED"],
    });
    const saved = getSavedAssets(user.id);

    return (
      <div className="mx-auto max-w-[1400px] space-y-8 px-4 py-8 sm:px-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("dashboard.hello", { name: user.name.split(" ")[0] })}
          </h1>
          <p className="mt-1 text-[14.5px] text-[var(--color-muted)]">
            {t("dashboard.buyerSubtitle")}
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat value={saved.length} label={t("dashboard.savedAssets")} />
          <Stat value={threads.length} label={t("dashboard.openThreads")} />
          <Stat value={`${completeness}%`} label={t("profile.completeness")} />
        </div>

        {completeness < 80 && (
          <div className="card flex flex-wrap items-center justify-between gap-3 border-[var(--color-warn)] bg-[var(--color-warn-soft)] p-4">
            <p className="text-[13.5px] text-[var(--color-warn)]">
              {t("dashboard.mandateIncomplete", { percent: completeness })}
            </p>
            <Link href="/profile" className="btn-secondary btn-sm">
              {t("listings.completeProfileCta")}
            </Link>
          </div>
        )}

        <section>
          <SectionHeading
            title={t("dashboard.recommended")}
            description={t("listings.recommendedBody")}
            action={
              <Link href="/listings?sort=MATCH" className="btn-ghost btn-sm">
                {t("common.viewAll")} →
              </Link>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {recommended.rows.map((row) => (
              <AssetCard key={row.asset.id} row={row} t={t} locale={locale} />
            ))}
          </div>
        </section>

        <section>
          <SectionHeading title={t("dashboard.savedAssets")} />
          {saved.length === 0 ? (
            <EmptyState
              title={t("dashboard.noSaved")}
              action={
                <Link href="/listings" className="btn-primary btn-sm">
                  {t("home.browse")}
                </Link>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {saved.map((row) => (
                <AssetCard
                  key={row.asset.id}
                  row={{ ...row, match: null, saved: true }}
                  t={t}
                  locale={locale}
                />
              ))}
            </div>
          )}
        </section>

        <ThreadStrip threads={threads} unread={unread} label={t("dashboard.openThreads")} empty={t("dashboard.noThreads")} more={t("common.viewAll")} />
      </div>
    );
  }

  // Seller
  const listings = listSellerAssets(user.id);
  const live = listings.filter((a) => a.status === "PUBLISHED").length;
  const bestListing = listings.find((a) => a.status === "PUBLISHED") ?? listings[0] ?? null;
  const matchedBuyers = bestListing
    ? listBuyers({ ...EMPTY_BUYER_FILTERS, sort: "MATCH" }, user, bestListing).rows.slice(0, 3)
    : [];

  return (
    <div className="mx-auto max-w-[1400px] space-y-8 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("dashboard.hello", { name: user.name.split(" ")[0] })}
          </h1>
          <p className="mt-1 text-[14.5px] text-[var(--color-muted)]">
            {t("dashboard.sellerSubtitle")}
          </p>
        </div>
        <Link href="/assets/new" className="btn-primary btn-sm">
          {t("nav.newListing")}
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat value={live} label={t("home.statsAssets")} />
        <Stat value={threads.length} label={t("dashboard.openThreads")} />
        <Stat value={unread} label={t("dashboard.unreadLabel")} />
      </div>

      <section>
        <SectionHeading title={t("dashboard.myListings")} />
        {listings.length === 0 ? (
          <EmptyState
            title={t("dashboard.noListings")}
            action={
              <Link href="/assets/new" className="btn-primary btn-sm">
                {t("nav.newListing")}
              </Link>
            }
          />
        ) : (
          <div className="card divide-y divide-[var(--color-line)]">
            {listings.map((asset) => (
              <div key={asset.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/listings/${asset.id}`}
                      className="truncate text-[14.5px] font-semibold tracking-tight hover:underline"
                    >
                      {asset.title || "—"}
                    </Link>
                    <Badge tone={asset.status === "SUSPENDED" ? "danger" : asset.status === "PUBLISHED" ? "positive" : "neutral"}>
                      {t(`assetStatus.${asset.status}`)}
                    </Badge>
                  </div>
                  <p className="mt-0.5 font-mono text-[12px] text-[var(--color-muted)]">
                    {asset.reference} · {t("asset.views", { count: asset.views })}
                  </p>
                </div>
                <p className="text-[14px] font-semibold">
                  {formatCompact(asset.askingPriceCents, locale)}
                </p>
                <Link href={`/assets/${asset.id}/edit`} className="btn-secondary btn-sm">
                  {t("editor.editTitle")}
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {matchedBuyers.length > 0 && bestListing && (
        <section>
          <SectionHeading
            title={t("dashboard.matchedBuyers")}
            description={bestListing.title}
            action={
              <Link href={`/buyers?against=${bestListing.id}`} className="btn-ghost btn-sm">
                {t("common.viewAll")} →
              </Link>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {matchedBuyers.map((row) => (
              <BuyerCard key={row.user.id} row={row} t={t} locale={locale} />
            ))}
          </div>
        </section>
      )}

      <ThreadStrip threads={threads} unread={unread} label={t("dashboard.openThreads")} empty={t("dashboard.noThreads")} more={t("common.viewAll")} />
    </div>
  );
}

function ThreadStrip({
  threads,
  label,
  empty,
  more,
}: {
  threads: Awaited<ReturnType<typeof listThreads>>;
  unread: number;
  label: string;
  empty: string;
  more: string;
}) {
  return (
    <section>
      <SectionHeading
        title={label}
        action={
          <Link href="/inbox" className="btn-ghost btn-sm">
            {more} →
          </Link>
        }
      />
      {threads.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <div className="card divide-y divide-[var(--color-line)]">
          {threads.slice(0, 5).map((thread) => (
            <Link
              key={thread.id}
              href={`/inbox/${thread.id}`}
              className="flex items-center gap-3 p-4 transition-colors hover:bg-[var(--color-canvas)]"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold tracking-tight">
                  {thread.counterparty.name}
                </p>
                <p className="truncate text-[13px] text-[var(--color-muted)]">
                  {thread.lastMessage}
                </p>
              </div>
              {thread.unread > 0 && (
                <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-[11px] font-semibold text-white">
                  {thread.unread}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
