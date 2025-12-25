import { SELF_WATCH_URL, GLOBAL_STATS_URL, POLL_INTERVAL } from "./config.js";
import { launchBrowser, fetchPageContent } from "./puppeteerClient.js";
import {
  parseDefaultSiteHtml,
  parseGlobalStatsHtml,
  parseAltSiteHtml,
  detectSite
} from "./parsers.js";
import { initPresence, updatePresence, rpcClient } from "./presence.js";

async function main() {
  console.log("Starting Wiimmfi -> Discord RPC (modular)");

  // allow reassign when Cloudflare visible browser is used
  let { browser, page } = await (async () => {
    const b = await launchBrowser(false);
    return b;
  })();

  // initial page load & cloudflare handling
  let html = await fetchPageContent(page, SELF_WATCH_URL);
  html = html || (await page.content());

  // handle Cloudflare / challenge pages (string checks kept lightweight)
  if (
    html.includes("Verifying you are human") ||
    html.includes("cf-browser-verification") ||
    html.includes("Cloudflare") ||
    html.includes("Just a moment")
  ) {
    console.log("Cloudflare detected — opening visible browser to solve it.");
    try { await browser.close(); } catch (e) {}
    const visible = await launchBrowser(true);
    browser = visible.browser;
    page = visible.page;
    await fetchPageContent(page, SELF_WATCH_URL);
    console.log("Please complete the Cloudflare check in the visible window and press Enter.");
    // wait for user input to continue (simple)
    await new Promise((resolve) => process.stdin.once("data", resolve));
  }

  // login to Discord RPC
  await initPresence();

  let lastHash = null;

  setInterval(async () => {
    try {
      const content = await fetchPageContent(page, SELF_WATCH_URL);
      const siteHtml = content || (await page.content());

      // choose parser intelligently
      const siteType = detectSite(siteHtml);
      let parsed;
      if (siteType === "default") parsed = parseDefaultSiteHtml(siteHtml);
      else if (siteType === "global") parsed = parseGlobalStatsHtml(siteHtml);
      else parsed = parseAltSiteHtml(siteHtml);

      // If we found a room page but want better suspend (voting vs racing) info,
      // fetch the global stats page and merge suspend (if present) into parsed.self
      const inRoom = Boolean(parsed && ((parsed.roomTrId && String(parsed.roomTrId).trim() !== "") || (parsed.roomListFullUrl && String(parsed.roomListFullUrl).trim() !== "")));

      // If we're in a room, check global list to get suspend (voting) and possibly more accurate online flags
      if (inRoom) {
        try {
          const globalHtml = await fetchPageContent(page, GLOBAL_STATS_URL);
          const gp = parseGlobalStatsHtml(globalHtml);
          if (gp && gp.online && gp.self) {
            // merge suspend & minimal self info but keep parsed.playerCount / track from room page
            parsed.self = {
              ...parsed.self,
              ...gp.self,
              // ensure we keep prior fields if gp misses them
              friendCode: parsed.self.friendCode || gp.self.friendCode,
              miiNames: parsed.self.miiNames && parsed.self.miiNames.length ? parsed.self.miiNames : gp.self.miiNames,
              miiName: parsed.self.miiName || gp.self.miiName
            };
          }
        } catch (e) {
          // non-fatal: we can continue with original parsed
          console.warn("Global-check while in room failed:", e && e.message ? e.message : e);
        }
      }

      // If room page says offline (no self found), fallback to the global list to detect "online but not in a room"
      if (!parsed || !parsed.online) {
        try {
          const globalHtml = await fetchPageContent(page, GLOBAL_STATS_URL);
          const gp = parseGlobalStatsHtml(globalHtml);
          if (gp && gp.online) {
            // build a parsed object indicating the user is online but not in a room
            parsed = {
              ...parsed,
              online: true,
              self: gp.self,
              roomCode: null,
              roomListHref: null,
              roomListFullUrl: null,
              roomTrId: gp.roomTrId || null,
              trackName: null,
              playerCount: gp.playerCount || (gp.self && gp.self.miiNames ? gp.self.miiNames.length : 1),
              lobbyType: gp.lobbyType || "online",
              rawHtml: (parsed && parsed.rawHtml) || globalHtml
            };
          } else {
            parsed = parsed || { online: false };
          }
        } catch (e) {
          console.warn("Global fallback fetch failed:", e && e.message ? e.message : e);
          parsed = parsed || { online: false };
        }
      }

      // include suspend into hash so voting vs racing state triggers updates
      const hash = JSON.stringify({
        online: parsed && parsed.online,
        roomCode: parsed ? parsed.roomCode : null,
        playerCount: parsed ? parsed.playerCount : 0,
        track: parsed ? parsed.trackName : null,
        mii: parsed && parsed.self ? parsed.self.miiName : null,
        suspend: parsed && parsed.self ? parsed.self.suspend : null
      });

      if (hash !== lastHash) {
        await updatePresence(parsed);
        lastHash = hash;
      }
    } catch (err) {
      console.error("Polling error:", err && err.message ? err.message : err);
    }
  }, POLL_INTERVAL);

  // graceful shutdown ... show off -.-
  process.on("SIGINT", async () => {
    console.log("Shutting down...");
    try { await rpcClient.destroy(); } catch (_) {}
    try { await browser.close(); } catch (_) {}
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal error (main):", err && err.message ? err.message : err);
  process.exit(1);
});
