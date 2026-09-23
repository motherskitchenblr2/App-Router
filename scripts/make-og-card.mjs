#!/usr/bin/env node
/**
 * Brand-asset pass (self-serve): renders the 1200x630 share card for GrokShell
 * from hand-drawn SVG geometry + text, rasterizes with sharp, and writes
 * `public/og.jpg` + `src/lib/og/site.json`.
 *
 *   node scripts/make-og-card.mjs
 *
 * Art is pure SVG (allowed art path when no image-gen tools are present):
 * dark canvas, red-orange accent, stroke-drawn chip glyph, no raster deps.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const BG = "#0B0B0F";
const PANEL = "#131318";
const INK = "#F5F4F0";
const MUTED = "#8B8894";
const ACCENT = "#F83A2D";

const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="0.12" cy="0.05" r="0.9">
      <stop offset="0" stop-color="${ACCENT}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${INK}"/>
      <stop offset="1" stop-color="#C9C6D4"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="${BG}"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <!-- fine grid -->
  <g stroke="${INK}" stroke-opacity="0.04" stroke-width="1">
    ${Array.from({ length: 48 }, (_, i) => `<line x1="${i * 25}" y1="0" x2="${i * 25}" y2="630"/>`).join("")}
    ${Array.from({ length: 26 }, (_, i) => `<line x1="0" y1="${i * 25}" x2="1200" y2="${i * 25}"/>`).join("")}
  </g>

  <!-- chip glyph (right) -->
  <g transform="translate(900,315)" fill="none" stroke="${ACCENT}" stroke-width="6" stroke-linejoin="round">
    <rect x="-150" y="-120" width="300" height="240" rx="28" stroke-opacity="0.9"/>
    <rect x="-100" y="-70" width="200" height="140" rx="14" stroke-opacity="0.55"/>
    <g stroke-opacity="0.85">
      <line x1="-110" y1="-60" x2="-190" y2="-60"/>
      <line x1="-110" y1="0" x2="-190" y2="0"/>
      <line x1="-110" y1="60" x2="-190" y2="60"/>
      <line x1="110" y1="-60" x2="190" y2="-60"/>
      <line x1="110" y1="0" x2="190" y2="0"/>
      <line x1="110" y1="60" x2="190" y2="60"/>
      <line x1="-60" y1="-110" x2="-60" y2="-190"/>
      <line x1="0" y1="-110" x2="0" y2="-190"/>
      <line x1="60" y1="-110" x2="60" y2="-190"/>
      <line x1="-60" y1="110" x2="-60" y2="190"/>
      <line x1="0" y1="110" x2="0" y2="190"/>
      <line x1="60" y1="110" x2="60" y2="190"/>
    </g>
    <circle cx="-50" cy="-30" r="16" fill="${ACCENT}" fill-opacity="0.35" stroke="none"/>
    <circle cx="40" cy="-30" r="16" fill="${ACCENT}" fill-opacity="0.2" stroke="none"/>
    <rect x="-70" y="30" width="140" height="16" rx="8" fill="${ACCENT}" fill-opacity="0.3" stroke="none"/>
  </g>

  <!-- spark mark -->
  <g transform="translate(96,208)" fill="${ACCENT}">
    <path d="M0 -34 C6 -10 10 -6 34 0 C10 6 6 10 0 34 C-6 10 -10 6 -34 0 C-10 -6 -6 -10 0 -34 Z"/>
    <circle cx="-13" cy="-13" r="8" fill="${BG}"/>
  </g>
  <g transform="translate(122,186)" fill="${ACCENT}">
    <path d="M0 -14 C2.5 -4 4 -2.5 14 0 C4 2.5 2.5 4 0 14 C-2.5 4 -4 2.5 -14 0 C-4 -2.5 -2.5 -4 0 -14 Z"/>
  </g>

  <!-- wordmark -->
  <text x="96" y="296" font-family="Inter, DejaVu Sans, Arial, sans-serif" font-size="108" font-weight="700" letter-spacing="-2" fill="url(#fade)">GrokShell</text>

  <!-- tagline -->
  <text x="97" y="362" font-family="Inter, DejaVu Sans, Arial, sans-serif" font-size="36" fill="${MUTED}">Free, uncapped AI — running on <tspan fill="${INK}">your device</tspan>.</text>

  <!-- model chip pill -->
  <g transform="translate(96,430)">
    <rect x="0" y="0" width="560" height="58" rx="29" fill="${PANEL}" stroke="${INK}" stroke-opacity="0.14" stroke-width="2"/>
    <circle cx="29" cy="29" r="7" fill="${ACCENT}"/>
    <text x="52" y="41" font-family="Inter, DejaVu Sans, Arial, sans-serif" font-size="26" fill="${INK}">Local · Ollama · WebGPU · No rate caps</text>
  </g>

  <!-- footer -->
  <text x="96" y="572" font-family="Inter, DejaVu Sans, Arial, sans-serif" font-size="22" fill="${MUTED}" fill-opacity="0.7">GrokShell — open-source friendly, yours to run.</text>
</svg>`;

async function main() {
  const out = join(root, "public", "og.jpg");
  const site = join(root, "src", "lib", "og", "site.json");
  mkdirSync(dirname(out), { recursive: true });
  mkdirSync(dirname(site), { recursive: true });

  const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
  writeFileSync(out, jpeg);

  writeFileSync(
    site,
    JSON.stringify({ title: "GrokShell AI", card: "custom", color: "0B0B0F" }, null, 2) + "\n",
  );

  const md = readFileSync(join(root, "public", "og.jpg"));
  console.log(
    JSON.stringify({ ok: true, ogJpgBytes: md.length, siteJson: JSON.parse(readFileSync(site, "utf8")) }, null, 2),
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err) }, null, 2));
  process.exit(1);
});