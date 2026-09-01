import "server-only";

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getDb } from "@/db/client";
import { sessions, users, type User } from "@/db/schema";
import { newId } from "./ids";
import type { UserRole } from "@/domain/taxonomy";

/**
 * Sessions are rows in SQLite with an opaque id in an httpOnly cookie.
 *
 * The prototype has no passwords: a visitor picks a demo account and the server
 * issues a session for it. Reviewers can switch between the three roles in two
 * clicks, which is what this build needs to demonstrate. Swapping in a real
 * credential check touches one function, `signIn`, because everything
 * downstream reads the session row rather than the cookie contents.
 */

const COOKIE = "n5deal_session";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TTL_DAYS = 30;

export async function signIn(userId: string): Promise<void> {
  const id = newId();
  const expiresAt = new Date(Date.now() + TTL_DAYS * 86_400_000);

  const db = await getDb();
  await db.insert(sessions).values({ id, userId, expiresAt: expiresAt.toISOString() });

  const jar = await cookies();
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) {
    const db = await getDb();
    await db.delete(sessions).where(eq(sessions.id, id));
  }
  jar.delete(COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  // The column is a uuid, so a hand-edited cookie must not reach the query.
  if (!id || !UUID.test(id)) return null;

  const db = await getDb();
  const [row] = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id));

  if (!row) return null;
  if (new Date(row.expiresAt) < new Date()) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  // A manager can suspend an account mid-session; the next request ends it.
  if (row.user.status !== "ACTIVE") return null;

  return row.user;
}

export async function requireUser(...roles: UserRole[]): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles.length && !roles.includes(user.role)) redirect("/dashboard");
  return user;
}
