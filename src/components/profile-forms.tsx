"use client";

import { useActionState } from "react";

import { ChipMultiSelect } from "@/components/chip-multiselect";
import { Field } from "@/components/ui";
import { fromCents } from "@/domain/money";
import {
  countryOptions,
  DEAL_TYPES,
  INVESTOR_TYPES,
  SECTORS,
  TIMELINES,
} from "@/domain/taxonomy";
import { useI18n } from "@/lib/i18n/client";
import type { BuyerView } from "@/server/mappers";
import type { SellerProfile, User } from "@/db/schema";
import {
  saveBuyerProfileAction,
  saveSellerProfileAction,
  type ActionState,
} from "@/server/actions";

export function BuyerProfileForm({ user, buyer }: { user: User; buyer: BuyerView }) {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveBuyerProfileAction,
    { ok: false },
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="card space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("profile.name")} error={state.errors?.name}>
            <input name="name" defaultValue={user.name} required className="field" />
          </Field>
          <Field label={t("profile.email")}>
            <input value={user.email} disabled className="field opacity-60" />
          </Field>
        </div>

        <Field label={t("profile.headline")} error={state.errors?.headline}>
          <input
            name="headline"
            defaultValue={buyer.profile.headline}
            placeholder={t("profile.headlinePlaceholder")}
            className="field"
          />
        </Field>

        <Field label={t("profile.about")}>
          <textarea
            name="about"
            rows={5}
            defaultValue={buyer.profile.about}
            placeholder={t("profile.aboutPlaceholder")}
            className="field resize-y"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("profile.country")}>
            <select name="country" defaultValue={buyer.profile.country} className="field">
              <option value="">—</option>
              {countryOptions(locale).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("profile.investorType")}>
            <select name="investorType" defaultValue={buyer.profile.investorType} className="field">
              {INVESTOR_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`investorType.${type}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("profile.timeline")}>
            <select name="timeline" defaultValue={buyer.profile.timeline} className="field">
              {TIMELINES.map((value) => (
                <option key={value} value={value}>
                  {t(`timeline.${value}`)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="card space-y-4 p-5">
        <Field label={t("profile.sectors")}>
          <ChipMultiSelect
            name="sectors"
            initial={buyer.sectors}
            options={SECTORS.map((value) => ({ value, label: t(`sector.${value}`) }))}
          />
        </Field>

        <Field label={t("profile.jurisdictions")}>
          <ChipMultiSelect
            name="jurisdictions"
            columns
            initial={buyer.jurisdictions}
            options={countryOptions(locale).map((c) => ({ value: c.code, label: `${c.flag} ${c.name}` }))}
          />
        </Field>

        <Field label={t("profile.dealTypes")}>
          <ChipMultiSelect
            name="dealTypes"
            initial={buyer.dealTypes}
            options={DEAL_TYPES.map((value) => ({ value, label: t(`dealType.${value}`) }))}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("profile.ticketMin")}>
            <input
              name="ticketMin"
              inputMode="numeric"
              defaultValue={fromCents(buyer.profile.ticketMinCents) || ""}
              className="field"
            />
          </Field>
          <Field label={t("profile.ticketMax")} error={state.errors?.ticketMax}>
            <input
              name="ticketMax"
              inputMode="numeric"
              defaultValue={fromCents(buyer.profile.ticketMaxCents) || ""}
              className="field"
            />
          </Field>
        </div>

        <label className="flex items-center gap-2.5 text-[13px]">
          <input
            type="checkbox"
            name="proofOfFunds"
            defaultChecked={buyer.profile.proofOfFunds}
            className="h-4 w-4 rounded border-[var(--color-line-strong)] accent-[var(--color-ink)]"
          />
          {t("profile.proofOfFunds")}
        </label>

        <div>
          <label className="flex items-center gap-2.5 text-[13px]">
            <input
              type="checkbox"
              name="listedInDirectory"
              defaultChecked={buyer.profile.listedInDirectory}
              className="h-4 w-4 rounded border-[var(--color-line-strong)] accent-[var(--color-ink)]"
            />
            {t("profile.listed")}
          </label>
          <p className="mt-1 pl-6 text-[12px] text-[var(--color-muted)]">{t("profile.listedHint")}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? t("common.saving") : t("common.save")}
        </button>
        {state.ok && (
          <span className="text-[13px] text-[var(--color-positive)]">{t("profile.updated")}</span>
        )}
      </div>
    </form>
  );
}

export function SellerProfileForm({
  user,
  profile,
}: {
  user: User;
  profile: SellerProfile;
}) {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveSellerProfileAction,
    { ok: false },
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="card space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("profile.name")} error={state.errors?.name}>
            <input name="name" defaultValue={user.name} required className="field" />
          </Field>
          <Field label={t("profile.email")}>
            <input value={user.email} disabled className="field opacity-60" />
          </Field>
          <Field label={t("profile.company")} error={state.errors?.company}>
            <input name="company" defaultValue={profile.company} required className="field" />
          </Field>
          <Field label={t("profile.country")}>
            <select name="country" defaultValue={profile.country} className="field">
              <option value="">—</option>
              {countryOptions(locale).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={t("profile.website")}>
          <input name="website" defaultValue={profile.website ?? ""} className="field" />
        </Field>

        <Field label={t("profile.sellerAbout")}>
          <textarea
            name="about"
            rows={5}
            defaultValue={profile.about}
            className="field resize-y"
          />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? t("common.saving") : t("common.save")}
        </button>
        {state.ok && (
          <span className="text-[13px] text-[var(--color-positive)]">{t("profile.updated")}</span>
        )}
      </div>
    </form>
  );
}
