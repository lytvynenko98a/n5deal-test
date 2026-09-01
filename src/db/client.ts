import "server-only";

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "./schema";

/**
 * One SQLite connection per Node process, cached on globalThis so the Next dev
 * server's module reloading does not open a new handle on every edit.
 *
 * Migrations run on first access. For a prototype this removes a setup step;
 * a real deployment would run them from CI instead.
 */

const DB_PATH = process.env.DATABASE_URL ?? path.join(process.cwd(), "data", "n5deal.db");

declare global {
  var __n5dealDb: ReturnType<typeof createClient> | undefined;
}

function createClient() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

  return db;
}

export const db = globalThis.__n5dealDb ?? createClient();

if (process.env.NODE_ENV !== "production") globalThis.__n5dealDb = db;

export { schema };
