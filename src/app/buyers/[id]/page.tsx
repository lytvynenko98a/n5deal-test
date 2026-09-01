import Link from "next/link";
import { notFound } from "next/navigation";

import { ContactPanel } from "@/components/contact-panel";
import { MatchBreakdown } from "@/components/match-badge";
import { ModerationPanel } from "@/components/moderation-panel";
import { Badge, KeyValue, SectionHeading } from "@/components/ui";
import { scoreMatch } from "@/domain/matching";
import { formatRange } from "@/domain/money";
import { country } from "@/domain/taxonomy";
import { isAIEnabled } from "@/lib/ai";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";
import { assetMandate, findThread, getBuyer, listSellerAssets, mandateOf } from "@/server/queries";

export default async function BuyerPage(props: PageProps<"/buyers/[id]">) {
  const user = await requireUser("SELLER", "MANAGER");
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const { t, locale } = await getT();

  const buyer = getBuyer(id, user);
  if (!buyer) notFound();

  const place = country(buyer.profile.country, locale);
  const myAssets = user.role === "SELLER" ? listSellerAssets(user.id) : [];
  const againstId = typeof searchParams.against === "string" ? searchParams.against : "";
  const against = myAssets.find((a) => a.id === againstId) ?? myAssets[0] ?? null;

  const match = against
    ? scoreMatch({ buyer: mandateOf(buyer), asset: assetMandate(against) })
    : null;

  const existingThread =
    user.role === "SELLER" ? findThread(buyer.user.id, user.id, against?.id ?? null) : null;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      <nav className="mb-4 flex items-center gap-2 text-[13px] text-[var(--color-muted)]">
        <Link href="/buyers" className="hover:text-[var(--color-ink)]">
          {t("buyers.title")}
        </Link>
        <span>›</span>
        <span className="text-[var(--color-ink)]">{buyer.user.name}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <div className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-ink)] text-[15px] font-semibold text-white">
                  {buyer.user.name
                    .split(" ")
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join("")}
                </span>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">{buyer.user.name}</h1>
                  <p className="text-[13px] text-[var(--color-muted)]">
                    {place.flag} {place.name} ·{" "}
                    {t(`investorType.${buyer.profile.investorType}`)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {buyer.user.status !== "ACTIVE" && (
                  <Badge tone="danger">{t(`userStatus.${buyer.user.status}`)}</Badge>
                )}
                {!buyer.profile.listedInDirectory && (
                  <Badge tone="warn">{t("buyers.hidden")}</Badge>
                )}
                <Badge tone={buyer.profile.timeline === "NOW" ? "positive" : "neutral"}>
                  {t(`timeline.${buyer.profile.timeline}`)}
                </Badge>
              </div>
            </div>

            <p className="mt-4 text-[15px] font-medium">{buyer.profile.headline}</p>
            <p className="mt-2 whitespace-pre-line text-[14.5px] leading-relaxed text-[var(--color-ink-soft)]">
              {buyer.profile.about}
            </p>
          </div>

          <div className="card p-5">
            <SectionHeading title={t("buyers.about")} />
            <dl>
              <KeyValue
                label={t("buyers.ticket")}
                value={formatRange(
                  buyer.profile.ticketMinCents,
                  buyer.profile.ticketMaxCents,
                  locale,
                )}
              />
              <KeyValue
                label={t("buyers.sectors")}
                value={
                  buyer.sectors.length
                    ? buyer.sectors.map((s) => t(`sector.${s}`)).join(", ")
                    : t("common.all")
                }
              />
              <KeyValue
                label={t("buyers.jurisdictions")}
                value={
                  buyer.jurisdictions.length
                    ? buyer.jurisdictions.map((j) => country(j).name).join(", ")
                    : t("common.all")
                }
              />
              <KeyValue
                label={t("buyers.structures")}
                value={
                  buyer.dealTypes.length
                    ? buyer.dealTypes.map((d) => t(`dealType.${d}`)).join(", ")
                    : t("common.all")
                }
              />
              <KeyValue
                label={t("buyers.proofOfFunds")}
                value={buyer.profile.proofOfFunds ? "✓" : "—"}
              />
            </dl>
          </div>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          {match && against && (
            <div className="card p-5">
              <SectionHeading
                title={t("asset.matchScore", { score: match.score })}
                description={against.title}
              />
              <MatchBreakdown match={match} t={t} />
            </div>
          )}

          {user.role === "SELLER" && buyer.user.status === "ACTIVE" && (
            existingThread ? (
              <Link href={`/inbox/${existingThread.id}`} className="btn-primary w-full">
                {t("asset.contactAgain")}
              </Link>
            ) : (
              <ContactPanel
                counterpartyId={buyer.user.id}
                counterpartyName={buyer.user.name}
                assetId={against?.id ?? null}
                aiEnabled={isAIEnabled()}
              />
            )
          )}

          {user.role === "MANAGER" && (
            <ModerationPanel
              targetType="USER"
              targetId={buyer.user.id}
              targetLabel={buyer.user.name}
              suspended={buyer.user.status === "SUSPENDED"}
              removed={buyer.user.status === "REMOVED"}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
