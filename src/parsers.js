import { load } from "cheerio";
import { normalizeText, splitNamesFromCell } from "./utils.js";
import { SELF_PATH_SEGMENT, BASE_URL } from "./config.js";

/**
 * Normalize cell text but treat dash placeholders as empty.
 */
function normCleanText($cell) {
  if (!$cell || !$cell.length) return "";
  const t = normalizeText($cell.text());
  if (!t) return "";
  if (/^[\u2014\u2013\-—\s]+$/.test(t)) return "";
  return t;
}

/**
 * Detect column indices from the table header row.
 * Returns an object with indices for friend, role, region, roommatch, world, connfail, versus, battle, mii.
 * Falls back to sensible defaults when header detection fails.
 */
function detectColumnIndices($table) {
  const defaults = {
    friend: 0,
    role: 1,
    region: 2,
    roommatch: 3,
    world: 4,
    connfail: 5,
    versus: 6,
    battle: 7,
    mii: 8
  };

  try {
    // find the first TR containing THs (header row)
    const $headerRow = $table.find("tr").filter((i, el) => {
      return $table && $table.length && (!!(el && el.children && el.children.some && el.children.some(c => c && c.type === "tag" && c.name === "th")) || $(el).find("th").length > 0);
    }).first();

    if (!$headerRow || $headerRow.length === 0) {
      // fallback to first tr's th/td
      const $first = $table.find("tr").first();
      if (!$first || $first.length === 0) return defaults;
    }

    // collect header texts
    const headerCells = ($headerRow && $headerRow.length) ? $headerRow.find("th,td").toArray() : $table.find("tr").first().find("th,td").toArray();
    const map = {};

    headerCells.forEach((cell, i) => {
      const txt = normalizeText(load(cell).text()).toLowerCase();
      if (!txt) return;
      if (/versus/.test(txt) || /versus points/.test(txt) || /\bvr\b/.test(txt)) map.versus = i;
      else if (/battle/.test(txt) || /battle points/.test(txt) || /\bbr\b/.test(txt)) map.battle = i;
      else if (/mii/.test(txt) || /mii name/.test(txt) || /name/.test(txt)) map.mii = i;
      else if (/friend/.test(txt) || /friend code/.test(txt) || /fc/.test(txt)) map.friend = i;
      else if (/role/.test(txt) || /console index/.test(txt)) map.role = i;
      else if (/region|login/.test(txt)) map.region = i;
      else if (/room|match/.test(txt)) map.roommatch = i;
      else if (/world/.test(txt)) map.world = i;
      else if (/conn|fail/.test(txt)) map.connfail = i;
    });

    return {
      friend: map.friend ?? defaults.friend,
      role: map.role ?? defaults.role,
      region: map.region ?? defaults.region,
      roommatch: map.roommatch ?? defaults.roommatch,
      world: map.world ?? defaults.world,
      connfail: map.connfail ?? defaults.connfail,
      versus: map.versus ?? defaults.versus,
      battle: map.battle ?? defaults.battle,
      mii: map.mii ?? defaults.mii
    };
  } catch (e) {
    return defaults;
  }
}

/**
 * parseDefaultSiteHtml: room watch page (/stats/mkw/room/...)
 */
