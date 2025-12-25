import RPC from "discord-rpc";
import { load as cheerioLoad } from "cheerio";
import {
  DISCORD_CLIENT_ID,
  LARGE_IMAGE_KEY,
  SMALL_IMAGE_KEY,
  OFFLINE_SMALL_KEY,
  MAX_PLAYERS,
  SELF_PATH_SEGMENT,
  VOTING_IMAGE_BATTLE_KEY,
  VOTING_IMAGE_VERSUS_KEY
} from "./config.js";
import { safeParseInt, buildSmallText } from "./utils.js";
import { findTrackKey, BATTLE_TRACKS, translateTrack } from "./trackMap.js";
import { t } from "./i18n.js"; // <- strict loader; will throw if missing

RPC.register(DISCORD_CLIENT_ID);
export const rpcClient = new RPC.Client({ transport: "ipc" });

export async function initPresence() {
  try {
    await rpcClient.login({ clientId: DISCORD_CLIENT_ID });
    console.log("✅ Discord RPC connected");
  } catch (e) {
    console.error("⚠️ Discord RPC login failed:", e && e.message ? e.message : e);
    throw e;
  }
}

const stripDigits = s => (s ? String(s).replace(/[^\d\-]/g, "").trim() : "");
const codepoints = s => (s ? Array.from(String(s)).map(c => c.charCodeAt(0)) : []);

function fallbackPointsFromHtml(rawHtml, friendCode) {
  if (!rawHtml) return { versus: "", battle: "" };
  const $ = cheerioLoad(rawHtml);
  const pid = (SELF_PATH_SEGMENT || "").replace(/^p/, "");
  let td = pid ? $(`td[data-tooltip="pid=${pid}"]`).first() : cheerioLoad()();
  if ((!td || td.length === 0) && pid) {
    const a = $(`a[href*="/list/p${pid}"]`).first();
    if (a && a.length) td = a.closest("td");
  }
  if ((!td || td.length === 0) && friendCode) {
    const aExact = $(`a`).filter((i, el) => $(el).text().trim() === friendCode).first();
    if (aExact && aExact.length) td = aExact.closest("td");
  }
  if ((!td || td.length === 0) && friendCode) {
    const tdExact = $(`td`).filter((i, el) => $(el).text().trim() === friendCode).first();
    if (tdExact && tdExact.length) td = tdExact;
  }
  if (!td || td.length === 0) return { versus: "", battle: "" };
  const row = td.closest("tr");
  if (!row || row.length === 0) return { versus: "", battle: "" };
  const tds = row.find("td").toArray().map(el => cheerioLoad(el).text().replace(/\u00A0/g, " ").trim());
  return { versus: tds[6] || "", battle: tds[7] || "" };
}

function buildSmallLine(firstMii, extra, fc, label, value) {
  const plus = extra > 0 ? ` (+${extra})` : "";
  const fcPart = fc ? ` (${fc})` : "";
  const pointsPart = (label && value !== null && value !== undefined) ? ` • ${label}: ${value}` : "";
  const s = `${firstMii}${plus}${fcPart}${pointsPart}`;
  return s.length > 128 ? s.slice(0, 128) : s;
}

