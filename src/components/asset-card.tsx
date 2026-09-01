import Link from "next/link";

import { formatCompact } from "@/domain/money";
import { country } from "@/domain/taxonomy";
import type { Translator } from "@/lib/i18n";
import type { ScoredAsset } from "@/server/queries";
import { MatchBadge, MatchReasonLine } from "./match-badge";
import { Badge } from "./ui";

export function AssetCard({
  row,
  t,
  locale,
  showStatus = false,
}: {
  row: ScoredAsset;
  t: Translator;
  locale: string;
  showStatus?: boolean;
}) {
  const { asset, sellerProfile } = row;
  const place = country(asset.country, locale);

  return (
    <Link
      href={`/listings/${asset.id}`}
      className="card group flex flex-col gap-3 p-4 transition-shadow hover:shadow-[0_1px_2px_rgba(11,11,15,0.06),0_8px_24px_rgba(11,11,15,0.06)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-12 place-items-center rounded-lg bg-[var(--color-canvas)] text-lg">
            {place.flag}
          </span>
          <div>
            <p className="font-mono text-[12px] font-medium text-[var(--color-muted)]">
              {asset.reference}
            </p>
            <p className="text-[12.5px] font-medium">{place.name}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {row.match && <MatchBadge match={row.match} t={t} />}
          {showStatus && asset.status !== "PUBLISHED" && (
            <Badge tone={statusTone(asset.status)}>{t(`assetStatus.${asset.status}` as never)}</Badge>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-[15px] font-semibold leading-snug tracking-tight group-hover:underline">
          {asset.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[var(--color-muted)]">
          {asset.summary}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="tag">{t(`sector.${asset.sector}` as never)}</span>
        <span className="tag">{t(`businessStatus.${asset.businessStatus}` as never)}</span>
        <span className="tag">{t(`dealType.${asset.dealType}` as never)}</span>
      </div>

      {row.match && <MatchReasonLine match={row.match} t={t} />}

      <div className="mt-auto flex items-end justify-between gap-3 border-t border-[var(--color-line)] pt-3">
        <div>
          <p className="text-[11.5px] text-[var(--color-muted)]">{t("asset.askingPrice")}</p>
          <p className="text-lg font-semibold tracking-tight">
            {asset.askingPriceCents ? formatCompact(asset.askingPriceCents, locale) : t("asset.priceOnRequest")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11.5px] text-[var(--color-muted)]">{t("asset.revenue")}</p>
          <p className="text-[13px] font-medium">{formatCompact(asset.revenueCents, locale)}</p>
        </div>
      </div>

      {sellerProfile && (
        <p className="text-[12px] text-[var(--color-muted)]">
          {sellerProfile.company}
          {sellerProfile.verified && <span className="ml-1.5 text-[var(--color-positive)]">✓</span>}
        </p>
      )}
    </Link>
  );
}

function statusTone(status: string) {
  if (status === "SUSPENDED") return "danger" as const;
  if (status === "SOLD") return "neutral" as const;
  if (status === "UNDER_OFFER") return "warn" as const;
  return "neutral" as const;
}
