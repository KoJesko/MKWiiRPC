// Linux counterpart of readGame.ps1: reads WiiCompiled's (Retro Rewind) race state and
// reports one sample every 0.5 s. Same addresses, same fields.
//
// Read-only and no root needed. WiiCompiled keeps guest RAM in a memfd
// ("wiicompiled-guest-ram") and maps it at a fixed base. /proc/<pid>/maps says where each
// piece of guest memory sits in that memfd, and /proc/<pid>/fd/N opens the memfd itself.
// Both only need the same user, so this works with Yama's default ptrace_scope=1, which
// blocks /proc/<pid>/mem and process_vm_readv for processes you didn't start.
import fs from "fs";

const BASE = 0x100000000000;            // kFixedFlatGuestBase (x86_64) in WiiCompiled's guest_abi/flat_memory.h
const MEMFD_NAME = "/memfd:wiicompiled-guest-ram";
const PROCESS_NAME = "RetroRewind";

const MEM1 = 0x80000000, MEM1_SIZE = 0x1800000;
const RACE_CONFIG = 0x809BD728, RACE_INFO = 0x809BD730, KART_MANAGER = 0x809C18F8;   // PAL (RMCP) singletons
const CUSTOM_CC_OFFSET = 0x3DC0;        // Retro Rewind's Custom cc value, relative to the cups pointer
const valid = (p) => p >= 0x80000000 && p < 0x98000000;

// Match on the executable path in argv[0]: WiiCompiled renames its main thread to "Main thread",
// so /proc/<pid>/comm never says RetroRewind.
function findGamePid() {
  for (const entry of fs.readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const argv0 = fs.readFileSync(`/proc/${entry}/cmdline`, "utf8").split("\0")[0];
      if (argv0.split("/").pop() === PROCESS_NAME) return Number(entry);
    } catch (_) { /* process exited while we looked */ }
  }
  return 0;
}

class GuestMemory {
  constructor(pid) {
    this.pid = pid;
    this.fds = new Map();               // memfd inode -> our read-only fd
    this.load();
  }

  load() {
    this.regions = [];
    for (const line of fs.readFileSync(`/proc/${this.pid}/maps`, "utf8").split("\n")) {
      // start-end perms offset dev inode pathname
      const m = line.match(/^([0-9a-f]+)-([0-9a-f]+) \S+ ([0-9a-f]+) \S+ (\d+)\s+(.*)$/);
      if (!m || !m[5].startsWith(MEMFD_NAME)) continue;
      const start = parseInt(m[1], 16);
      // only the guest views at the fixed base; the host alias elsewhere maps the same pages
      if (start < BASE || start >= BASE + 0x100000000) continue;
      this.regions.push({ start, end: parseInt(m[2], 16), offset: parseInt(m[3], 16), inode: Number(m[4]) });
    }
    for (const n of fs.readdirSync(`/proc/${this.pid}/fd`)) {
      const link = `/proc/${this.pid}/fd/${n}`;
      try {
        if (!fs.readlinkSync(link).startsWith(MEMFD_NAME)) continue;
        const ino = fs.statSync(link).ino;
        if (!this.fds.has(ino)) this.fds.set(ino, fs.openSync(link, "r"));
      } catch (_) { /* fd closed meanwhile */ }
    }
  }

  readOnce(guest, length) {
    const buf = Buffer.alloc(length);
    let done = 0;
    while (done < length) {
      const va = BASE + guest + done;
      const r = this.regions.find((x) => va >= x.start && va < x.end);
      const fd = r && this.fds.get(r.inode);
      if (fd === undefined) return null;
      const n = Math.min(length - done, r.end - va);
      if (fs.readSync(fd, buf, done, n, r.offset + (va - r.start)) !== n) return null;
      done += n;
    }
    return buf;
  }

  read(guest, length) {
    const b = this.readOnce(guest, length);
    if (b) return b;
    this.load();                        // mappings can change while the game boots
    return this.readOnce(guest, length);
  }

  u32(g) { const b = this.read(g, 4); return b ? b.readUInt32BE(0) : 0; }
  f32(g) { const b = this.read(g, 4); return b ? b.readFloatBE(0) : 0; }

  // first 4-byte-aligned match, like GameMem.Find in readGame.ps1
  find(start, length, pattern) {
    const buf = this.read(start, length);
    if (!buf) return 0;
    for (let i = buf.indexOf(pattern); i >= 0; i = buf.indexOf(pattern, i + 1)) {
      if (i % 4 === 0) return start + i;
    }
    return 0;
  }

