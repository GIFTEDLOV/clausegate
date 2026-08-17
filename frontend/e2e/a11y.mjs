import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer";

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const base = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const routes = ["/", "/rulebooks", "/decisions", "/certificates", "/submissions"];
const executable = process.env.PUPPETEER_EXECUTABLE_PATH || [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find(existsSync);
const goto = async (page, url) => { await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }); await new Promise((resolve) => setTimeout(resolve, 750)); };

const browser = await puppeteer.launch({ headless: true, executablePath: executable, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
try {
  const page = await browser.newPage();
  const failures = [];
  for (const route of routes) {
    await goto(page, `${base}${route}`);
    await page.addScriptTag({ content: axeSource });
    const result = await page.evaluate(async () => window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] }));
    if (result.violations.length) failures.push({ route, violations: result.violations.map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.map((node) => node.html) })) });
  }
  assert.deepEqual(failures, [], JSON.stringify(failures, null, 2));
  console.log(`frontend accessibility: PASS (${routes.length} routes)`);
} finally {
  await browser.close();
}
