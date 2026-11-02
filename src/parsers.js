import { FRIEND_CODE, DEBUG_MODE } from "./config.js";

const DebugMode = Boolean(DEBUG_MODE);

// log debug lines only when DebugMode is on
function dbg(...args) {
  if (DebugMode) console.log(...args);
}

const digitsOnly = s => String(s || "").replace(/\D/g, "");

/**
 * parseRoomStatus: find our friend code in Retro WFC's /api/roomstatus JSON.
 * The API only lists players that are inside a room, so "not found" means offline or in the menus.
 *
 * Room/player isSuspended = a race is running (room closed to joining).
 * Not suspended = friend room menu (private) or voting / between races (public).
 */
export function parseRoomStatus(data) {
  const fc = digitsOnly(FRIEND_CODE);
  const rooms = data && Array.isArray(data.rooms) ? data.rooms : [];

  for (const room of rooms) {
    const players = Array.isArray(room.players) ? room.players : [];
    // a console with a guest player shows up as more than one entry with the same friend code
    const mine = players.filter(pl => digitsOnly(pl.friendCode) === fc);
    if (!mine.length) continue;

    const me = mine[0];
    const names = mine.map(pl => pl.name || (pl.mii && pl.mii.name)).filter(Boolean);
    const racing = Boolean(me.isSuspended);
    const lobbyType = room.type === "private" ? "private" : "worldwide";
    const trackName = racing && room.race && room.race.trackName ? room.race.trackName : null;

    const parsed = {
      online: true,
      self: {
        friendCode: me.friendCode || FRIEND_CODE,
        miiName: names.join(", "),
        miiNames: names,
        role: null,
        region: null,
        roomMatch: String(room.rk || ""),   // e.g. "vs_10" / "bt_..." — used for VR vs BR
        versus: me.vr != null ? String(me.vr) : "",
        battle: me.br != null ? String(me.br) : "",
        suspend: racing ? 1 : 0
      },
      racing,
      roomCode: room.id || null,
      roomListHref: null,
      roomListFullUrl: null,
      roomTrId: room.id || null,
      roomType: room.roomType || null,      // e.g. "Retro Tracks", "CTGP-C", "Item Rain"
      headerText: "",
      trackName,
      playerCount: players.length,
      lobbyType,
      rawHtml: ""
    };

    dbg("PARSER[rwfc] self parsed:", {
      room: parsed.roomCode,
      roomType: parsed.roomType,
      lobbyType,
      racing,
      trackName,
      playerCount: parsed.playerCount,
      self: parsed.self
    });

    return parsed;
  }

  return { online: false };
}
