"use client";

import { useActionState, useEffect, useRef } from "react";

import { useI18n } from "@/lib/i18n/client";
import { sendMessageAction, type ActionState } from "@/server/actions";

export function MessageComposer({ conversationId }: { conversationId: string }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(sendMessageAction, {
    ok: false,
  });
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the box once the server confirms the send, not on submit — a failed
  // send should leave the text where the person can retry it.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="border-t border-[var(--color-line)] p-4"
    >
      <input type="hidden" name="conversationId" value={conversationId} />
      <textarea
        name="body"
        rows={3}
        placeholder={t("inbox.placeholder")}
        className="field resize-y"
      />
      {state.errors?.body && (
        <p className="mt-1 text-[12px] text-[var(--color-danger)]">{state.errors.body}</p>
      )}
      <button type="submit" disabled={pending} className="btn-primary btn-sm mt-2">
        {t("common.send")}
      </button>
    </form>
  );
}
