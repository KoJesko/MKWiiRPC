import RPC from "discord-rpc";
import {
  DISCORD_CLIENT_ID,
  LARGE_IMAGE_KEY,
  SMALL_IMAGE_KEY,
  OFFLINE_SMALL_KEY,
  MAX_PLAYERS,
  VOTING_IMAGE_BATTLE_KEY,
  VOTING_IMAGE_VERSUS_KEY,
  DEBUG_MODE
} from "./config.js";
import { safeParseInt, buildSmallText } from "./utils.js";
import { findTrackKey, BATTLE_TRACKS, translateTrack } from "./trackMap.js";
import { t } from "./i18n.js"; // <- strict loader; will throw if missing
import { localGameStatus } from "./localGame.js";

RPC.register(DISCORD_CLIENT_ID);
// null while Discord isn't connected
export let rpcClient = null;

// a client can't retry after a failed login (it caches the rejected connect), so every attempt gets a new one
export async function initPresence() {
  const client = new RPC.Client({ transport: "ipc" });
  client.on("error", (e) => console.warn("Discord RPC error:", e && e.message ? e.message : e));
  await client.login({ clientId: DISCORD_CLIENT_ID });
  client.once("disconnected", () => {
    if (rpcClient === client) rpcClient = null;
    console.log("Discord closed — waiting for it to come back");
  });
  rpcClient = client;
  console.log("✅ Discord RPC connected");
}

const DebugMode = Boolean(DEBUG_MODE);

// log debug lines only when DebugMode is on
function dbg(...args) {
  if (DebugMode) console.log(...args);
}
function dbgDebug(...args) {
  if (DebugMode) console.debug(...args);
}

// presence summary logger: full details when debug ON, short timestamp when debug OFF
function presenceLogSummary(detailsObj) {
  if (DebugMode) {
    console.log("Presence updated:", detailsObj);
    return;
  }
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  console.log(`(${hh}:${mm}) Presence updated!`);
}

const stripDigits = s => (s ? String(s).replace(/[^\d\-]/g, "").trim() : "");
const codepoints = s => (s ? Array.from(String(s)).map(c => c.charCodeAt(0)) : []);

