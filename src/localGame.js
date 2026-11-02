import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";
import { RETRO_REWIND_ROOT } from "./config.js";
import { cupSignature, pulsarTrackName } from "./pulsarTracks.js";

const SCRIPT = fileURLToPath(new URL("./readGame.ps1", import.meta.url));
// Retro Rewind reuses the game's 50cc and 100cc slots for 500cc and 200cc
const ENGINE_CLASSES = ["500cc", "200cc", "150cc"];
const STAGE_FINISHED = 3;
// Custom cc shares the 150cc slot and has no flag, but it moves the kart's hard speed cap,
// which is 120 on plain 150cc for every vehicle (108 at 100cc, 255 at 1506cc)
const PLAIN_HARD_SPEED_LIMIT = 120;
const CHARACTERS = [
  "Mario", "Baby Peach", "Waluigi", "Bowser", "Baby Daisy", "Dry Bones", "Baby Mario", "Luigi",
  "Toad", "Donkey Kong", "Yoshi", "Wario", "Baby Luigi", "Toadette", "Koopa Troopa", "Daisy",
  "Peach", "Birdo", "Diddy Kong", "King Boo", "Bowser Jr.", "Dry Bowser", "Funky Kong", "Rosalina",
  "Small Mii A (M)", "Small Mii A (F)", "Small Mii B (M)", "Small Mii B (F)", "Small Mii C (M)", "Small Mii C (F)",
  "Medium Mii A (M)", "Medium Mii A (F)", "Medium Mii B (M)", "Medium Mii B (F)", "Medium Mii C (M)", "Medium Mii C (F)",
  "Large Mii A (M)", "Large Mii A (F)", "Large Mii B (M)", "Large Mii B (F)", "Large Mii C (M)", "Large Mii C (F)",
  "Medium Mii", "Small Mii", "Large Mii", "Biker Peach", "Biker Daisy", "Biker Rosalina"
];
// file prefix of each base character in Character/Driver, same order as CHARACTERS
const CHARACTER_CODES = [
  "mr", "bpc", "wl", "kp", "bds", "ka", "bmr", "lg", "ko", "dk", "ys", "wr",
  "blg", "kk", "nk", "ds", "pc", "ca", "dd", "kt", "jr", "bk", "fk", "rs"
];
// the mod has no costume names: copied from its included character list, in the same order as the xx-N files
// kept by hand, so this can go stale if Retro Rewind reorders costumes
const VARIANT_NAMES = {
  bmr: ["Baby Wario", "Baby Mario (Koala)", "Coin Coffer", "Shy Guy", "Paper Mario", "Cheep Cheep"],
  blg: ["Baby Waluigi", "E. Gadd", "Spike", "Fuzzy", "Virus Trio"],
  bpc: ["Baby Peach (Cherub)", "Pikachu", "Lemmy", "Kirby"],
  bds: ["Baby Daisy (Touring)", "Rocky Wrench", "Connie", "Talking Flower", "Baby Daisy (Raincoat)"],
  ko: ["Toad (Captain)", "Toad (Builder)", "Swoop", "Toadsworth", "Tuxie", "Toad (Pit Crew)"],
  kk: ["Toadette (Summer)", "Toadette (Soft Server)", "Blooper", "Para-Biddybud"],
  nk: ["Koopa Paratroopa", "Lakitu", "Koopa Troopa (Freerunning)", "Koopa Troopa (Sailor)", "Sidestepper"],
  ka: ["Dry Bones (Dark)", "Dry Bones (Gold)", "Goomba", "Peepa"],
  mr: ["Mario (Fire)", "Mario (Builder)", "Snowman", "Mario (SM64)", "Mario (SNES)", "Mario (Happi)"],
  lg: ["Ice Luigi", "Luigi (Vacation)", "Monty Mole", "Sonic", "Don-chan"],
  pc: ["Peach (Ice)", "Peach (Explorer)", "Peach (Halloween)", "Peach (Touring)", "Shantae"],
  ds: ["Daisy (Black/Teal)", "Daisy (Farmer)", "Daisy (Swimwear)", "Ludwig", "Bill Board", "Daisy (Yukata)"],
  ys: ["Yoshi (Black)", "Yoshi (Kangaroo)", "Piranha Plant", "Yoshi (Light-Blue)"],
  ca: ["Birdo (White)", "Mega Man", "Dolphin", "Shadow"],
  dd: ["Diddy Kong (All-Star)", "Dixie Kong", "The Chimp", "Iggy", "Fox McCloud"],
  jr: ["Bowser Jr. (Pirate)", "Hammer Bro", "Kamek", "Bowser Jr. (Wonder)", "Nabbit", "Ant Trooper"],
  wr: ["Wario (Cowboy)", "Wario (Hiker)", "King Bob-omb", "Wario (Metal)", "Morton", "Snooza Koopa"],
  wl: ["Waluigi (Athletic)", "Waluigi (Vampire)", "Wiggler", "Waluigi (Mariachi)", "Captain Falcon"],
  dk: ["DK (White)", "DK (Gladiator)", "Kritter", "Pokey", "King K. Rool", "Pianta"],
  kp: ["Dark Bowser", "Bowser (Santa)", "Chargin Chuck", "Boom Boom", "Bowser (Fury)", "Meowser"],
  kt: ["King Boo (LM)", "Gooper Blooper", "Goku", "King Boo (Aristocrat)"],
  rs: ["Rosalina (Aurora)", "Rosalina (Touring)", "Pauline", "Rosalina (Crystal Blue)", "Honey Queen", "Rosalina (Pro Racer)"],
  fk: ["Funky Kong", "Chain Chomp", "Funky Kong (Link)", "Funky Kong (Dripped Up)", "R.O.B", "Jaxi", "Donkey Kong Jr."],
  bk: ["Dry Bowser (Dark)", "Lubba", "Petey Piranha", "Plessie"]
};
const VEHICLES = [
  "Standard Kart S", "Standard Kart M", "Standard Kart L", "Baby Booster", "Classic Dragster", "Offroader",
  "Mini Beast", "Wild Wing", "Flame Flyer", "Cheep Charger", "Super Blooper", "Piranha Prowler",
  "Tiny Titan", "Daytripper", "Jetsetter", "Blue Falcon", "Sprinter", "Honeycoupe",
  "Standard Bike S", "Standard Bike M", "Standard Bike L", "Bullet Bike", "Mach Bike", "Flame Runner",
  "Bit Bike", "Sugarscoot", "Wario Bike", "Quacker", "Zip Zip", "Shooting Star",
  "Magikruiser", "Sneakster", "Spear", "Jet Bubble", "Dolphin Dasher", "Phantom"
];
const PAUSE_SAMPLES = 2;          // samples without a new frame before counting as paused
const RESTART_DELAY = 5000;

