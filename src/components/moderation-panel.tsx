"use client";

import { useActionState, useState } from "react";

import { useI18n } from "@/lib/i18n/client";
import { moderateAssetAction, moderateUserAction, type ActionState } from "@/server/actions";

type Props = {
  targetType: "USER" | "ASSET";
  targetId: string;
  targetLabel: string;
  suspended: boolean;
  removed?: boolean;
  compact?: boolean;
};

/**
 * Suspension and removal always ask for a reason before they run. The reason is
 * what the participant sees on their next sign-in and what the audit trail
 * keeps, so an untyped one-click suspend would leave both empty.
 */
export function ModerationPanel({
  targetType,
  targetId,
  targetLabel,
  suspended,
  removed = false,
  compact = false,
}: Props) {
  const { t } = useI18n();
  const action = targetType === "USER" ? moderateUserAction : moderateAssetAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, { ok: false });
  const [open, setOpen] = useState<string | null>(null);

  const restoreAction = targetType === "USER" ? "REINSTATE" : "RELIST_ASSET";
  const suspendAction = targetType === "USER" ? "SUSPEND" : "UNLIST_ASSET";
  const inactive = suspended || removed;

  const buttons = inactive
    ? [{ key: restoreAction, label: targetType === "USER" ? t("admin.reinstate") : t("admin.relist"), danger: false }]
    : [
        { key: suspendAction, label: targetType === "USER" ? t("admin.suspend") : t("admin.unlist"), danger: true },
        ...(targetType === "USER"
          ? [{ key: "REMOVE", label: t("admin.remove"), danger: true }]
          : []),
      ];

  if (open) {
    return (
      <form action={formAction} className={compact ? "" : "card p-4"}>
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="action" value={open} />
        <p className="text-[13px] font-semibold">
          {open === "REMOVE"
            ? t("admin.removeTitle", { name: targetLabel })
            : open === suspendAction
              ? targetType === "USER"
                ? t("admin.suspendTitle", { name: targetLabel })
                : t("admin.unlistTitle", { name: targetLabel })
              : targetLabel}
        </p>
        <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">
          {open === "REMOVE"
            ? t("admin.removeBody")
            : targetType === "USER"
              ? t("admin.suspendBody")
              : t("admin.unlistBody")}
        </p>
        <textarea
          name="reason"
          rows={3}
          required
          minLength={8}
          placeholder={t("admin.reasonPlaceholder")}
          className="field mt-2 resize-y text-[13px]"
        />
        {state.errors?.reason && (
          <p className="mt-1 text-[12px] text-[var(--color-danger)]">{t("admin.reasonRequired")}</p>
        )}
        <div className="mt-2 flex gap-2">
          <button type="submit" disabled={pending} className="btn-danger btn-sm">
            {t("common.confirm")}
          </button>
          <button type="button" onClick={() => setOpen(null)} className="btn-ghost btn-sm">
            {t("common.cancel")}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className={compact ? "flex gap-1.5" : "card flex gap-2 p-4"}>
      {buttons.map((button) => (
        <button
          key={button.key}
          type="button"
          onClick={() => setOpen(button.key)}
          className={button.danger ? "btn-danger btn-sm" : "btn-secondary btn-sm"}
        >
          {button.label}
        </button>
      ))}
    </div>
  );
}
