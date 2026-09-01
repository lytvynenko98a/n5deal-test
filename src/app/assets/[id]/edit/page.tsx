import { notFound } from "next/navigation";

import { ListingEditor } from "@/components/listing-editor";
import { Badge } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";
import { listSellerAssets } from "@/server/queries";

export default async function EditAssetPage(props: PageProps<"/assets/[id]/edit">) {
  const user = await requireUser("SELLER");
  const { id } = await props.params;
  const { t } = await getT();

  const asset = listSellerAssets(user.id).find((row) => row.id === id);
  if (!asset) notFound();

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("editor.editTitle")}</h1>
        <Badge tone={asset.status === "SUSPENDED" ? "danger" : "neutral"}>
          {t(`assetStatus.${asset.status}`)}
        </Badge>
        <span className="font-mono text-[13px] text-[var(--color-muted)]">{asset.reference}</span>
      </div>

      {asset.status === "SUSPENDED" && (
        <div className="mb-5 rounded-2xl border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 text-[13px] text-[var(--color-danger)]">
          {t("asset.suspendedNotice", { reason: asset.statusReason ?? "—" })}
        </div>
      )}

      <ListingEditor asset={asset} />
    </div>
  );
}
