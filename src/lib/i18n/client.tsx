"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { createTranslator, DEFAULT_LOCALE, type Locale, type Translator } from "./index";

const LocaleContext = createContext<{ locale: Locale; t: Translator }>({
  locale: DEFAULT_LOCALE,
  t: createTranslator(DEFAULT_LOCALE),
});

/**
 * Client components read the same dictionaries as the server. Both bundles ship
 * to the browser (they are a few kB of strings), which keeps the provider a
 * single value rather than a payload passed through every tree.
 */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: createTranslator(locale) }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  return useContext(LocaleContext);
}
