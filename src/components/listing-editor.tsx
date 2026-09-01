"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { Field } from "@/components/ui";
import { reviewListing, type ListingDraft, type IssueSeverity } from "@/domain/listing-quality";
import { fromCents } from "@/domain/money";
import { BUSINESS_STATUSES, countryOptions, DEAL_TYPES, SECTORS } from "@/domain/taxonomy";
import { useI18n } from "@/lib/i18n/client";
import type { Asset } from "@/db/schema";
import { deleteAssetAction, saveAssetAction, type ActionState } from "@/server/actions";

/**
 * The listing form and its review panel read the same draft state, so the
 * feedback moves as the seller types rather than after a failed submit. The
 * server re-runs the identical `reviewListing` before publishing — the panel is
 * guidance, the server call is the gate.
 */
export function ListingEditor({ asset }: { asset: Asset | null }) {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveAssetAction, {
    ok: false,
  });

  const [draft, setDraft] = useState<ListingDraft>(() => ({
    title: asset?.title ?? "",
    summary: asset?.summary ?? "",
    description: asset?.description ?? "",
    sector: asset?.sector ?? "",
    country: asset?.country ?? "",
    jurisdiction: asset?.jurisdiction ?? "",
    licenseType: asset?.licenseType ?? "",
    businessStatus: asset?.businessStatus ?? "ACTIVE",
    dealType: asset?.dealType ?? "FULL_SALE",
    stakeOffered: asset?.stakeOffered ?? 100,
    askingPriceCents: asset?.askingPriceCents ?? 0,
    revenueCents: asset?.revenueCents ?? 0,
    ebitdaCents: asset?.ebitdaCents ?? 0,
    employees: asset?.employees ?? 0,
    foundedYear: asset?.foundedYear ?? null,
  }));

  const review = useMemo(() => reviewListing(draft), [draft]);

  const text =
    <K extends keyof ListingDraft>(key: K) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setDraft((d) => ({ ...d, [key]: event.target.value }) as ListingDraft);

  const money =
    (key: "askingPriceCents" | "revenueCents" | "ebitdaCents") =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setDraft((d) => ({ ...d, [key]: Math.round(Number(event.target.value || 0) * 100) }));

  const number =
    (key: "employees" | "stakeOffered") => (event: React.ChangeEvent<HTMLInputElement>) =>
      setDraft((d) => ({ ...d, [key]: Number(event.target.value || 0) }));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <form action={formAction} className="space-y-5">
        {asset && <input type="hidden" name="id" value={asset.id} />}

        <section className="card space-y-4 p-5">
          <h2 className="section-title">{t("editor.basics")}</h2>

          <Field label={t("editor.assetTitle")}>
            <input
              name="title"
              value={draft.title}
              onChange={text("title")}
              placeholder={t("editor.assetTitlePlaceholder")}
              className="field"
            />
          </Field>

          <Field label={t("editor.summary")}>
            <textarea
              name="summary"
              rows={2}
              value={draft.summary}
              onChange={text("summary")}
              placeholder={t("editor.summaryPlaceholder")}
              className="field resize-y"
            />
          </Field>

          <Field label={t("editor.description")}>
            <textarea
              name="description"
              rows={10}
              value={draft.description}
              onChange={text("description")}
              placeholder={t("editor.descriptionPlaceholder")}
              className="field resize-y"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("listings.sector")}>
              <select name="sector" value={draft.sector} onChange={text("sector")} className="field">
                <option value="">—</option>
                {SECTORS.map((sector) => (
                  <option key={sector} value={sector}>
                    {t(`sector.${sector}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("profile.country")}>
              <select name="country" value={draft.country} onChange={text("country")} className="field">
                <option value="">—</option>
                {countryOptions(locale).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="section-title">{t("editor.regulatory")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("asset.jurisdiction")}>
              <input
                name="jurisdiction"
                value={draft.jurisdiction}
                onChange={text("jurisdiction")}
                placeholder={t("editor.jurisdictionPlaceholder")}
                className="field"
              />
            </Field>
            <Field label={t("editor.licenceType")}>
              <input
                name="licenseType"
                value={draft.licenseType}
                onChange={text("licenseType")}
                placeholder={t("editor.licenceTypePlaceholder")}
                className="field"
              />
            </Field>
          </div>
          <Field label={t("listings.businessStatus")}>
            <select
              name="businessStatus"
              value={draft.businessStatus}
              onChange={text("businessStatus")}
              className="field"
            >
              {BUSINESS_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`businessStatus.${status}`)}
                </option>
              ))}
            </select>
          </Field>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="section-title">{t("editor.financials")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("editor.askingPrice")}>
              <input
                name="askingPrice"
                inputMode="numeric"
                defaultValue={fromCents(draft.askingPriceCents) || ""}
                onChange={money("askingPriceCents")}
                className="field"
              />
            </Field>
            <Field label={t("editor.revenue")}>
              <input
                name="revenue"
                inputMode="numeric"
                defaultValue={fromCents(draft.revenueCents) || ""}
                onChange={money("revenueCents")}
                className="field"
              />
            </Field>
            <Field label={t("editor.ebitda")}>
              <input
                name="ebitda"
                inputMode="numeric"
                defaultValue={fromCents(draft.ebitdaCents) || ""}
                onChange={money("ebitdaCents")}
                className="field"
              />
            </Field>
            <Field label={t("editor.employees")}>
              <input
                name="employees"
                inputMode="numeric"
                defaultValue={draft.employees || ""}
                onChange={number("employees")}
                className="field"
              />
            </Field>
            <Field label={t("editor.foundedYear")}>
              <input
                name="foundedYear"
                inputMode="numeric"
                defaultValue={draft.foundedYear ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    foundedYear: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                className="field"
              />
            </Field>
          </div>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="section-title">{t("editor.deal")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("listings.dealType")}>
              <select name="dealType" value={draft.dealType} onChange={text("dealType")} className="field">
                {DEAL_TYPES.map((deal) => (
                  <option key={deal} value={deal}>
                    {t(`dealType.${deal}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("editor.stake")}>
              <input
                name="stakeOffered"
                inputMode="numeric"
                defaultValue={draft.stakeOffered}
                onChange={number("stakeOffered")}
                className="field"
              />
            </Field>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            name="intent"
            value="draft"
            disabled={pending}
            className="btn-secondary"
          >
            {t("editor.saveDraft")}
          </button>

          {asset?.status === "PUBLISHED" ? (
            <button type="submit" name="intent" value="unpublish" className="btn-ghost">
              {t("editor.unpublish")}
            </button>
          ) : (
            <button
              type="submit"
              name="intent"
              value="publish"
              disabled={pending || !review.canPublish}
              className="btn-primary"
              title={review.canPublish ? undefined : t("editor.publishBlocked")}
            >
              {t("editor.publish")}
            </button>
          )}

          {state.ok && (
            <span className="text-[13px] text-[var(--color-positive)]">{t("common.saved")}</span>
          )}
          {state.message === "blocked" && (
            <span className="text-[13px] text-[var(--color-danger)]">
              {t("editor.publishBlocked")}
            </span>
          )}
          {asset && (
            <Link href={`/listings/${asset.id}`} className="btn-ghost btn-sm ml-auto">
              {t("common.viewAll")} →
            </Link>
          )}
        </div>
      </form>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <ReviewPanel review={review} />

        {asset && (
          <form action={deleteAssetAction} className="card p-4">
            <input type="hidden" name="id" value={asset.id} />
            <p className="text-[13px] font-semibold">{t("editor.deleteTitle")}</p>
            <button type="submit" className="btn-danger btn-sm mt-2">
              {t("editor.delete")}
            </button>
          </form>
        )}
      </aside>
    </div>
  );
}

const SEVERITY_ORDER: IssueSeverity[] = ["error", "warning", "tip"];
const SEVERITY_COLOR: Record<IssueSeverity, string> = {
  error: "var(--color-danger)",
  warning: "var(--color-warn)",
  tip: "var(--color-muted)",
};

function ReviewPanel({ review }: { review: ReturnType<typeof reviewListing> }) {
  const { t } = useI18n();
  const headings: Record<IssueSeverity, string> = {
    error: t("editor.errors"),
    warning: t("editor.warnings"),
    tip: t("editor.tips"),
  };

  return (
    <div className="card p-5">
      <h2 className="section-title">{t("editor.reviewTitle")}</h2>
      <p className="mt-0.5 text-[12.5px] text-[var(--color-muted)]">{t("editor.reviewBody")}</p>

      <div className="mt-4">
        <div className="flex items-end justify-between">
          <span className="text-[12.5px] text-[var(--color-muted)]">{t("editor.strength")}</span>
          <span className="text-lg font-semibold tracking-tight">{review.score}</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--color-line)]">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${review.score}%`,
              background:
                review.score >= 80
                  ? "var(--color-positive)"
                  : review.score >= 50
                    ? "var(--color-warn)"
                    : "var(--color-danger)",
            }}
          />
        </div>
      </div>

      {review.issues.length === 0 ? (
        <p className="mt-4 text-[13px] text-[var(--color-positive)]">{t("editor.noIssues")}</p>
      ) : (
        <div className="mt-4 space-y-4">
          {SEVERITY_ORDER.map((severity) => {
            const issues = review.issues.filter((i) => i.severity === severity);
            if (!issues.length) return null;
            return (
              <div key={severity}>
                <p
                  className="text-[11.5px] font-semibold uppercase tracking-wide"
                  style={{ color: SEVERITY_COLOR[severity] }}
                >
                  {headings[severity]}
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {issues.map((issue) => (
                    <li
                      key={`${issue.field}-${issue.key}`}
                      className="text-[13px] leading-snug text-[var(--color-ink-soft)]"
                    >
                      {t(issue.key as never, issue.values)}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
