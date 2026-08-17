import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer";

const base = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const routes = ["/", "/rulebooks", "/rulebooks/new", "/decisions", "/certificates", "/submissions"];
const widths = [375, 1440];
const executable = process.env.PUPPETEER_EXECUTABLE_PATH || [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find(existsSync);
const goto = async (page, url) => { const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }); await new Promise((resolve) => setTimeout(resolve, 750)); return response; };

const browser = await puppeteer.launch({ headless: true, executablePath: executable, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
try {
  const page = await browser.newPage();
  const fatal = [];
  const failedLocal = [];
  page.on("pageerror", (error) => {
    if (!/dynamicauth|dynamic-labs|Failed to fetch/i.test(error.message)) fatal.push(error.message);
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    const errorText = request.failure()?.errorText || "failed";
    if (!/rpc-bradbury\.genlayer\.com/.test(url) && !(errorText === "net::ERR_ABORTED" && url.includes("?_rsc="))) failedLocal.push(`${url} ${errorText}`);
  });
  for (const width of widths) {
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    for (const route of routes) {
      fatal.length = 0;
      failedLocal.length = 0;
      const response = await goto(page, `${base}${route}`);
      assert.ok([200, 304].includes(response?.status()), `${route} status`);
      const result = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        wide: [...document.querySelectorAll("body *")].map((element) => { const box = element.getBoundingClientRect(); const style = getComputedStyle(element); const parent = element.parentElement?.getBoundingClientRect(); return { tag: element.tagName, className: element.className, left: box.left, right: box.right, width: box.width, minWidth: style.minWidth, cssWidth: style.width, parentWidth: parent?.width, viewport: window.innerWidth, text: element.textContent?.trim().slice(0, 50) }; }).filter((item) => item.right > document.documentElement.clientWidth + 1).slice(0, 8),
      }));
      assert.ok(result.scrollWidth <= result.clientWidth + 1, `${route} horizontal overflow at ${width}: ${JSON.stringify(result.wide)}`);
      assert.deepEqual(fatal, [], `${route} fatal page errors`);
      assert.deepEqual(failedLocal, [], `${route} failed local assets`);
    }
  }
  await goto(page, `${base}/`);
  const links = await page.$$eval("a", (items) => items.map((item) => item.getAttribute("href")).filter(Boolean));
  assert.ok(links.includes("/decisions"), "Decisions navigation link");
  assert.ok(links.includes("/certificates"), "Certificates navigation link");
  assert.ok(links.some((href) => href.includes("explorer-bradbury.genlayer.com/address/")), "contract explorer link");
  assert.ok(links.some((href) => href.includes("explorer-bradbury.genlayer.com/tx/")), "transaction explorer link");
  console.log(`frontend browser smoke: PASS (${routes.length} routes x ${widths.length} widths)`);
} finally {
  await browser.close();
}