  close() {
    for (const fd of this.fds.values()) { try { fs.closeSync(fd); } catch (_) {} }
    this.fds.clear();
  }
}

function sample(mem, state, signature) {
  // Pulsar's CupsConfig isn't at a fixed address: find its cups table, then the pointer to that table
  if (!state.cupsConfig) {
    const cups = mem.find(MEM1, MEM1_SIZE, signature);
    if (cups) {
      const ptr = Buffer.alloc(4);
      ptr.writeUInt32BE(cups);
      state.cupsConfig = mem.find(MEM1, MEM1_SIZE, ptr);
    }
  }

  const out = { running: true, inRace: false };
  const rc = mem.u32(RACE_CONFIG), ri = mem.u32(RACE_INFO);
  if (!valid(rc) || !valid(ri)) return out;
  const settings = mem.read(rc + 0xB68, 0x2C);
  const info = mem.read(ri, 0x2C);
  const playersPtr = mem.u32(ri + 0x0C), timer = mem.u32(ri + 0x14);
  if (!settings || !info || !valid(playersPtr) || !valid(timer)) return out;
  let hud = settings[0x1C];
  if (hud > 11) hud = 0;
  const player = mem.u32(playersPtr + 4 * hud);
  const mainTimer = mem.read(timer + 8, 8);
  if (!valid(player) || !mainTimer) return out;

  out.inRace = true;
  out.engineClass = settings[7];
  out.gameMode = settings[11];
  out.mirror = Boolean(settings[0x2B] & 1);
  out.position = mem.read(player + 0x20, 1)?.[0];
  out.racers = mem.read(rc + 0x24, 1)?.[0];
  out.stage = info[0x2B];
  out.frame = info.readUInt32BE(0x20);
  out.timeMs = (mainTimer[0] * 256 + mainTimer[1]) * 60000 + mainTimer[2] * 1000 + (mainTimer[4] * 256 + mainTimer[5]);
  out.courseSlot = settings[3];
  // the race's 12 player entries, 0xF0 bytes each, end where the settings start
  const entry = rc + 0x28 + 0xF0 * hud;
  out.vehicle = mem.u32(entry + 0x08);
  out.character = mem.u32(entry + 0x0C);
  if (state.cupsConfig) {
    out.pulsarId = mem.u32(state.cupsConfig - 0x38);
    out.variant = mem.read(state.cupsConfig - 0x34, 1)?.[0];
    const cc = mem.read(state.cupsConfig + CUSTOM_CC_OFFSET, 2);
    if (cc) out.customCc = cc[0] * 256 + cc[1];
  }
  const karts = mem.u32(KART_MANAGER);
  if (valid(karts)) {
    const kart = mem.u32(mem.u32(karts + 0x20) + 4 * hud);
    const move = mem.u32(mem.u32(kart) + 0x28);
    if (valid(move)) {
      out.speed = Math.round(mem.f32(move + 0x20) * 10) / 10;
      out.hardSpeedLimit = Math.round(mem.f32(move + 0x2C) * 10) / 10;
    }
  }
  return out;
}

/**
 * startLinuxReader: polls the game and calls onSample with the same objects readGame.ps1 prints
 * @param {string} cupSignatureHex the cups table bytes from ConfigRT.pul, as hex
 * @param {(s: object) => void} onSample
 */
export function startLinuxReader(cupSignatureHex, onSample) {
  const signature = Buffer.from(cupSignatureHex, "hex");
  let mem = null;
  const state = { cupsConfig: 0 };

  const tick = () => {
    let delay = 500;
    try {
      const pid = findGamePid();
      if (!pid) {
        if (mem) { mem.close(); mem = null; state.cupsConfig = 0; }
        onSample({ running: false });
        delay = 2000;
      } else {
        if (!mem || mem.pid !== pid) {
          if (mem) mem.close();
          mem = new GuestMemory(pid);
          state.cupsConfig = 0;
        }
        onSample(sample(mem, state, signature));
      }
    } catch (e) {
      // the game closed mid-read, or its memory isn't mapped yet
      if (mem) { mem.close(); mem = null; state.cupsConfig = 0; }
      onSample({ running: false });
      delay = 2000;
    }
    setTimeout(tick, delay);
  };
  tick();
}
