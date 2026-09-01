import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * PGlite ships Postgres as WebAssembly and resolves those assets relative to
   * its own package. Bundling it breaks that lookup, so it loads from
   * node_modules instead. Only the local driver needs this; Neon is plain HTTP.
   */
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
