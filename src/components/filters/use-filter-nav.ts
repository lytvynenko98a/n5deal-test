"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

/**
 * Filter controls write to the URL and let the server re-render. `replace`
 * keeps the back button meaning "the previous page" rather than "the previous
 * checkbox", which is what people expect on a faceted search screen.
 */
export function useFilterNav() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const commit = useCallback(
    (next: URLSearchParams) => {
      const query = next.toString();
      startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
    },
    [pathname, router],
  );

  const toggle = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams);
      const current = next.getAll(key);
      next.delete(key);
      const remaining = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      remaining.forEach((v) => next.append(key, v));
      commit(next);
    },
    [commit, searchParams],
  );

  const set = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set(key, value);
      else next.delete(key);
      commit(next);
    },
    [commit, searchParams],
  );

  const replaceAll = useCallback((next: URLSearchParams) => commit(next), [commit]);

  const clear = useCallback(() => {
    startTransition(() => router.replace(pathname, { scroll: false }));
  }, [pathname, router]);

  return { searchParams, toggle, set, replaceAll, clear, pending };
}
