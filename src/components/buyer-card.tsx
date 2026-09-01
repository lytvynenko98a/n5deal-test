import Link from "next/link";

import { formatRange } from "@/domain/money";
import { country } from "@/domain/taxonomy";
import type { Translator } from "@/lib/i18n";
import type { ScoredBuyer } from "@/server/queries";
import { MatchBadge, MatchReasonLine } from "./match-badge";
import { Badge } from "./ui";

export function BuyerCard({
  row,
  t,
  locale,
}: {
  row: ScoredBuyer;
  t: Translator;
  locale: string;
}) {
  const place = country(row.profile.country, locale);

  return (
    <Link
      href={`/buyers/${row.user.id}`}
      className="card group flex flex-col gap-3 p-4 transition-shadow hover:shadow-[0_1px_2px_rgba(11,11,15,0.06),0_8px_24px_rgba(11,11,15,0.06)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-ink)] text-[13px] font-semibold text-white">
            {row.user.name
              .split(" ")
              .slice(0, 2)
              .map((p) => p[0])
              .join("")}
          </span>
          <div>
            <p className="text-[14.5px] font-semibold tracking-tight group-hover:underline">
              {row.user.name}
            </p>
            <p className="text-[12.5px] text-[var(--color-muted)]">
              {place.flag} {place.name} · {t(`investorType.${row.profile.investorType}` as never)}
            </p>
          </div>
        </div>
        {row.match && <MatchBadge match={row.match} t={t} />}
      </div>

      <p className="line-clamp-2 text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
        {row.profile.headline}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {row.sectors.slice(0, 4).map((sector) => (
          <span key={sector} className="tag">
            {t(`sector.${sector}` as never)}
          </span>
        ))}
        {row.sectors.length === 0 && <span className="tag">{t("common.all")}</span>}
      </div>

      {row.match && <MatchReasonLine match={row.match} t={t} />}

      <div className="mt-auto flex items-end justify-between gap-3 border-t border-[var(--color-line)] pt-3">
        <div>
          <p className="text-[11.5px] text-[var(--color-muted)]">{t("buyers.ticket")}</p>
          <p className="text-[15px] font-semibold tracking-tight">
            {formatRange(row.profile.ticketMinCents, row.profile.ticketMaxCents, locale)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone={row.profile.timeline === "NOW" ? "positive" : "neutral"}>
            {t(`timeline.${row.profile.timeline}` as never)}
          </Badge>
          {row.profile.proofOfFunds && (
            <span className="text-[11.5px] text-[var(--color-positive)]">
              ✓ {t("buyers.proofOfFunds")}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
