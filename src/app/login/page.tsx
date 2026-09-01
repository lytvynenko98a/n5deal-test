import { redirect } from "next/navigation";

import { Badge } from "@/components/ui";
import { formatRange } from "@/domain/money";
import { country } from "@/domain/taxonomy";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";
import { signInAction } from "@/server/actions";
import { demoAccounts } from "@/server/queries";

export default async function LoginPage(props: PageProps<"/login">) {
  const [{ t, locale }, user, searchParams] = await Promise.all([
    getT(),
    getCurrentUser(),
    props.searchParams,
  ]);
  if (user) redirect("/dashboard");

  const accounts = await demoAccounts();
  const groups = [
    { role: "BUYER" as const, title: t("auth.buyers") },
    { role: "SELLER" as const, title: t("auth.sellers") },
    { role: "MANAGER" as const, title: t("auth.managers") },
  ];

  const error = typeof searchParams.error === "string" ? searchParams.error : null;
  const reason = typeof searchParams.reason === "string" ? searchParams.reason : "";

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("auth.title")}</h1>
      <p className="mt-1 max-w-2xl text-[14.5px] text-[var(--color-muted)]">{t("auth.body")}</p>

      {error === "suspended" && (
        <div className="mt-5 rounded-2xl border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3">
          <p className="text-[14px] font-semibold text-[var(--color-danger)]">
            {t("auth.suspendedTitle")}
          </p>
          <p className="mt-1 text-[13px] text-[var(--color-danger)]">
            {t("auth.suspendedBody", { reason })}
          </p>
        </div>
      )}

      <div className="mt-8 space-y-8">
        {groups.map((group) => {
          const rows = accounts.filter((a) => a.user.role === group.role);
          return (
            <section key={group.role}>
              <h2 className="section-title mb-3">{group.title}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map(({ user: account, seller, buyer }) => {
                  const place = country(seller?.country ?? buyer?.country ?? "", locale);
                  return (
                    <form key={account.id} action={signInAction} className="card flex flex-col p-4">
                      <input type="hidden" name="userId" value={account.id} />
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[14.5px] font-semibold tracking-tight">
                            {account.name}
                          </p>
                          <p className="text-[12.5px] text-[var(--color-muted)]">{account.email}</p>
                        </div>
                        {account.status !== "ACTIVE" && (
                          <Badge tone="danger">{t(`userStatus.${account.status}`)}</Badge>
                        )}
                      </div>

                      <p className="mt-2 line-clamp-2 min-h-[34px] text-[12.5px] text-[var(--color-ink-soft)]">
                        {seller?.company ?? buyer?.headline ?? "N5Deal operations"}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {(seller || buyer) && <span className="tag">{place.flag} {place.name}</span>}
                        {buyer && (
                          <span className="tag">
                            {formatRange(buyer.ticketMinCents, buyer.ticketMaxCents, locale)}
                          </span>
                        )}
                        {seller?.verified && <span className="tag">✓ verified</span>}
                      </div>

                      <button type="submit" className="btn-secondary btn-sm mt-3 w-full">
                        {t("auth.continue")}
                      </button>
                    </form>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
