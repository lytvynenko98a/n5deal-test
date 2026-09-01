import { ListingEditor } from "@/components/listing-editor";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";

export default async function NewAssetPage() {
  await requireUser("SELLER");
  const { t } = await getT();

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t("editor.newTitle")}</h1>
      <ListingEditor asset={null} />
    </div>
  );
}
