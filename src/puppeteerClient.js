import puppeteer from "puppeteer";
import fs from "fs";
import { PUPPETEER_PROFILE_DIR } from "./config.js";

export async function launchBrowser(visible = false) {
  if (!fs.existsSync(PUPPETEER_PROFILE_DIR)) fs.mkdirSync(PUPPETEER_PROFILE_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: visible ? false : "new",
    userDataDir: PUPPETEER_PROFILE_DIR,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"]
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );
  return { browser, page };
}

export async function fetchPageContent(page, url, timeoutMs = 60000) {
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: timeoutMs });
  } catch (e) {
    // swallow navigation errors, caller will handle
    console.warn("goto() warning:", e && e.message ? e.message : e);
  }
  // short delay to let JS-rendered parts settle
  await new Promise((r) => setTimeout(r, 800));
  return await page.content();
}
