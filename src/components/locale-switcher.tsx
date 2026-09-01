"use client";

import { useTransition } from "react";

import { setLocaleAction } from "@/server/actions";
import { LOCALES, type Locale } from "@/lib/i18n";

const LABELS: Record<Locale, string> = { en: "EN", uk: "УКР" };

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center rounded-full border border-[var(--color-line)] p-0.5">
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          disabled={pending}
          aria-pressed={code === locale}
          onClick={() =>
            startTransition(async () => {
              const data = new FormData();
              data.set("locale", code);
              await setLocaleAction(data);
            })
          }
          className={`rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors ${
            code === locale
              ? "bg-[var(--color-ink)] text-white"
              : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          }`}
        >
          {LABELS[code]}
        </button>
      ))}
    </div>
  );
}
