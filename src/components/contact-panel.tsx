"use client";

import { useActionState, useState, useTransition } from "react";

import { useI18n } from "@/lib/i18n/client";
import { draftOpenerAction, startConversationAction, type ActionState } from "@/server/actions";

/**
 * First contact between the two sides. The draft button fills the textarea and
 * stops there: a person reads and edits before anything is sent, so the model
 * never speaks to a counterparty on someone's behalf.
 */
export function ContactPanel({
  counterpartyId,
  counterpartyName,
  assetId = null,
  aiEnabled,
}: {
  counterpartyId: string;
  counterpartyName: string;
  assetId?: string | null;
  aiEnabled: boolean;
}) {
  const { t } = useI18n();
  const [state, formAction, sending] = useActionState<ActionState, FormData>(
    startConversationAction,
    { ok: false },
  );
  const [body, setBody] = useState("");
  const [drafting, startDrafting] = useTransition();

  return (
    <form action={formAction} className="card p-4">
      <p className="section-title">{t("inbox.startTitle", { name: counterpartyName })}</p>
      <p className="mt-1 text-[13px] text-[var(--color-muted)]">{t("inbox.startBody")}</p>

      <input type="hidden" name="counterpartyId" value={counterpartyId} />
      {assetId && <input type="hidden" name="assetId" value={assetId} />}

      <textarea
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={6}
        placeholder={t("inbox.placeholder")}
        className="field mt-3 resize-y"
      />
      {state.errors?.body && (
        <p className="mt-1 text-[12px] text-[var(--color-danger)]">{state.errors.body}</p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button type="submit" disabled={sending} className="btn-primary btn-sm">
          {t("common.send")}
        </button>
        {aiEnabled && (
          <button
            type="button"
            disabled={drafting}
            onClick={() =>
              startDrafting(async () => {
                const result = await draftOpenerAction({ counterpartyId, assetId });
                if (result.text) setBody(result.text);
              })
            }
            className="btn-secondary btn-sm"
          >
            {drafting ? t("inbox.suggesting") : t("inbox.suggest")}
          </button>
        )}
      </div>
    </form>
  );
}