function ordinal(n) {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] || "th"}`;
}

function formatTime(ms) {
  const min = Math.floor(ms / 60000);
  const sec = String(Math.floor(ms / 1000) % 60).padStart(2, "0");
  return `${min}:${sec}.${String(ms % 1000).padStart(3, "0")}`;
}

const MODE_KEYS = ["mode_gp", "mode_vs", "mode_tt", "mode_battle", "mode_mission", "mode_ghost"];

/**
 * updateLocalPresence: singleplayer status from the running game
 * local = localGameStatus() from localGame.js
 */
export async function updateLocalPresence(local) {
  if (!rpcClient) return;
  try {
    const presence = {
      largeImageKey: LARGE_IMAGE_KEY,
      largeImageText: t("mario_kart_wii"),
      instance: false
    };

    if (!local.inRace) {
      presence.details = t("online_not_in_room");
    } else {
      const track = local.trackName ? translateTrack(local.trackName, t) : null;
      const prefix = local.gameMode === 3 ? t("battling_on_prefix") : t("racing_on_prefix");
      presence.details = (track ? `${prefix}: ${track}` : prefix).slice(0, 128);

      const trackEntry = local.baseTrackName ? findTrackKey(local.baseTrackName) : null;
      if (trackEntry?.key) presence.largeImageKey = trackEntry.key;

      const mode = MODE_KEYS[local.gameMode] ? t(MODE_KEYS[local.gameMode]) : null;
      const engine = local.engine ? `${local.engine}${local.mirror ? ` ${t("mirror_label")}` : ""}` : null;
      const position = local.racers > 1 && local.position > 0 ? `${ordinal(local.position)}/${local.racers}` : null;
      let status = null;
      if (local.finished) status = `${t("local_finished")} ${formatTime(local.timeMs)}`;
      else if (local.paused) status = `${t("local_paused")} ${formatTime(local.timeMs)}`;
      const speed = !local.finished && !local.paused ? `${local.speed} km/h` : null;
      const top = local.topSpeed > 0 ? `${t("top_speed_label")} ${local.topSpeed}` : null;
      presence.state = [mode, engine, position, local.character, local.vehicle, speed, top, status].filter(Boolean).join(" • ").slice(0, 128);

      if (!local.finished && !local.paused) presence.startTimestamp = Date.now() - local.timeMs;
    }

    await rpcClient.setActivity(presence);
    presenceLogSummary({ details: presence.details, state: presence.state });
  } catch (err) {
    console.warn("Failed to update presence:", err && err.message ? err.message : err);
  }
}

function buildSmallLine(firstMii, extra, fc, label, value) {
  const plus = extra > 0 ? ` (+${extra})` : "";
  const fcPart = fc ? ` (${fc})` : "";
  const pointsPart = (label && value !== null && value !== undefined) ? ` • ${label}: ${value}` : "";
  const s = `${firstMii}${plus}${fcPart}${pointsPart}`;
  return s.length > 128 ? s.slice(0, 128) : s;
}

export async function updatePresence(parsed) {
  if (!rpcClient) return;
  try {
    // not in a Retro WFC room → show nothing on the profile
    if (!parsed || !parsed.online || !parsed.self || !parsed.self.miiName) {
      await rpcClient.clearActivity();
      return;
    }

    const p = parsed;
    const s = p.self;
    let displayTrack = null;
    let trackEntry = null; 
    if (p.trackName) {
      displayTrack = translateTrack(p.trackName, t); // returns translated string (or throws)
      trackEntry = findTrackKey(p.trackName);
      // rwfc.net only reports the main track name, the running game knows the variant
      const liveTrack = p.racing ? localGameStatus()?.trackName : null;
      if (liveTrack) displayTrack = translateTrack(liveTrack, t);
    }
    const inRoom = Boolean((p.roomTrId && String(p.roomTrId).trim()) || (p.roomListFullUrl && String(p.roomListFullUrl).trim()));
    const partySize = Math.min(Math.max(0, Number(p.playerCount || 0)), MAX_PLAYERS);

    const versusRaw = s.versus ? String(s.versus) : "";
    const battleRaw  = s.battle  ? String(s.battle) : "";

    dbg("DEBUG raw points strings (from parsed.self):", {
      versusRaw, versusCp: codepoints(versusRaw),
      battleRaw, battleCp: codepoints(battleRaw)
    });

    const versusNum = safeParseInt(stripDigits(versusRaw));
    const battleNum  = safeParseInt(stripDigits(battleRaw));

    const roomMatchLower = String(s.roomMatch || "").toLowerCase();
    const explicitBattle = roomMatchLower.includes("bt") || String(p.lobbyType || "").toLowerCase() === "battle";
    const explicitRace   = roomMatchLower.includes("vs") || String(p.lobbyType || "").toLowerCase() === "race";

    const looksLikeBattle = !!(trackEntry && trackEntry.type === "battle");

    let isBattle = false;
    if (explicitRace) isBattle = false;
    else if (explicitBattle) isBattle = true;
    else isBattle = looksLikeBattle;

    const pointsLabel = isBattle ? t("br_label") : t("vr_label");
    const showPoints = inRoom;
    const pointsValue = showPoints ? (isBattle ? (Number.isFinite(battleNum) ? battleNum : 0)
                                               : (Number.isFinite(versusNum) ? versusNum : 0))
                                   : null;

    dbg("DEBUG points parsing:", {
      versusNum, battleNum, explicitBattle, explicitRace, looksLikeBattle, isBattle, showPoints, pointsValue
    });

    let details;
    // Retro WFC: racing = a race/battle is running in our room
    // not racing → friend room menu (private) or voting / between races (public)
    if (inRoom) {
      if (p.racing) {
        details = displayTrack
          ? `${isBattle ? t("battling_on_prefix") : t("racing_on_prefix")}: ${displayTrack}`
          : (isBattle ? t("battling_on_prefix") : t("racing_on_prefix"));
      } else if (p.lobbyType === "private") {
        details = t("friend_room_menu");
      } else {
        details = t("voting_for_track");
      }
    } else {
      details = (p.lobbyType === "online")
        ? t("online_not_in_room")
        : t("in_room_generic");
    }

    const firstMii = (s.miiNames && s.miiNames.length) ? s.miiNames[0] : (s.miiName || "noname");
    const extra = (s.miiNames && s.miiNames.length > 1) ? s.miiNames.length - 1 : 0;
    const fc = s.friendCode || "";

    const smallText = showPoints ? buildSmallLine(firstMii, extra, fc, pointsLabel, pointsValue)
                                 : (fc ? `${firstMii} (${fc})` : firstMii);

    let largeKey = LARGE_IMAGE_KEY;

// 1) If we're in a friend room and NOT currently racing/battling,
//    always show the generic image (don't reuse last-track image).
if (inRoom && p.lobbyType === "private" && !p.racing) {
  largeKey = LARGE_IMAGE_KEY;

// 2) Voting images only apply for non-private rooms between races
} else if (inRoom && p.lobbyType !== "private" && !p.racing) {
  const votingIsBattle = (String(s.roomMatch || "").toLowerCase().includes("bt"))
                        || String(p.lobbyType || "").toLowerCase() === "battle"
                        || (!!trackEntry && trackEntry.type === "battle");

  largeKey = votingIsBattle
    ? (VOTING_IMAGE_BATTLE_KEY || LARGE_IMAGE_KEY)
    : (VOTING_IMAGE_VERSUS_KEY || LARGE_IMAGE_KEY);

// 3) Otherwise, if a track name is present (e.g. while racing/battling), use the mapped key
} else if (p.trackName) {
  const tk = trackEntry || findTrackKey(p.trackName);
  if (tk?.key) largeKey = tk.key;
} else {
  // 4) fallback generic
  largeKey = LARGE_IMAGE_KEY;
}

    const lt = (p.lobbyType || "").toString().toLowerCase();
    let state;
    if (lt === "private") state = t("in_friend_room");
    else if (lt === "continental") state = t("in_continental_room");
    else if (["worldwide", "race", "battle"].includes(lt)) state = t("in_worldwide_room");
    else if (lt === "online") state = t("online_state");
    else if (lt === "new") state = t("in_new_room");
    else state = t("in_room_unknown");
    // Retro WFC room types, e.g. "In a Worldwide Room • Retro Tracks"
    if (p.roomType && lt !== "private") state = `${state} • ${p.roomType}`.slice(0, 128);
    const local = p.racing ? localGameStatus() : null;
    if (local?.inRace) state = [state, local.character, local.vehicle].filter(Boolean).join(" • ").slice(0, 128);

    const presence = {
      details,
      state,
      largeImageKey: largeKey,
      largeImageText: `${t("mario_kart_wii")}${p.roomCode ? ` ${p.roomCode}` : ""}`.slice(0, 128),
      smallImageKey: SMALL_IMAGE_KEY,
      smallImageText: (smallText || "no name").slice(0, 128),
      instance: Boolean(inRoom)
    };

    if (p.roomListFullUrl && /^https?:\/\//i.test(p.roomListFullUrl)) {
      presence.buttons = [{ label: t("show_room_button").slice(0, 32), url: p.roomListFullUrl }];
    }

    if (inRoom) {
      presence.partyId = String(p.roomTrId || (p.roomListHref ? p.roomListHref.split("/").pop() : `room-${Date.now()}`));
      presence.partySize = Number(partySize || 0);
      presence.partyMax = Number(MAX_PLAYERS);
    }

    await rpcClient.setActivity(presence);

    presenceLogSummary({
      details: presence.details,
      state: presence.state,
      partyId: presence.partyId,
      partySize: presence.partySize,
      smallText: presence.smallImageText
    });
  } catch (err) {
    console.warn("Failed to update presence:", err && err.message ? err.message : err);
  }
}
