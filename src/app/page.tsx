import Link from "next/link";

import { AssetCard } from "@/components/asset-card";
import { Stat } from "@/components/ui";
import { SECTORS } from "@/domain/taxonomy";
import { EMPTY_ASSET_FILTERS } from "@/domain/search";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";
import { listAssets, publicStats } from "@/server/queries";

export default async function HomePage() {
  const [{ t, locale }, user] = await Promise.all([getT(), getCurrentUser()]);
  const stats = await publicStats();
  const { rows } = await listAssets({ ...EMPTY_ASSET_FILTERS }, user, { limit: 6 });

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6">
      <section className="grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <h1 className="text-[38px] font-semibold leading-[1.1] tracking-tight sm:text-[46px]">
            {t("home.heroTitle")}
          </h1>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-[var(--color-ink-soft)]">
            {t("home.heroBody")}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/listings" className="btn-primary">
              {t("home.browse")}
            </Link>
            <Link href={user?.role === "SELLER" ? "/assets/new" : "/login"} className="btn-secondary">
              {t("home.sell")}
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
          <Stat value={stats.assets} label={t("home.statsAssets")} />
          <Stat value={stats.buyers} label={t("home.statsBuyers")} />
          <Stat value={SECTORS.length} label={t("home.statsSectors")} />
        </div>
      </section>

      <section className="mt-14">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-xl font-semibold tracking-tight">{t("home.featured")}</h2>
          <Link href="/listings" className="btn-ghost btn-sm">
            {t("common.viewAll")} →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <AssetCard key={row.asset.id} row={row} t={t} locale={locale} />
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="mb-4 text-xl font-semibold tracking-tight">{t("home.howTitle")}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            [t("home.how1Title"), t("home.how1Body")],
            [t("home.how2Title"), t("home.how2Body")],
            [t("home.how3Title"), t("home.how3Body")],
          ].map(([title, body], index) => (
            <div key={title} className="card p-5">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--color-ink)] text-[12px] font-semibold text-white">
                {index + 1}
              </span>
              <p className="mt-3 text-[15px] font-semibold tracking-tight">{title}</p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--color-muted)]">
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {!user && (
        <section className="mt-14 rounded-2xl border border-[var(--color-line)] bg-white px-6 py-8 text-center">
          <h2 className="text-xl font-semibold tracking-tight">{t("home.rolesTitle")}</h2>
          <Link href="/login" className="btn-primary mt-4">
            {t("nav.signIn")}
          </Link>
        </section>
      )}
    </div>
  );
}
