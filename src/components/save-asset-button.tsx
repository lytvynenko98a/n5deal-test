"use client";

import { useTransition } from "react";

import { useI18n } from "@/lib/i18n/client";
import { toggleSaveAssetAction } from "@/server/actions";

export function SaveAssetButton({ assetId, saved }: { assetId: string; saved: boolean }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const data = new FormData();
          data.set("assetId", assetId);
          await toggleSaveAssetAction(data);
        })
      }
      className={saved ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
      aria-pressed={saved}
    >
      {saved ? `★ ${t("asset.unsave")}` : `☆ ${t("asset.save")}`}
    </button>
  );
}
