/**
 * End-to-end interactive QA: navigation, real Ollama send, slash menu,
 * settings dialog, theme toggle, tabs. Writes screenshots under /workspace/screenshots.
 */
import { chromium } from "playwright";
import fs from "node:fs";

const URL = process.env.QA_URL || "http://127.0.0.1:8080/";
const results = [];
const ok = (name, pass, detail = "") =>
  results.push({ name, pass: !!pass, detail: String(detail).slice(0, 300) });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));

// 1. Home
await page.goto(URL, { waitUntil: "networkidle", timeout: 45000 });
await page
  .waitForSelector("html[data-app-ready]", { timeout: 60000 })
  .catch(() => undefined);
await page.waitForTimeout(500);
ok("home: titlebar", await page.locator("header").count());
ok("home: sidebar", await page.locator("aside").count());
ok("home: h1=Projects", (await page.locator("h1").first().textContent())?.includes("Projects"));

// 2. New session -> chat view
await page.getByRole("button", { name: "New session" }).first().click();
const ta = page.locator("textarea");
// The chat route is code-split — on a cold server its chunk transform can
// outlast a fixed sleep, so wait for the composer instead of guessing.
await ta.waitFor({ timeout: 15000 }).catch(() => undefined);
ok("nav: on /chat", page.url().endsWith("/chat"), page.url());
ok("chat: composer present", (await ta.count()) === 1);
const ph = await ta.getAttribute("placeholder", { timeout: 5000 }).catch(() => null);
ok("chat: OpenCode placeholder", /for commands/.test(ph || ""), ph);

// 3. Slash menu
await ta.click();
await ta.fill("/");
await page.waitForTimeout(400);
const slashItems = await page.locator("text=/Commands/").count();
ok("slash: menu opens", slashItems > 0);
await page.screenshot({ path: "/workspace/screenshots/qa-slash-menu.png" });
await ta.press("Escape");
await ta.fill("");

// 4. Real send through Ollama
await ta.fill("Reply with exactly: PONG");
await page.waitForTimeout(200);
await page.keyboard.press("Enter");
await page.waitForTimeout(1500);
const stopBtn = await page.getByRole("button", { name: "Stop" }).count();
ok("send: streaming started (stop btn)", stopBtn > 0);
// Wait for completion — up to 60s
let done = false;
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(1000);
  const stillStreaming = await page.getByRole("button", { name: "Stop" }).count();
  if (stillStreaming === 0) {
    done = true;
    break;
  }
}
const bodyText = await page.evaluate(() => document.body.innerText);
ok("send: completed", done);
ok("send: got model output", /PONG/i.test(bodyText), bodyText.slice(0, 200));
ok(
  "send: message actions present (Copy)",
  (await page.getByRole("button", { name: "Copy" }).count()) > 0,
);
await page.screenshot({ path: "/workspace/screenshots/qa-chat-response.png" });

// 5. Titlebar tab created
const tabs = await page.locator('[role="tab"]').count();
ok("tabs: at least one", tabs >= 1, `count=${tabs}`);

// 6. Settings dialog
await page.getByRole("button", { name: "Settings" }).first().click();
await page.waitForTimeout(500);
const dialogVisible = await page.locator('[role="dialog"]').count();
ok("settings: dialog opens", dialogVisible > 0);
const settingsText = await page.evaluate(() => document.body.innerText);
ok("settings: thinking level section", /Thinking level/i.test(settingsText));
ok("settings: autonomy section", /Autonomy/i.test(settingsText));
ok("settings: Ollama server section", /Ollama server/i.test(settingsText));
await page.screenshot({ path: "/workspace/screenshots/qa-settings.png" });

// 7. Theme toggle via settings (Light/Dark segmented)
const darkBtn = page.locator('[role="dialog"] button', { hasText: /^Dark$/ }).first();
if (await darkBtn.count()) {
  await darkBtn.click();
  await page.waitForTimeout(400);
  const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  ok("theme: dark applied", isDark);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok("theme: body bg dark", bg !== "rgb(250, 250, 250)", bg);
  await page.screenshot({ path: "/workspace/screenshots/qa-dark-settings.png" });
  const lightBtn = page.locator('[role="dialog"] button', { hasText: /^Light$/ }).first();
  await lightBtn.click();
  await page.waitForTimeout(300);
}
// Close dialog
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// 7b. Reasoning: thinking=low must stream reasoning and render the Thought chip
await page.evaluate(() => {
  const raw = localStorage.getItem("grok-ai:settings");
  const cur = raw ? JSON.parse(raw) : {};
  localStorage.setItem("grok-ai:settings", JSON.stringify({ ...cur, thinking: "low" }));
});
await page.reload({ waitUntil: "networkidle", timeout: 45000 });
await page
  .waitForSelector("html[data-app-ready]", { timeout: 60000 })
  .catch(() => undefined);
