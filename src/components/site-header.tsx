import Link from "next/link";

import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { unreadCount } from "@/server/queries";
import { signOutAction } from "@/server/actions";
import { LocaleSwitcher } from "./locale-switcher";
import { Badge, Logo } from "./ui";

export async function SiteHeader() {
  const [{ t, locale }, user] = await Promise.all([getT(), getCurrentUser()]);
  const unread = user && user.role !== "MANAGER" ? await unreadCount(user) : 0;

  const links: Array<{ href: string; label: string; badge?: number }> = [
    { href: "/listings", label: t("nav.listings") },
  ];

  if (user?.role === "SELLER") links.push({ href: "/buyers", label: t("nav.buyers") });
  if (user) links.push({ href: "/dashboard", label: t("nav.dashboard") });
  if (user && user.role !== "MANAGER") {
    links.push({ href: "/inbox", label: t("nav.inbox"), badge: unread });
  }
  if (user?.role === "MANAGER") links.push({ href: "/admin", label: t("nav.admin") });

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-6 px-4 sm:px-6">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="relative rounded-full px-3 py-2 text-sm font-medium text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]"
            >
              {link.label}
              {Boolean(link.badge) && (
                <span className="ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-[11px] font-semibold text-white">
                  {link.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LocaleSwitcher locale={locale} />

          {user?.role === "SELLER" && (
            <Link href="/assets/new" className="btn-secondary btn-sm hidden sm:inline-flex">
              {t("nav.newListing")}
            </Link>
          )}

          {user ? (
            <div className="flex items-center gap-2">
              <Link
                href={user.role === "MANAGER" ? "/admin" : "/profile"}
                className="hidden items-center gap-2 rounded-full border border-[var(--color-line)] py-1 pl-1 pr-3 sm:flex"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--color-ink)] text-[11px] font-semibold text-white">
                  {initials(user.name)}
                </span>
                <span className="text-[13px] font-medium">{user.name.split(" ")[0]}</span>
                <Badge tone="neutral">{t(`role.${user.role}`)}</Badge>
              </Link>
              <form action={signOutAction}>
                <button type="submit" className="btn-ghost btn-sm">
                  {t("nav.signOut")}
                </button>
              </form>
            </div>
          ) : (
            <Link href="/login" className="btn-primary btn-sm">
              {t("nav.signIn")}
            </Link>
          )}
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-t border-[var(--color-line)] px-4 py-2 md:hidden">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium text-[var(--color-ink-soft)]"
          >
            {link.label}
            {Boolean(link.badge) && <span className="ml-1 text-[var(--color-accent)]">{link.badge}</span>}
          </Link>
        ))}
      </nav>
    </header>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
