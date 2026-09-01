import { getT } from "@/lib/i18n/server";

export async function SiteFooter() {
  const { t } = await getT();

  return (
    <footer className="mt-16 border-t border-[var(--color-line)] bg-white">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 py-8 text-[13px] text-[var(--color-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>N5Deal prototype — technical assignment build, not the production platform.</p>
        <p>{t("common.demoBanner")}</p>
      </div>
    </footer>
  );
}
