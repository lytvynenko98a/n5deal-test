import "server-only";

import fs from "node:fs";
import path from "node:path";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";

import * as schema from "./schema";

/**
 * One Postgres schema, two drivers.
 *
 * With `DATABASE_URL` set the app talks to Neon over HTTP, which is what runs on
 * Vercel. Without it, PGlite runs the same Postgres compiled to WebAssembly
 * against a directory under `data/`. That keeps `npm install && npm run db:seed
 * && npm run dev` working with no account and no container, while the deployed
 * build runs on a managed database. Same dialect, same migrations, same queries.
 *
 * The client is cached on globalThis so the dev server's module reloading does
 * not open a new handle on every edit.
 */

/** `memory://` gives an isolated throwaway database, which is what tests use. */
const PGLITE_DIR = process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), "data", "pg");
const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

export type Database =
  | PgliteDatabase<typeof schema>
  | ReturnType<typeof drizzleNeon<typeof schema>>;

declare global {
  var __n5dealDb: Promise<Database> | undefined;
}

function connectionString(): string | null {
  return process.env.DATABASE_URL?.trim() || null;
}

export function isManagedDatabase(): boolean {
  return connectionString() !== null;
}

async function connect(): Promise<Database> {
  const url = connectionString();

  if (url) {
    // Neon applies migrations from `npm run db:migrate`, not per request.
    return drizzleNeon(url, { schema });
  }

  const { PGlite } = await import("@electric-sql/pglite");
  if (!PGLITE_DIR.startsWith("memory://")) fs.mkdirSync(PGLITE_DIR, { recursive: true });
  const client = await PGlite.create({ dataDir: PGLITE_DIR });
  const db = drizzlePglite(client, { schema });

  // Local development has no migration step to forget, so run it on connect.
  await migratePglite(db, { migrationsFolder: MIGRATIONS_DIR });

  return db;
}

/**
 * Every read and write goes through this. It resolves once per process, so the
 * connection and the local migration run happen a single time.
 */
export function getDb(): Promise<Database> {
  globalThis.__n5dealDb ??= connect();
  return globalThis.__n5dealDb;
}

export { schema };
