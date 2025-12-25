import fs from "fs";
import path from "path";
import { LANGUAGE } from "./config.js"; 

if (!LANGUAGE || typeof LANGUAGE !== "string") {
  throw new Error("i18n: LANGUAGE is not set in config.js — aborting startup (no fallback).");
}

const LOCALES_DIR = path.resolve(process.cwd(), "locales");
const filePath = path.join(LOCALES_DIR, `${LANGUAGE}.json`);
if (!fs.existsSync(filePath)) {
  throw new Error(`i18n: Locale file not found: ${filePath} — aborting startup (no fallback).`);
}

let translations;
try {
  translations = JSON.parse(fs.readFileSync(filePath, "utf8"));
} catch (e) {
  throw new Error(`i18n: Failed to parse ${filePath}: ${e.message}`);
}

function ensureKeyExists(key) {
  if (!(key in translations)) {
    throw new Error(`i18n: Missing translation key "${key}" in ${filePath} — aborting startup.`);
  }
}

/**
 * t(key) -> string
 * Throws if key missing.
 */
export function t(key) {
  ensureKeyExists(key);
  return translations[key];
}

export function allTranslations() {
  return Object.assign({}, translations);
}

export default {
  t,
  allTranslations
};
