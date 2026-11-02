import { ROOM_STATUS_URL, POLL_INTERVAL } from "./config.js";
import { parseRoomStatus } from "./parsers.js";
import { initPresence, updatePresence, updateLocalPresence, rpcClient } from "./presence.js";
import { startLocalGame, localGameStatus } from "./localGame.js";

async function fetchRoomStatus() {
  const res = await fetch(ROOM_STATUS_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) throw new Error(`Room status returned HTTP ${res.status}`);
  return res.json();
}

async function main() {
  console.log("Starting Retro WFC (Retro Rewind) -> Discord RPC");

  startLocalGame();

  let lastHash = null;
  let waitingForDiscord = false;

  const poll = async () => {
    // login to Discord RPC, Discord might not be open yet (e.g. right after logging in to Windows) or was closed
    if (!rpcClient) {
      try {
        await initPresence();
        waitingForDiscord = false;
        lastHash = null;    // a new connection starts with an empty presence
      } catch (e) {
        if (!waitingForDiscord) console.log("Waiting for Discord to open...");
        waitingForDiscord = true;
        return;
      }
    }

    try {
      const parsed = parseRoomStatus(await fetchRoomStatus());

      // online rooms come first, otherwise fall back to what the game itself reports (singleplayer)
      const local = parsed.online ? null : localGameStatus();
      if (local) {
        const localHash = JSON.stringify({ ...local, timeMs: local.paused || local.finished ? local.timeMs : null });
        if (localHash !== lastHash) {
          await updateLocalPresence(local);
          lastHash = localHash;
        }
        return;
      }

      // include racing into hash so voting vs racing state triggers updates
      const hash = JSON.stringify({
        online: parsed.online,
        roomCode: parsed.roomCode || null,
        playerCount: parsed.playerCount || 0,
        track: parsed.trackName || null,
        mii: parsed.self ? parsed.self.miiName : null,
        racing: parsed.racing || false,
        points: parsed.self ? [parsed.self.versus, parsed.self.battle] : null
      });

      if (hash !== lastHash) {
        await updatePresence(parsed);
        lastHash = hash;
      }
    } catch (err) {
      // keep the last presence on network errors instead of flipping to offline
      console.error("Polling error:", err && err.message ? err.message : err);
    }
  };

  const loop = async () => {
    await poll();
    setTimeout(loop, POLL_INTERVAL);
  };
  loop();

  // graceful shutdown ... show off -.-
  process.on("SIGINT", async () => {
    console.log("Shutting down...");
    try { if (rpcClient) await rpcClient.destroy(); } catch (_) {}
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal error (main):", err && err.message ? err.message : err);
  process.exit(1);
});
