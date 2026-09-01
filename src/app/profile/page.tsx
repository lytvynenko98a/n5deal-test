import { BuyerProfileForm, SellerProfileForm } from "@/components/profile-forms";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";
import { getBuyerProfile, getSellerProfile } from "@/server/queries";

export default async function ProfilePage() {
  const user = await requireUser("BUYER", "SELLER");
  const { t } = await getT();

  const buyer = user.role === "BUYER" ? await getBuyerProfile(user.id) : null;
  const seller = user.role === "SELLER" ? await getSellerProfile(user.id) : null;

  return (
    <div className="mx-auto max-w-[820px] px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {user.role === "BUYER" ? t("profile.buyerTitle") : t("profile.sellerTitle")}
      </h1>
      <p className="mt-1 max-w-2xl text-[14.5px] text-[var(--color-muted)]">
        {user.role === "BUYER" ? t("profile.buyerBody") : t("profile.sellerBody")}
      </p>

      <div className="mt-6">
        {buyer && <BuyerProfileForm user={user} buyer={buyer} />}
        {seller && <SellerProfileForm user={user} profile={seller} />}
      </div>
    </div>
  );
}
