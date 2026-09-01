import Link from "next/link";
import { notFound } from "next/navigation";

import { AssetCard } from "@/components/asset-card";
import { ContactPanel } from "@/components/contact-panel";
import { MatchBreakdown } from "@/components/match-badge";
import { ModerationPanel } from "@/components/moderation-panel";
import { SaveAssetButton } from "@/components/save-asset-button";
import { Badge, KeyValue, SectionHeading } from "@/components/ui";
import { formatCompact, formatExact } from "@/domain/money";
import { country } from "@/domain/taxonomy";
import { isAIEnabled } from "@/lib/ai";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";
import { findThread, getAsset, similarAssets } from "@/server/queries";
import { recordAssetViewAction } from "@/server/actions";

export default async function AssetPage(props: PageProps<"/listings/[id]">) {
  const { id } = await props.params;
  const [{ t, locale }, user] = await Promise.all([getT(), getCurrentUser()]);

  const row = getAsset(id, user);
  if (!row) notFound();

  const { asset, seller, sellerProfile } = row;
  const place = country(asset.country, locale);
  const isOwner = user?.id === seller.id;

  // Owners and managers reading their own page should not inflate the count.
  if (!isOwner && user?.role !== "MANAGER") await recordAssetViewAction(asset.id);

  const existingThread =
    user?.role === "BUYER" ? findThread(user.id, seller.id, asset.id) : null;
  const similar = similarAssets(asset, user);

  const canContact = user?.role === "BUYER" && seller.status === "ACTIVE" && !isOwner;
  const tradeable = asset.status === "PUBLISHED" || asset.status === "UNDER_OFFER";

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <nav className="mb-4 flex flex-wrap items-center gap-2 text-[13px] text-[var(--color-muted)]">
        <Link href="/" className="hover:text-[var(--color-ink)]">
          N5Deal
        </Link>
        <span>›</span>
        <Link href="/listings" className="hover:text-[var(--color-ink)]">
          {t("listings.title")}
        </Link>
        <span>›</span>
        <span className="font-mono text-[var(--color-ink)]">{asset.reference}</span>
      </nav>

      {asset.status === "SUSPENDED" && (
        <div className="mb-4 rounded-2xl border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 text-[13px] text-[var(--color-danger)]">
          {t("asset.suspendedNotice", { reason: asset.statusReason ?? "—" })}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-16 place-items-center rounded-xl bg-[var(--color-canvas)] text-2xl">
                  {place.flag}
                </span>
                <div>
                  <p className="font-mono text-[12px] text-[var(--color-muted)]">
                    {t("asset.reference")} {asset.reference}
                  </p>
                  <p className="text-[13px] font-medium">{place.name}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {asset.status !== "PUBLISHED" && (
                  <Badge tone={asset.status === "SUSPENDED" ? "danger" : "warn"}>
                    {t(`assetStatus.${asset.status}`)}
                  </Badge>
                )}
                <Badge tone="neutral">{t(`sector.${asset.sector}`)}</Badge>
                <Badge tone="neutral">{t(`businessStatus.${asset.businessStatus}`)}</Badge>
                <Badge tone="neutral">{t(`dealType.${asset.dealType}`)}</Badge>
              </div>
            </div>

            <h1 className="mt-4 text-2xl font-semibold leading-tight tracking-tight">
              {asset.title}
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
              {asset.summary}
            </p>
            <p className="mt-3 text-[12.5px] text-[var(--color-muted)]">
              {t("asset.views", { count: asset.views })}
            </p>
          </div>

          <div className="card p-5">
            <SectionHeading title={t("asset.about")} />
            <div className="whitespace-pre-line text-[14.5px] leading-relaxed text-[var(--color-ink-soft)]">
              {asset.description || "—"}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="card p-5">
              <SectionHeading title={t("asset.financials")} />
              <dl>
                <KeyValue
                  label={t("asset.revenue")}
                  value={formatExact(asset.revenueCents, locale)}
                />
                <KeyValue label={t("asset.ebitda")} value={formatExact(asset.ebitdaCents, locale)} />
                <KeyValue label={t("asset.employees")} value={asset.employees || "—"} />
                <KeyValue label={t("asset.founded")} value={asset.foundedYear ?? "—"} />
              </dl>
            </div>

            <div className="card p-5">
              <SectionHeading title={t("editor.regulatory")} />
              <dl>
                <KeyValue label={t("asset.jurisdiction")} value={asset.jurisdiction || "—"} />
                <KeyValue label={t("asset.licence")} value={asset.licenseType || "—"} />
                <KeyValue label={t("asset.stake")} value={`${asset.stakeOffered}%`} />
                <KeyValue
                  label={t("listings.businessStatus")}
                  value={t(`businessStatus.${asset.businessStatus}`)}
                />
              </dl>
            </div>
          </div>

          {similar.length > 0 && (
            <div>
              <SectionHeading title={t("asset.similar")} />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {similar.map((item) => (
                  <AssetCard key={item.asset.id} row={item} t={t} locale={locale} />
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <p className="text-[12.5px] text-[var(--color-muted)]">{t("asset.askingPrice")}</p>
            <p className="text-3xl font-semibold tracking-tight">
              {asset.askingPriceCents
                ? formatCompact(asset.askingPriceCents, locale)
                : t("asset.priceOnRequest")}
            </p>
            {asset.askingPriceCents > 0 && (
              <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">
                {formatExact(asset.askingPriceCents, locale)}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {existingThread ? (
                <Link href={`/inbox/${existingThread.id}`} className="btn-primary btn-sm flex-1">
                  {t("asset.contactAgain")}
                </Link>
              ) : null}
              {user?.role === "BUYER" && <SaveAssetButton assetId={asset.id} saved={row.saved} />}
              {isOwner && (
                <Link href={`/assets/${asset.id}/edit`} className="btn-secondary btn-sm flex-1">
                  {t("editor.editTitle")}
                </Link>
              )}
            </div>

            {!user && (
              <p className="mt-3 text-[13px] text-[var(--color-muted)]">
                <Link href="/login" className="font-medium text-[var(--color-accent)] underline">
                  {t("nav.signIn")}
                </Link>{" "}
                — {t("asset.noPublicContact")}
              </p>
            )}
          </div>

          {row.match && (
            <div className="card p-5">
              <SectionHeading
                title={t("asset.matchTitle")}
                description={t("asset.matchScore", { score: row.match.score })}
              />
              <MatchBreakdown match={row.match} t={t} />
            </div>
          )}

          <div className="card p-5">
            <SectionHeading title={t("asset.seller")} />
            <p className="text-[15px] font-semibold tracking-tight">
              {sellerProfile?.company ?? seller.name}
            </p>
            <p className="text-[13px] text-[var(--color-muted)]">{seller.name}</p>
            {sellerProfile?.verified && (
              <p className="mt-2">
                <Badge tone="positive">✓ {t("asset.verifiedSeller")}</Badge>
              </p>
            )}
            {sellerProfile && (
              <>
                <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
                  {sellerProfile.about}
                </p>
                <p className="mt-2 text-[12.5px] text-[var(--color-muted)]">
                  {t("asset.dealsClosed", { count: sellerProfile.dealsClosed })}
                </p>
              </>
            )}
          </div>

          {canContact && tradeable && !existingThread && (
            <ContactPanel
              counterpartyId={seller.id}
              counterpartyName={sellerProfile?.company ?? seller.name}
              assetId={asset.id}
              aiEnabled={isAIEnabled()}
            />
          )}

          {user?.role === "MANAGER" && (
            <ModerationPanel
              targetType="ASSET"
              targetId={asset.id}
              targetLabel={asset.title}
              suspended={asset.status === "SUSPENDED"}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
