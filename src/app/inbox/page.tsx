import { EmptyState } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";

export default async function InboxPage() {
  const user = await requireUser("BUYER", "SELLER");
  const { t } = await getT();

  return (
    <EmptyState
      title={t("inbox.empty")}
      body={user.role === "BUYER" ? t("inbox.emptyBuyer") : t("inbox.emptySeller")}
    />
  );
}