export async function updatePresence(parsed) {
  try {
    if (!parsed || !parsed.online || !parsed.self || !parsed.self.miiName) {
      rpcClient.setActivity({
        details: t("offline_details"),
        state: t("offline_state"),
        largeImageKey: LARGE_IMAGE_KEY,
        largeImageText: `${t("mario_kart_wii")}`,
        smallImageKey: OFFLINE_SMALL_KEY,
        smallImageText: t("offline_small"),
        instance: false
      });
      return;
    }

    const p = parsed;
    const s = p.self;
    let displayTrack = null;
    if (p.trackName) {
      displayTrack = translateTrack(p.trackName, t); // returns translated string (or throws)
    }
    const inRoom = Boolean((p.roomTrId && String(p.roomTrId).trim()) || (p.roomListFullUrl && String(p.roomListFullUrl).trim()));
    const partySize = Math.min(Math.max(0, Number(p.playerCount || 0)), MAX_PLAYERS);

    let versusRaw = s.versus ? String(s.versus) : "";
    let battleRaw  = s.battle  ? String(s.battle) : "";

    console.log("DEBUG raw points strings (from parsed.self):", {
      versusRaw, versusCp: codepoints(versusRaw),
      battleRaw, battleCp: codepoints(battleRaw)
    });

    if (!stripDigits(versusRaw) || !stripDigits(battleRaw)) {
      const fb = fallbackPointsFromHtml(p.rawHtml || "", s.friendCode || "");
      if (!stripDigits(versusRaw) && fb.versus) {
        console.log("DEBUG fallback (versus):", fb.versus);
        versusRaw = fb.versus;
      }
      if (!stripDigits(battleRaw) && fb.battle) {
        console.log("DEBUG fallback (battle):", fb.battle);
        battleRaw = fb.battle;
      }
    }

    const versusNum = safeParseInt(stripDigits(versusRaw));
    const battleNum  = safeParseInt(stripDigits(battleRaw));

    const explicitBattle = /bt/i.test(String(s.roomMatch || "")) || p.lobbyType === "battle";
    const explicitRace   = /vs/i.test(String(s.roomMatch || "")) || p.lobbyType === "race";
    let looksLikeBattle = false;
    if (!explicitBattle && p.trackName) {
      looksLikeBattle = BATTLE_TRACKS && BATTLE_TRACKS.has && BATTLE_TRACKS.has(p.trackName);
    }
    let isBattle = explicitBattle || (!explicitRace && looksLikeBattle);
    if (explicitRace) isBattle = false;

    const pointsLabel = isBattle ? t("br_label") : t("vr_label");
    const showPoints = inRoom;
    const pointsValue = showPoints ? (isBattle ? (Number.isFinite(battleNum) ? battleNum : 0)
                                               : (Number.isFinite(versusNum) ? versusNum : 0))
                                   : null;

    console.log("DEBUG points parsing:", {
      versusNum, battleNum, explicitBattle, explicitRace, looksLikeBattle, isBattle, showPoints, pointsValue //i am so sorry for including looksLikeBattle and isBattle it hurts me more than you think
    });

    let details;
    // Proper friend-room logic:
    // private → suspend=1 = racing/battling, suspend=0 = menu
    if (inRoom) {
      if (p.lobbyType === "private") {
        if (Number(s.suspend) === 1) {
          details = p.trackName
              ? `${isBattle ? t("battling_on_prefix") : t("racing_on_prefix")}: ${displayTrack}`
              : (isBattle ? t("battling_on_prefix") : t("racing_on_prefix"));
        } else {
          details = t("friend_room_menu");

        }
      } else {
        // worldwide / continental logic (voting exists here)
        if (Number(s.suspend) === 1) {
          details = t("voting_for_track");
        } else if (displayTrack) {
          details = `${isBattle ? t("battling_on_prefix") : t("racing_on_prefix")}: ${displayTrack}`;
        } else {
          details = isBattle ? t("battling_on_prefix") : t("racing_on_prefix");
        }
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

// 1) If we're in a friend room and NOT currently racing/battling (suspend !== 1),
//    always show the generic image (don't reuse last-track image).
if (inRoom && p.lobbyType === "private" && Number(s.suspend) !== 1) {
  largeKey = LARGE_IMAGE_KEY;

// 2) Voting images only apply for non-private rooms where suspend === 1
} else if (inRoom && p.lobbyType !== "private" && Number(s.suspend) === 1) {
  const votingIsBattle =
    /bt/i.test(String(s.roomMatch || "")) ||
    p.lobbyType === "battle" ||
    (p.trackName && BATTLE_TRACKS?.has?.(p.trackName));

  largeKey = votingIsBattle
    ? (VOTING_IMAGE_BATTLE_KEY || LARGE_IMAGE_KEY)
    : (VOTING_IMAGE_VERSUS_KEY || LARGE_IMAGE_KEY);

// 3) Otherwise, if a track name is present (e.g. while racing/battling), use the mapped key
} else if (p.trackName) {
  const tk = findTrackKey(p.trackName);
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
    else if (lt === "new") state = t("room_newin_new_room");
    else state = t("in_room_unknown");

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

    rpcClient.setActivity(presence);

    console.log("Presence updated:", {
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
