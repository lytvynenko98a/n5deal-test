import Link from "next/link";

import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";
import { listThreads } from "@/server/queries";

/**
 * The thread list stays mounted next to the open conversation, so switching
 * threads never loses the reading position of the list.
 */
export default async function InboxLayout({ children }: LayoutProps<"/inbox">) {
  const user = await requireUser("BUYER", "SELLER");
  const { t } = await getT();
  const threads = await listThreads(user);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">{t("inbox.title")}</h1>

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <aside className="card divide-y divide-[var(--color-line)] lg:max-h-[70vh] lg:overflow-y-auto">
          {threads.length === 0 && (
            <p className="p-5 text-[13.5px] text-[var(--color-muted)]">
              {user.role === "BUYER" ? t("inbox.emptyBuyer") : t("inbox.emptySeller")}
            </p>
          )}
          {threads.map((thread) => (
            <Link
              key={thread.id}
              href={`/inbox/${thread.id}`}
              className="block p-4 transition-colors hover:bg-[var(--color-canvas)]"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[14px] font-semibold tracking-tight">
                  {thread.counterparty.name}
                </p>
                {thread.unread > 0 && (
                  <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-[11px] font-semibold text-white">
                    {thread.unread}
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-[12.5px] text-[var(--color-muted)]">
                {thread.asset ? thread.asset.title : t("inbox.noAsset")}
              </p>
              <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-[var(--color-ink-soft)]">
                {thread.lastMessage}
              </p>
            </Link>
          ))}
        </aside>

        <section>{children}</section>
      </div>
    </div>
  );
}
