/**
 * Visual QA for the OpenCode-replica UI.
 * Extracts computed styles + DOM structure + a pixel sanity check
 * (no white-on-white text) for desktop and mobile.
 */
import { chromium } from "playwright";
import fs from "node:fs";

const URL = process.env.QA_URL || "http://127.0.0.1:8080/";

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
};

async function inspect(viewport, name) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport });
  const consoleErrors = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));

  await page.goto(URL, { waitUntil: "networkidle", timeout: 45000 });
  await page
    .waitForSelector("html[data-app-ready]", { timeout: 60000 })
    .catch(() => undefined);
  await page.waitForTimeout(800);

  const report = await page.evaluate(() => {
    const cs = (el) => (el ? window.getComputedStyle(el) : null);
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const s = cs(el);
      return {
        sel,
        text: (el.textContent || "").trim().slice(0, 80),
        color: s.color,
        bg: s.backgroundColor,
        font: s.fontFamily.split(",")[0].replace(/["']/g, ""),
        size: s.fontSize,
        weight: s.fontWeight,
        height: Math.round(el.getBoundingClientRect().height),
        visible: el.getBoundingClientRect().height > 0,
      };
    };

    // Contrast: text color vs nearest opaque background.
    const luminance = (rgb) => {
      const [r, g, b] = rgb.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
      const f = (c) => {
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (fg, bg) => {
      const l1 = luminance(fg),
        l2 = luminance(bg);
      const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
      return +(((hi + 0.05) / (lo + 0.05)).toFixed(2));
    };
    const opaqueBg = (el) => {
      let node = el;
      while (node && node !== document.documentElement) {
        const s = window.getComputedStyle(node).backgroundColor;
        if (s && !s.includes("rgba(0, 0, 0, 0)") && !s.includes("transparent")) return s;
        node = node.parentElement;
      }
      return "rgb(255, 255, 255)";
    };

    const contrastChecks = [];
    const seen = new Set();
    for (const el of document.querySelectorAll("h1,h2,p,span,button,a,div")) {
      if (contrastChecks.length >= 24) break;
      const direct = [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent.trim().length > 1,
      );
      if (!direct) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const s = window.getComputedStyle(el);
      if (s.visibility === "hidden" || s.opacity === "0") continue;
      const key = s.color + "|" + s.fontSize;
      if (seen.has(key)) continue;
      seen.add(key);
      const bg = opaqueBg(el);
      const cr = ratio(s.color, bg);
      contrastChecks.push({
        text: (el.textContent || "").trim().slice(0, 40),
        color: s.color,
        bg,
        size: s.fontSize,
        ratio: cr,
        pass: cr >= 4.5 || (parseFloat(s.fontSize) >= 18 && cr >= 3),
      });
    }

    // Key structure
    const has = (sel) => !!document.querySelector(sel);
    const bodyText = (document.body.innerText || "").trim();

    return {
      html: {
        bg: window.getComputedStyle(document.body).backgroundColor,
        color: window.getComputedStyle(document.body).color,
        font: window.getComputedStyle(document.body).fontFamily.split(",")[0],
        size: window.getComputedStyle(document.body).fontSize,
        isDark: document.documentElement.classList.contains("dark"),
      },
      structure: {
        titlebar: has("header"),
        sidebar: has("aside") || has("nav"),
        homeHeading: has("h1"),
        h1Text: document.querySelector("h1")?.textContent?.trim() ?? null,
        projectCards: document.querySelectorAll("button").length,
        rootLabel: bodyText.includes("root"),
        sections: ["Projects", "Recent sessions"].filter((s) => bodyText.includes(s)),
      },
      contrastChecks,
      contrastFails: contrastChecks.filter((c) => !c.pass),
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      bodyTextLen: bodyText.length,
      bodyTextPrefix: bodyText.slice(0, 200),
    };
  });

  report.viewport = name;
  report.consoleErrors = consoleErrors;
  await page.screenshot({ path: `/workspace/screenshots/qa-${name}.png`, fullPage: false });
  await browser.close();
  return report;
}

const out = {};
for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  out[name] = await inspect(viewport, name);
}
fs.writeFileSync("/workspace/screenshots/qa-interactive.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
