import fs from "fs";
import path from "path";
import { RETRO_REWIND_ROOT } from "./config.js";

// Pulsar track ids: 0x100 + index, Retro Tracks first, then Custom Tracks, then Battle (same numbers as rwfc.net's race.course)
const FIRST_PULSAR_ID = 0x100;
const TRACK_NAME_BMG_BASE = 0x20000;
const VARIANT_NAME_BMG_BASE = 0x420000;   // + track index * 0x10 + variant, e.g. "Wii U Tick-Tock Clock"
const CUP_TABLE_OFFSET = 0x90;     // first cup entry inside a Config*.pul

function readConfig(file) {
  return fs.readFileSync(path.join(RETRO_REWIND_ROOT, "Binaries", file));
}

// reads the track names (BMG message ids 0x20000 + index) embedded in a Config*.pul
function readTrackNames(buf) {
  const start = buf.indexOf("MESGbmg1");
  if (start < 0) return new Map();
  const sections = {};
  let pos = start + 0x20;
  for (let i = 0; i < buf.readUInt32BE(start + 12); i++) {
    sections[buf.toString("latin1", pos, pos + 4)] = pos;
    pos += buf.readUInt32BE(pos + 4);
  }
  const { INF1: inf, DAT1: dat, MID1: mid } = sections;
  const count = buf.readUInt16BE(inf + 8);
  const entrySize = buf.readUInt16BE(inf + 10);
  const names = new Map();
  for (let i = 0; i < count; i++) {
    const id = buf.readUInt32BE(mid + 16 + i * 4);
    const isTrack = id >= TRACK_NAME_BMG_BASE && id < TRACK_NAME_BMG_BASE + 0x1000;
    const isVariant = id >= VARIANT_NAME_BMG_BASE && id < VARIANT_NAME_BMG_BASE + 0x10000;
    if (!isTrack && !isVariant) continue;
    let q = dat + 8 + buf.readUInt32BE(inf + 16 + i * entrySize);
    const chars = [];
    for (;;) {
      const c = buf.readUInt16BE(q);
      if (c === 0) break;
      if (c === 0x1a) { q += buf[q + 2]; continue; }   // skip BMG escape sequences (font colors)
      chars.push(c);
      q += 2;
    }
    names.set(id, String.fromCharCode(...chars).trim());
  }
  return names;
}

// cups * 4 tracks, read from the header of a Config*.pul
function trackCount(buf) {
  return buf.readUInt16BE(0x80) * 4;
}

let tables = null;

function loadTables() {
  if (tables) return tables;
  tables = ["ConfigRT.pul", "ConfigCT.pul", "ConfigBT.pul"].map(file => {
    const buf = readConfig(file);
    return { names: readTrackNames(buf), size: trackCount(buf) };
  });
  return tables;
}

// first bytes of the Retro Tracks cup table, used to find Pulsar's CupsConfig in the game's memory
export function cupSignature() {
  return readConfig("ConfigRT.pul").subarray(CUP_TABLE_OFFSET, CUP_TABLE_OFFSET + 16).toString("hex");
}

export function pulsarTrackName(pulsarId, variant = 0) {
  if (!Number.isInteger(pulsarId) || pulsarId < FIRST_PULSAR_ID) return null;
  let index = pulsarId - FIRST_PULSAR_ID;
  for (const { names, size } of loadTables()) {
    if (index < size) {
      const variantName = variant > 0 ? names.get(VARIANT_NAME_BMG_BASE + index * 0x10 + variant) : null;
      return variantName || names.get(TRACK_NAME_BMG_BASE + index) || null;
    }
    index -= size;
  }
  return null;
}
