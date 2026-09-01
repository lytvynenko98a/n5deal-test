import Link from "next/link";

import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getT();

  return (
    <div className="mx-auto flex max-w-[600px] flex-col items-center gap-3 px-4 py-24 text-center">
      <p className="text-4xl font-semibold tracking-tight">404</p>
      <p className="text-lg font-medium">{t("error.notFound")}</p>
      <p className="text-[14.5px] text-[var(--color-muted)]">{t("error.notFoundBody")}</p>
      <Link href="/listings" className="btn-primary mt-3">
        {t("home.browse")}
      </Link>
    </div>
  );
}
