// Track mapping: display name (canonical/en) -> { assetKey, i18nKey }
// e.g. { "track.luigicircuit": "Wii Luigi Circuit (Nintendo)" } (for en-uk)
export const TRACK_ENTRIES = {
  "Wii Luigi Circuit (Nintendo)":        { assetKey: "luigicircuit",       i18nKey: "track.luigicircuit" },
  "Wii Moo Moo Meadows (Nintendo)":      { assetKey: "moomoomeadows",     i18nKey: "track.moomoomeadows" },
  "Wii Mushroom Gorge (Nintendo)":       { assetKey: "mushroomgorge",     i18nKey: "track.mushroomgorge" },
  "Wii Toad's Factory (Nintendo)":       { assetKey: "toadsfactory",      i18nKey: "track.toadsfactory" },
  "Wii Mario Circuit (Nintendo)":        { assetKey: "mariocircuit",      i18nKey: "track.mariocircuit" },
  "Wii Coconut Mall (Nintendo)":         { assetKey: "coconutmall",       i18nKey: "track.coconutmall" },
  "Wii DK Summit (Nintendo)":            { assetKey: "dksummit",          i18nKey: "track.dksummit" },
  "Wii Wario’s Gold Mine (Nintendo)":    { assetKey: "wariosgoldmine",    i18nKey: "track.wariosgoldmine" },
  "Wii Daisy Circuit (Nintendo)":        { assetKey: "daisycircuit",      i18nKey: "track.daisycircuit" },
  "Wii Koopa Cape (Nintendo)":           { assetKey: "koopacape",         i18nKey: "track.koopacape" },
  "Wii Maple Treeway (Nintendo)":        { assetKey: "mapletreeway",      i18nKey: "track.mapletreeway" },
  "Wii Grumble Volcano (Nintendo)":      { assetKey: "grumblevolcano",    i18nKey: "track.grumblevolcano" },
  "Wii Dry Dry Ruins (Nintendo)":        { assetKey: "drydryruins",       i18nKey: "track.drydryruins" },
  "Wii Moonview Highway (Nintendo)":     { assetKey: "moonviewhighway",   i18nKey: "track.moonviewhighway" },
  "Wii Bowser’s Castle (Nintendo)":      { assetKey: "bowserscastle",     i18nKey: "track.bowserscastle" },
  "Wii Rainbow Road (Nintendo)":         { assetKey: "rainbowroad",       i18nKey: "track.rainbowroad" },
  "GCN Peach Beach (Nintendo)":          { assetKey: "gcnpeachbeach",     i18nKey: "track.gcnpeachbeach" },
  "DS Yoshi Falls (Nintendo)":           { assetKey: "dsyoshifalls",      i18nKey: "track.dsyoshifalls" },
  "SNES Ghost Valley 2 (Nintendo)":      { assetKey: "snesghostvalley2",  i18nKey: "track.snesghostvalley2" },
  "N64 Mario Raceway (Nintendo)":        { assetKey: "n64marioraceway",   i18nKey: "track.n64marioraceway" },
  "N64 Sherbet Land (Nintendo)":         { assetKey: "n64sherbetland",    i18nKey: "track.n64sherbetland" },
  "GBA Shy Guy Beach (Nintendo)":        { assetKey: "gbashyguybeach",    i18nKey: "track.gbashyguybeach" },
  "DS Delfino Square (Nintendo)":        { assetKey: "dsdelfinosquare",   i18nKey: "track.dsdelfinosquare" },
  "GCN Waluigi Stadium (Nintendo)":      { assetKey: "gcnwaluigistadium", i18nKey: "track.gcnwaluigistadium" },
  "DS Desert Hills (Nintendo)":          { assetKey: "dsdeserthills",     i18nKey: "track.dsdeserthills" },
  "GBA Bowser Castle 3 (Nintendo)":      { assetKey: "gbabowserscastle",  i18nKey: "track.gbabowserscastle" },
  "N64 DK Jungle Parkway (Nintendo)":    { assetKey: "n64dkjungleparkway",i18nKey: "track.n64dkjungleparkway" },
  "GCN Mario Circuit (Nintendo)":        { assetKey: "gcnmariocircuit",   i18nKey: "track.gcnmariocircuit" },
  "SNES Mario Circuit 3 (Nintendo)":     { assetKey: "snesmariocircuit3", i18nKey: "track.snesmariocircuit3" },
  "DS Peach Gardens (Nintendo)":         { assetKey: "dspeachgardens",    i18nKey: "track.dspeachgardens" },
  "GCN DK Mountain (Nintendo)":          { assetKey: "gcndkmountain",     i18nKey: "track.gcndkmountain" },
  "N64 Bowser’s Castle (Nintendo)":      { assetKey: "n64bowserscastle",  i18nKey: "track.n64bowserscastle" },
};