export function parseDefaultSiteHtml(html) {
  const $ = load(html);
  const $roomTable = $("table.table11").first();
  if (!$roomTable || $roomTable.length === 0) {
    return { online: false, rawHtml: html };
  }

  const th = $roomTable.find("th.tc").first();
  const headerText = normalizeText(th.text());
  const roomCode = th.find("a").first().text().trim() || null;
  const roomListHref = th.find("a").first().attr("href") || null;
  const roomTr = $roomTable.find("tbody > tr").first();
  const roomTrId = roomTr && roomTr.attr("id") ? roomTr.attr("id") : null;

  // track name if available
  let trackName = null;
  const trackAnchor = th.find("p a").first();
  if (trackAnchor && trackAnchor.length) trackName = trackAnchor.text().trim();

  // detect column indices
  const cols = detectColumnIndices($roomTable);

  // count players using mii column (handles <br> names)
  const playerRows = $roomTable.find("tbody > tr").filter((i, el) => $(el).find("td").length > 0);
  let playerCount = 0;
  playerRows.each((i, el) => {
    const $el = $(el);
    const names = splitNamesFromCell($el.find("td").eq(cols.mii));
    playerCount += names.length || 1;
  });

  // find our PID cell
  const pidAttr = `pid=${SELF_PATH_SEGMENT.replace(/^p/, "")}`;
  const selfCell = $roomTable.find(`td[data-tooltip="${pidAttr}"]`).first();

  let online = false;
  const self = {
    friendCode: null,
    miiName: null,
    miiNames: [],
    role: null,
    region: null,
    roomMatch: null,
    versus: "",
    battle: "",
    suspend: 0
  };

  if (selfCell && selfCell.length) {
    online = true;
    const row = selfCell.closest("tr");
    const tds = row.find("td");

    self.friendCode = normCleanText(tds.eq(cols.friend));
    self.role = normCleanText(tds.eq(cols.role));
    self.region = normCleanText(tds.eq(cols.region));
    self.roomMatch = normCleanText(tds.eq(cols.roommatch));
    self.versus = normCleanText(tds.eq(cols.versus));
    self.battle = normCleanText(tds.eq(cols.battle));

    // suspend detection: presence of .suspend or span.suspend indicates suspended voting state
    self.suspend = row.find(".suspend").length ? 1 : 0;

    // Mii names
    const names = splitNamesFromCell(tds.eq(cols.mii));
    self.miiNames = names;
    self.miiName = names.join(", ");
  }

 let lobbyType = "private";
  const headerLower = headerText.toLowerCase();
  const tableText = $roomTable.text();

  // If the header explicitly says "<TYPE> room" prefer that as authoritative
  const headerRoomMatch = headerLower.match(/\b([a-z\u00a0-]+?)\s+room\b/); // captures the word before "room"
  if (headerRoomMatch && headerRoomMatch[1]) {
    const prefix = headerRoomMatch[1].trim();
    if (/continental/i.test(prefix)) {
      lobbyType = "continental";
    } else if (/worldwide/i.test(prefix)) {
      lobbyType = "worldwide";
    } else if (/private|friend/i.test(prefix)) {
      lobbyType = "private";
    } else if (/battle|bt/i.test(prefix)) {
      lobbyType = "battle";
    } else if (/race/i.test(prefix)) {
      lobbyType = "race"; 
    } else if (/global/i.test(prefix)) {
      lobbyType = "new";
    } else {
      // unknown prefix — fall back to heuristics below
    }
  }

  // If header didn't decide or had unknown prefix, fall back to heuristics
  if (!headerRoomMatch || !headerRoomMatch[1]) {
    if (/bt\d?/i.test(tableText) || (self.roomMatch && /bt/i.test(self.roomMatch))) {
      lobbyType = "battle";
    } else if (/continental/i.test(headerLower) || /continental/i.test(tableText)) {
      lobbyType = "continental";
    } else if (/worldwide|global/i.test(headerLower) || /worldwide/i.test(tableText)) {
      lobbyType = "worldwide";
    } else if (headerLower.includes("race") || (self.roomMatch && /vs/i.test(self.roomMatch))) {
      lobbyType = "race";
    }
  }

  // debug 
  console.log("DEBUG lobby detection (default):", { headerText, headerRoomMatch: headerRoomMatch && headerRoomMatch[1], lobbyType });
  let roomListFullUrl = null;
  if (roomListHref) roomListFullUrl = roomListHref.startsWith("http") ? roomListHref : BASE_URL + roomListHref;
  else if (roomTrId) roomListFullUrl = `${BASE_URL}/stats/mkw/list/${roomTrId}`;

  if (online) {
    console.log("PARSER[default] self row parsed:", {
      friendCode: self.friendCode,
      versus: self.versus,
      battle: self.battle,
      suspend: self.suspend,
      miiNames: self.miiNames,
      playerCount,
      lobbyType
    });
  }

  return {
    online,
    self,
    roomCode,
    roomListHref,
    roomListFullUrl,
    roomTrId,
    headerText,
    trackName,
    playerCount,
    lobbyType,
    rawHtml: html
  };
}