const ta2 = page.locator("textarea");
await ta2.waitFor({ timeout: 20000 });
await ta2.fill("2+2? Answer with just the digit.");
await page.keyboard.press("Enter");
await page.waitForTimeout(2500);
ok("think: streaming started", (await page.getByRole("button", { name: "Stop" }).count()) > 0);
let thinkDone = false;
// CPU inference with reasoning runs ~3-4 tok/s here — allow a generous budget.
for (let i = 0; i < 180; i++) {
  await page.waitForTimeout(1000);
  if ((await page.getByRole("button", { name: "Stop" }).count()) === 0) {
    thinkDone = true;
    break;
  }
}
ok("think: send completed", thinkDone);
const thinkBody = await page.evaluate(() => document.body.innerText);
ok("think: Thought chip rendered", /\d+ Thought/.test(thinkBody), thinkBody.slice(0, 200));
await page.screenshot({ path: "/workspace/screenshots/qa-thought-chip.png" });

// 8. Sidebar session row + home nav via titlebar home button
await page.getByRole("button", { name: "Home" }).click();
await page.waitForTimeout(700);
ok("nav: home again", (await page.locator("h1").first().textContent())?.includes("Projects"));
const recent = await page.evaluate(() => document.body.innerText);
ok("home: session listed after send", /PONG|New conversation|reply/i.test(recent));
await page.screenshot({ path: "/workspace/screenshots/qa-home-after.png" });

// 9. Model picker popover
await page.getByRole("button", { name: "New session" }).first().click();
await page.waitForTimeout(700);
const modelBtn = page.locator("#composer-model-button");
ok("composer: model button", (await modelBtn.count()) > 0);
if (await modelBtn.count()) {
  await modelBtn.click();
  await page.waitForTimeout(600);
  const bodyHasModels = await page.evaluate(() => document.body.innerText);
  ok("model picker: opens with list", /Select a model|llama|smollm|Device Adviser/i.test(bodyHasModels));
  await page.screenshot({ path: "/workspace/screenshots/qa-model-picker.png" });
  await page.keyboard.press("Escape");
}

// 10. Mobile drawer
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
mobile.on("pageerror", (e) => consoleErrors.push("mobile pageerror: " + e.message));
await mobile.goto(URL, { waitUntil: "networkidle", timeout: 45000 });
await mobile
  .waitForSelector("html[data-app-ready]", { timeout: 60000 })
  .catch(() => undefined);
await mobile.waitForTimeout(500);
const menuBtn = mobile.getByRole("button", { name: "Toggle sidebar" }).first();
ok("mobile: menu button", (await menuBtn.count()) > 0);
if (await menuBtn.count()) {
  await menuBtn.click();
  await mobile.waitForTimeout(500);
  const drawerText = await mobile.evaluate(() => document.body.innerText);
  ok("mobile: drawer opens", /Incognito session|Sessions/.test(drawerText));
  await mobile.screenshot({ path: "/workspace/screenshots/qa-mobile-drawer.png" });
}
const overflow = await mobile.evaluate(
  () => document.documentElement.scrollWidth > window.innerWidth + 1,
);
ok("mobile: no horizontal overflow", !overflow);
await mobile.close();

// Filter console errors (Ollama probe noise is expected)
const realErrors = consoleErrors.filter(
  (e) => !/Failed to load resource|net::ERR|11434|ollama/i.test(e),
);
ok("console: clean", realErrors.length === 0, JSON.stringify(realErrors.slice(0, 5)));

await browser.close();

const report = { results, pass: results.filter((r) => r.pass).length, total: results.length, consoleErrors };
fs.writeFileSync("/workspace/screenshots/qa-e2e.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(results.every((r) => r.pass) ? 0 : 1);
