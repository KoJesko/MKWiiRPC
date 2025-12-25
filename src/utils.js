import * as cheerio from "cheerio";

// Normalise whitespace 
export function normalizeText(s) {
  if (!s) return "";
  return String(s).replace(/\s+/g, " ").trim();
}

// Safe integer parse for points 
export function safeParseInt(s) {
  if (!s) return 0;
  const n = parseInt(String(s).replace(/[^\d\-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

// Convert a cheerio cell that may contain <br> into an array of names 
export function splitNamesFromCell(cell) {
  if (!cell || !cell.length) return [];
  // clone to avoid mutating the main DOM
  const cloned = cell.clone();
  cloned.find("br").replaceWith("\n");
  return cloned
    .text()
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Create a compact presence-friendly small text line.
 * Format: "MiiName FriendCode • VR: WXYZ"
 * Truncates to maxLen if provided.
 */
export function buildSmallText(firstMii, extraCount, friendCode, pointsLabel, pointsRaw, maxLen = 128) {
  const plus = extraCount > 0 ? ` (+${extraCount})` : "";
  const parts = [
    `${firstMii}${plus}`.trim(),
    friendCode || "",
    pointsRaw && pointsRaw > 0 ? `${pointsLabel}: ${pointsRaw}` : ""
  ].filter(Boolean);

  const joined = parts.join(" • ");
  return joined.length > maxLen ? joined.slice(0, maxLen) : joined;
}