/**
 * parseAltSiteHtml: tolerant fallback for other layouts
 */
export function parseAltSiteHtml(html) {
  const $ = load(html);

  // if page actually contains a room table, reuse default parser
  const $roomTable = $("table.table11").first();
  if ($roomTable && $roomTable.length) return parseDefaultSiteHtml(html);

  let headerText = normalizeText($("h1").first().text()) || normalizeText($("title").first().text()) || "";
  let trackName = null;
  const trackAnchor = $("a[href*='/i/']").first();
  if (trackAnchor && trackAnchor.length) trackName = trackAnchor.text().trim();

  const allText = $("body").text() || "";

  const pid = SELF_PATH_SEGMENT.replace(/^p/, "");
  let selfAnchor = $(`a[href*="/list/p${pid}"]`).first();
  if (!selfAnchor || !selfAnchor.length) {
    const possible = $(`*:contains("${pid}")`).filter((i, el) => $(el).children().length === 0).first();
    if (possible && possible.length) selfAnchor = possible;
  }

  let online = false;
  const self = {
    friendCode: null,
    miiName: null,
    miiNames: [],
    role: null,
    region: null,
    roomMatch: null,
    versus: "",
    battle: "",
    suspend: 0
  };

  let playerCount = 0;

  if (selfAnchor && selfAnchor.length) {
    online = true;
    const row = selfAnchor.closest("tr").length ? selfAnchor.closest("tr") : selfAnchor.parent();
    const tds = row.find("td");

    // try to detect indices from a nearest table (if any)
    const $nearestTable = row.closest("table");
    const cols = ($nearestTable && $nearestTable.length) ? detectColumnIndices($nearestTable) : detectColumnIndices($("table.table11").first() || $("<table></table>"));

    const codeAnchor = row.find("a").filter((i, el) => /[\d]{4}-[\d]{4}-[\d]{4}/.test($(el).text())).first();
    self.friendCode = codeAnchor && codeAnchor.length ? normalizeText(codeAnchor.text()) : ( (allText.match(/[\d]{4}-[\d]{4}-[\d]{4}/g) || [])[0] || null );
    self.role = normCleanText(tds.eq(cols.role));
    self.region = normCleanText(tds.eq(cols.region));
    self.roomMatch = normCleanText(tds.eq(cols.roommatch));
    self.versus = normCleanText(tds.eq(cols.versus));
    self.battle = normCleanText(tds.eq(cols.battle));
    self.suspend = row.find(".suspend").length ? 1 : (normalizeText(row.text()).toLowerCase().includes("suspend") ? 1 : 0);

    // mii names
    let miiCell = tds.eq(cols.mii);
    if (!miiCell || !miiCell.length) miiCell = row.find(".mii-font").first();
    if (!miiCell || !miiCell.length) miiCell = tds.last();
    if (miiCell && miiCell.length) {
      const names = splitNamesFromCell(miiCell);
      self.miiNames = names;
      self.miiName = names.join(", ");
    }

    // playerCount: try to count from any room table on page or fallback to friend-code matches
    const foundRoomTable = $("table.table11").first();
    if (foundRoomTable && foundRoomTable.length) {
      const rows = foundRoomTable.find("tbody > tr").filter((i, el) => $(el).find("td").length > 0);
      rows.each((i, el) => {
        const $el = $(el);
        const mCell = $el.find("td").eq(cols.mii);
        playerCount += splitNamesFromCell(mCell).length || 1;
      });
    } else {
      playerCount = Math.max(1, (allText.match(/[\d]{4}-[\d]{4}-[\d]{4}/g) || []).length);
    }
  } else {
    // not found: count friendcodes as fallback
    playerCount = Math.max(0, ($("body").text().match(/[\d]{4}-[\d]{4}-[\d]{4}/g) || []).length);
  }

  // guess lobbyType
  let lobbyType = "private";
  const headerLower = headerText.toLowerCase();
  if (/bt\d?/i.test(allText) || (self.roomMatch && /bt/i.test(self.roomMatch))) {
    lobbyType = "battle";
  } else if (headerLower.includes("race") || (self.roomMatch && /vs/i.test(self.roomMatch))) {
    lobbyType = "race";
  } else if (/continental/i.test(headerLower) || /continental/i.test(allText)) {
    lobbyType = "continental";
  } else if (/worldwide|global/i.test(headerLower) || /worldwide/i.test(allText)) {
    lobbyType = "worldwide";
  }

  // try to find room anchor
  let roomCode = null;
  let roomListHref = null;
  let roomTrId = null;
  const roomAnchor = $("a[href*='/stats/mkw/list/']").first();
  if (roomAnchor && roomAnchor.length) {
    roomListHref = roomAnchor.attr("href");
    roomCode = roomAnchor.text().trim();
    const parts = (roomListHref || "").split("/");
    roomTrId = parts.pop() || null;
  }
  const roomListFullUrl = roomListHref ? (roomListHref.startsWith("http") ? roomListHref : BASE_URL + roomListHref) : null;

  if (online) {
    console.log("PARSER[alt] self row parsed:", {
      friendCode: self.friendCode,
      versus: self.versus,
      battle: self.battle,
      suspend: self.suspend,
      miiNames: self.miiNames,
      playerCount,
      lobbyType
    });
  }

  return {
    online,
    self,
    roomCode,
    roomListHref,
    roomListFullUrl,
    roomTrId,
    headerText,
    trackName,
    playerCount,
    lobbyType,
    rawHtml: html
  };
}