// Battle-only tracks (display name -> assetKey + i18nKey)
export const BATTLE_ENTRIES = {
  "Wii Block Plaza (Nintendo)":       { assetKey: "blockplaza",        i18nKey: "track.blockplaza" },
  "Wii Delfino Pier (Nintendo)":      { assetKey: "delfinopier",       i18nKey: "track.delfinopier" },
  "Wii Funky Stadium (Nintendo)":     { assetKey: "funkystadium",      i18nKey: "track.funkystadium" },
  "Wii Chain Chomp Roulette (Nintendo)": { assetKey: "chainchomproulette", i18nKey: "track.chainchomproulette" },
  "Wii Thwomp Desert (Nintendo)":     { assetKey: "thwompdesert",      i18nKey: "track.thwompdesert" },
  "SNES Battle Course 4 (Nintendo)":  { assetKey: "snesbattlecourse4", i18nKey: "track.snesbattlecourse4" },
  "GBA Battle Course 3 (Nintendo)":   { assetKey: "gbabattlecourse3",  i18nKey: "track.gbabattlecourse3" },
  "N64 Skyscraper (Nintendo)":        { assetKey: "n64skyscraper",     i18nKey: "track.n64skyscraper" },
  "GCN Cookie Land (Nintendo)":       { assetKey: "gcncookieland",     i18nKey: "track.gcncookieland" },
  "DS Twilight House (Nintendo)":     { assetKey: "dstwilighthouse",   i18nKey: "track.dstwilighthouse" },
};

// Convenience sets based on normalized names
function normalizeForKey(s) {
  if (!s) return "";
  return String(s)
    .normalize("NFKC")
    .replace(/\(.*?\)/g, "")                        // remove parenthesis blocks
    .replace(/\b(Wii|N64|GCN|DS|GBA|SNES)\b/gi, "") // optional: strip platform tokens
    .replace(/[^\w\s]/g, "")                        // remove punctuation
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const NORMALIZED_TO_ENTRY = {};
for (const [name, entry] of Object.entries(TRACK_ENTRIES)) {
  NORMALIZED_TO_ENTRY[normalizeForKey(name)] = { canonical: name, ...entry, type: "race" };
}
for (const [name, entry] of Object.entries(BATTLE_ENTRIES)) {
  NORMALIZED_TO_ENTRY[normalizeForKey(name)] = { canonical: name, ...entry, type: "battle" };
}

// exported convenience sets:
export const BATTLE_TRACKS = new Set(Object.keys(BATTLE_ENTRIES).map(n => normalizeForKey(n)));
export const ALL_TRACKS = Object.keys(NORMALIZED_TO_ENTRY).slice(); // normalized keys

/**
 * findTrackKey(rawTrackName)
 * returns { key: string|null, i18nKey: string|null, canonicalName: string|null,
 *           score: number, matchType: "exact"|"token"|"substring"|"none", normalized: string, type: "race"|"battle"|null }
 */
export function findTrackKey(rawTrackName) {
  if (!rawTrackName || typeof rawTrackName !== "string") {
    return { key: null, i18nKey: null, canonicalName: null, score: 0, matchType: "none", normalized: "" , type: null};
  }
  const normalized = normalizeForKey(rawTrackName);

  // exact normalized match
  if (normalized in NORMALIZED_TO_ENTRY) {
    const e = NORMALIZED_TO_ENTRY[normalized];
    return { key: e.assetKey, i18nKey: e.i18nKey, canonicalName: e.canonical, score: 1.0, matchType: "exact", normalized, type: e.type };
  }

  // token intersection scoring
  const tokens = normalized.split(" ").filter(Boolean);
  let best = { key: null, score: 0, name: null, entry: null };
  for (const [knownNorm, entry] of Object.entries(NORMALIZED_TO_ENTRY)) {
    const knownTokens = knownNorm.split(" ").filter(Boolean);
    const inter = tokens.filter(t => knownTokens.includes(t));
    const unionSize = new Set([...tokens, ...knownTokens]).size || 1;
    const score = inter.length / unionSize;
    if (score > best.score) best = { key: entry.assetKey, score, name: knownNorm, entry };
  }
  if (best.score >= 0.35 && best.entry) {
    return { key: best.entry.assetKey, i18nKey: best.entry.i18nKey, canonicalName: best.entry.canonical, score: best.score, matchType: "token", normalized, type: best.entry.type };
  }

  // substring heuristics
  for (const [knownNorm, entry] of Object.entries(NORMALIZED_TO_ENTRY)) {
    if (knownNorm.includes(normalized) || normalized.includes(knownNorm)) {
      return { key: entry.assetKey, i18nKey: entry.i18nKey, canonicalName: entry.canonical, score: 0.5, matchType: "substring", normalized, type: entry.type };
    }
  }

  return { key: null, i18nKey: null, canonicalName: null, score: 0, matchType: "none", normalized, type: null };
}

export function translateTrack(rawTrackName, t) {
  if (!rawTrackName) return rawTrackName;
  const found = findTrackKey(rawTrackName);
  if (found && found.i18nKey) {
    // call t(i18nKey) directly — let the caller handle errors/no-fallback policy.
    return t(found.i18nKey);
  }
  // If we didn't find a key, return the raw name — caller can decide what to do.
  return rawTrackName;
}

export function listKnownTracks() {
  const combined = { ...TRACK_ENTRIES, ...BATTLE_ENTRIES };
  return Object.entries(combined).map(([name, v]) => ({ name, assetKey: v.assetKey, i18nKey: v.i18nKey }));
}

export default {
  TRACK_ENTRIES,
  BATTLE_ENTRIES,
  BATTLE_TRACKS,
  findTrackKey,
  translateTrack,
  listKnownTracks
};
