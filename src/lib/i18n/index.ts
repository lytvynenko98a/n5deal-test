import { en, type TranslationKey } from "./en";
import { uk } from "./uk";

export const LOCALES = ["en", "uk"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "n5deal_locale";

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { en, uk };

export type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Interpolates {name} placeholders. Missing keys fall back to English rather
 * than rendering a raw key, so a gap in the Ukrainian file degrades to a
 * readable page instead of "dashboard.hello".
 */
export function createTranslator(locale: Locale): Translator {
  const dict = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];

  return (key, values) => {
    const template = dict[key] ?? en[key] ?? key;
    if (!values) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in values ? String(values[name]) : match,
    );
  };
}

export function getDictionary(locale: Locale): Record<TranslationKey, string> {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

export type { TranslationKey };