let latest = { running: false };
let previousFrame = null;
let stoppedSamples = 0;
let topSpeed = 0;

function onSample(sample) {
  // the race's frame counter stops while the game is paused
  const stopped = sample.inRace && sample.stage < STAGE_FINISHED && sample.frame === previousFrame;
  stoppedSamples = stopped ? stoppedSamples + 1 : 0;

  // a lower frame count means a new race or a restart
  if (!sample.inRace || previousFrame === null || sample.frame < previousFrame) topSpeed = 0;
  if (sample.inRace && Number.isFinite(sample.speed)) topSpeed = Math.max(topSpeed, sample.speed);

  previousFrame = sample.inRace ? sample.frame : null;
  latest = sample;
}

// costume counts change between Retro Rewind releases, so they come from the installed files
function variantCount(code) {
  try {
    return fs.readdirSync(path.join(RETRO_REWIND_ROOT, "Character", "Driver"))
      .filter(file => new RegExp(`^${code}-\\d+\\.brres$`).test(file)).length;
  } catch (_) {
    return 0;
  }
}

function characterLabel(sample) {
  const name = CHARACTERS[sample.character] || null;
  const code = CHARACTER_CODES[sample.character];
  const variant = sample.characterVariant;
  // a number outside the installed range isn't a costume
  if (!name || !code || !(variant >= 1) || variant > variantCount(code)) return name;
  // the first slot of every character is the normal look
  if (variant === 1) return name;
  return VARIANT_NAMES[code]?.[variant - 1] || `${name} Variant ${variant}`;
}

function engineLabel(sample) {
  if (sample.engineClass === 2 && sample.hardSpeedLimit && sample.hardSpeedLimit !== PLAIN_HARD_SPEED_LIMIT && sample.customCc > 0) return `${sample.customCc}cc`;
  return ENGINE_CLASSES[sample.engineClass] || null;
}

function startReader(signature) {
  const child = spawn("powershell.exe", [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", SCRIPT,
    "-CupSignature", signature, "-ParentPid", String(process.pid)
  ], { windowsHide: true, stdio: ["ignore", "pipe", "inherit"] });

  readline.createInterface({ input: child.stdout }).on("line", (line) => {
    try { onSample(JSON.parse(line)); } catch (_) {}
  });
  child.on("error", (e) => console.warn("Game reader failed:", e.message));
  child.on("exit", () => {
    latest = { running: false };
    setTimeout(() => startReader(signature), RESTART_DELAY);
  });
}

export function startLocalGame() {
  try {
    startReader(cupSignature());
  } catch (e) {
    console.warn("Singleplayer status unavailable:", e && e.message ? e.message : e);
  }
}

/**
 * localGameStatus: what the game is doing right now, or null when it isn't open
 */
export function localGameStatus() {
  if (!latest.running) return null;
  if (!latest.inRace) return { inRace: false };
  return {
    inRace: true,
    trackName: pulsarTrackName(latest.pulsarId, latest.variant),
    baseTrackName: pulsarTrackName(latest.pulsarId),
    gameMode: latest.gameMode,
    engine: engineLabel(latest),
    character: characterLabel(latest),
    vehicle: VEHICLES[latest.vehicle] || null,
    mirror: latest.mirror,
    position: latest.position,
    racers: latest.racers,
    timeMs: latest.timeMs,
    speed: Math.round(latest.speed || 0),
    topSpeed: Math.round(topSpeed),
    finished: latest.stage >= STAGE_FINISHED,
    paused: stoppedSamples >= PAUSE_SAMPLES
  };
}
