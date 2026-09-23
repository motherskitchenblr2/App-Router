#!/usr/bin/env node
/**
 * Post-build step: drop the PGLite engine assets next to the bundled Nitro
 * chunk that imports @electric-sql/pglite.
 *
 * @electric-sql/pglite's Emscripten loader resolves `pglite.data` and
 * `pglite.wasm` relative to the module that imports it. In dev (SSR from
 * node_modules) those files exist; in the bundled `.vercel/output` function
 * they are inlined into `electric-sql__pglite.mjs` whose directory has
 * neither file, so the embedded-Postgres fallback crashes at first connect.
 *
 * Deployed builds don't construct PGLite (DATABASE_URL -> Neon), so this only
 * matters for previews of the built output without a DATABASE_URL — the point
 * of it is to keep the built app's fallback working the same as dev.
 *
 *   npm run build   (wired in package.json after `vite build`)
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pgliteDist = join(
  root,
  "node_modules",
  "@electric-sql",
  "pglite",
  "dist",
);
const assets = [
  "pglite.data",
  "pglite.wasm",
  "initdb.wasm",
  "initdb.js",
].filter((name) => existsSync(join(pgliteDist, name)));

const functionsDir = join(root, ".vercel", "output", "functions");
if (!existsSync(functionsDir)) {
  console.log("[pglite-assets] no .vercel/output/functions — nothing to do.");
  process.exit(0);
}

let copied = 0;
for (const fnDir of readdirSync(functionsDir)) {
  const libsDir = join(functionsDir, fnDir, "_libs");
  if (!existsSync(libsDir)) continue;
  const libsEntries = readdirSync(libsDir);
  if (!libsEntries.some((name) => /pglite.*\.mjs$/.test(name))) continue;

  mkdirSync(libsDir, { recursive: true });
  for (const name of assets) {
    const src = join(pgliteDist, name);
    const dest = join(libsDir, name);
    copyFileSync(src, dest);
    copied += 1;
    console.log(
      `[pglite-assets] ${name} -> ${dest.replace(root + "/", "")} (${(statSync(dest).size / 1024 / 1024).toFixed(1)} MB)`,
    );
  }
}

console.log(
  copied
    ? `[pglite-assets] copied ${copied} PGLite engine asset(s) into the built output.`
    : "[pglite-assets] no PGLite chunk found in the built output — skipping.",
);