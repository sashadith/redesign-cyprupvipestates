import { isCompletionPast, resolveRelativeCompletion } from "@/lib/completionDate";

// Admin-entered descriptions (DevelopmentOverride.descriptionEN/DE/PL/RU) are
// stored as plain text with CRLF line breaks ("\r\n\r\n" between paragraphs,
// occasionally a lone "\r\n" mid-paragraph) — never HTML. Two renderers used
// to split on \r?\n{2,}, which only matches an optional single \r followed
// by 2+ CONSECUTIVE \n — never true for real "\r\n\r\n" data (the \r always
// breaks up the \n run), so paragraph breaks were silently dropped and
// everything rendered as one block. Normalizing CRLF -> LF before splitting
// fixes it; also collapses stray runs of spaces left over from any
// previously-lost line break (e.g. "of place.  This development").
export function splitDescriptionParagraphs(text: string): string[][] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.replace(/[ \t]{2,}/g, " ").trim())
    .filter(Boolean)
    .map((p) => p.split(/\n/));
}

// Completion/delivery dates come in two very different shapes depending on
// source: legacy Projects always store a clean ISO date ("2026-04-01"); the
// Development pipeline stores whatever free text the feed or an admin typed
// ("Q1 2028", "October 2026", "Q1 2028 (Block A & B), Q3 2028 (Block C & D)",
// even non-dates like "Ready"). A card that called `new Date(raw).getFullYear()`
// on the latter got a value that depends on the JS engine's non-standard
// loose date parser — Node (SSR) and the browser (hydration) can disagree,
// which React then "fixes" by silently dropping the mismatched text after
// first paint. Extract the year with a plain regex instead: deterministic,
// identical on server and client, and returns "" (not a NaN-derived "") for
// non-date strings like "Ready" — never call `new Date()` on this field in a
// rendered component again; resolve it to a plain string here, once.
//
// Returns the sentinel "ready" once the completion lies in the past (or reads
// "Ready"/"Completed"): the cards then show the localized "Key-Ready" label
// (projectsStrings().keyReady) instead of a year that has gone by (2026-10-06).
export function resolveCompletionYear(raw: string | null | undefined, now: Date = new Date()): string {
  if (!raw) return "";
  if (isCompletionPast(raw, now)) return "ready";
  // "24 months from signing" carries no year to extract — resolve it to a
  // concrete quarter first, then pull the year out of that. See
  // resolveRelativeCompletion; anything else passes through untouched.
  // Several blocks with their own dates ("Q4 2025 (Block A), Q2 2027 (Block
  // B)"): the project is finished when the LAST one is, so show the latest year.
  const years = resolveRelativeCompletion(raw).match(/(19|20)\d{2}/g);
  return years ? String(Math.max(...years.map(Number))) : "";
}