/**
 * parseGlobalStatsHtml: parse /stats/game/mariokartwii to find our PID row (global list)
 */
export function parseGlobalStatsHtml(html) {
  const $ = load(html);
  const $table = $("#online");
  if (!$table || $table.length === 0) return { online: false };

  const rows = $table.find("tbody > tr").filter((i, el) => $(el).find("td").length > 0);
  if (!rows || rows.length === 0) return { online: false };

  const pidNumeric = SELF_PATH_SEGMENT.replace(/^p/, "");
  let found = null;

  rows.each((i, el) => {
    const $el = $(el);
    const pidCell = normalizeText($el.find("td").eq(1).text());
    if (pidCell === pidNumeric) {
      const friendCode = normCleanText($el.find("td").eq(2));
      const gidRaw = normalizeText($el.find("td").eq(4).text()) || "0";
      const suspendRaw = normalizeText($el.find("td").eq(8).text()) || "0";
      const name1 = normalizeText($el.find("td").eq(10).text()) || "";
      const name2 = normalizeText($el.find("td").eq(11).text()) || "";

      const gid = (gidRaw && gidRaw !== "0" && gidRaw !== "—") ? String(gidRaw) : null;
      const suspend = (() => {
        const n = parseInt(String(suspendRaw).replace(/[^\d\-]/g, ""), 10);
        return Number.isFinite(n) ? n : 0;
      })();

      const names = [];
      if (name1) names.push(name1);
      if (name2 && name2 !== "—") names.push(name2);

      const inRoom = Boolean(gid);

      found = {
        online: true,
        self: {
          friendCode,
          miiNames: names,
          miiName: names.join(", "),
          role: null,
          region: null,
          roomMatch: null,
          versus: "",
          battle: "",
          suspend
        },
        roomCode: null,
        roomListHref: null,
        roomListFullUrl: null,
        roomTrId: inRoom ? String(gid) : null,
        headerText: "Global Online List",
        trackName: null,
        playerCount: names.length || 1,
        lobbyType: inRoom ? "unknown" : (suspend === 1 ? "matchmaking" : "online"),
        rawHtml: html
      };

      return false; // break out of each
    }
  });

  return found || { online: false };
}

/**
 * detectSite: which parser to use
 */
export function detectSite(html) {
  const $ = load(html);
  if ($("table.table11").length > 0 && $("table.table11 th.tc").length > 0) return "default";
  if ($("#online").length > 0) return "global";
  return "alt";
}
