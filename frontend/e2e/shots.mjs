import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer";

const base = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const routes = ["/", "/rulebooks", "/decisions", "/certificates", "/submissions"];
const widths = [375, 768, 1440];
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
  const errors = [];
  page.on("pageerror", (error) => { if (!/rpc-bradbury\.genlayer\.com|dynamicauth|dynamic-labs|Failed to fetch/i.test(error.message)) errors.push(error.message); });
  page.on("console", (message) => { if (message.type() === "error" && !/rpc-bradbury\.genlayer\.com|dynamicauth|dynamic-labs|Failed to fetch/i.test(message.text())) errors.push(message.text()); });
  for (const width of widths) {
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    for (const route of routes) {
      errors.length = 0;
      await goto(page, `${base}${route}`);
      const result = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        brokenFonts: [...document.fonts].filter((font) => font.status === "error").map((font) => font.family),
        brokenImages: [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).length,
      }));
      assert.equal(result.overflow, false, `${route} overflows at ${width}`);
      assert.deepEqual(result.brokenFonts, [], `${route} broken fonts`);
      assert.equal(result.brokenImages, 0, `${route} broken images`);
      assert.deepEqual(errors, [], `${route} console errors`);
    }
  }
  console.log(`frontend visual/console/request sweep: PASS (${routes.length} routes x ${widths.length} widths)`);
} finally {
  await browser.close();
}
