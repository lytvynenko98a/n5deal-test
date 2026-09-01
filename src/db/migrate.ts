/**
 * Applies migrations to the database in DATABASE_URL. Vercel runs this in the
 * build step; local development migrates on connect instead (src/db/client.ts).
 */
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.log("DATABASE_URL is not set. Local development migrates on connect; nothing to do.");
  process.exit(0);
}

migrate(drizzle(neon(url)), { migrationsFolder: path.join(process.cwd(), "drizzle") }).then(
  () => console.log("Migrations applied."),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
