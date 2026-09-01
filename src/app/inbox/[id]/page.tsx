import Link from "next/link";
import { notFound } from "next/navigation";

import { MessageComposer } from "@/components/message-composer";
import { Badge } from "@/components/ui";
import { country } from "@/domain/taxonomy";
import { formatCompact } from "@/domain/money";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";
import { getThread } from "@/server/queries";
import { markThreadRead } from "@/server/actions";

export default async function ThreadPage(props: PageProps<"/inbox/[id]">) {
  const user = await requireUser("BUYER", "SELLER");
  const { id } = await props.params;
  const { t, locale } = await getT();

  const thread = await getThread(id, user);
  if (!thread) notFound();

  // Opening a thread marks the other side's messages as read.
  await markThreadRead(id, user.id);

  return (
    <div className="card flex h-full flex-col">
      <header className="border-b border-[var(--color-line)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] text-[var(--color-muted)]">{t("inbox.counterparty")}</p>
            <p className="text-[16px] font-semibold tracking-tight">{thread.counterparty.name}</p>
          </div>
          <Badge tone="neutral">{t(`role.${thread.counterparty.role}`)}</Badge>
        </div>

        {thread.asset && (
          <Link
            href={`/listings/${thread.asset.id}`}
            className="mt-3 flex items-center gap-3 rounded-xl bg-[var(--color-canvas)] p-3 transition-colors hover:bg-[var(--color-line)]"
          >
            <span className="grid h-9 w-12 place-items-center rounded-lg bg-white text-lg">
              {country(thread.asset.country, locale).flag}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11.5px] text-[var(--color-muted)]">
                {t("inbox.regarding")} · {thread.asset.reference}
              </span>
              <span className="block truncate text-[13.5px] font-medium">{thread.asset.title}</span>
            </span>
            <span className="text-[13.5px] font-semibold">
              {formatCompact(thread.asset.askingPriceCents, locale)}
            </span>
          </Link>
        )}
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {thread.messages.map((message) => {
          const mine = message.senderId === user.id;
          return (
            <div key={message.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed ${
                  mine
                    ? "bg-[var(--color-ink)] text-white"
                    : "bg-[var(--color-canvas)] text-[var(--color-ink)]"
                }`}
              >
                <p className="mb-1 text-[11.5px] opacity-60">
                  {mine ? t("inbox.you") : thread.counterparty.name} ·{" "}
                  {new Date(message.createdAt).toLocaleDateString(
                    locale === "uk" ? "uk-UA" : "en-GB",
                    { day: "numeric", month: "short" },
                  )}
                </p>
                <p className="whitespace-pre-line">{message.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      <MessageComposer conversationId={id} />
    </div>
  );
}
