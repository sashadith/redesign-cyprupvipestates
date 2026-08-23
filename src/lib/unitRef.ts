// Normalize a unit ref for matching across re-syncs/re-renders: the source
// data isn't byte-stable across syncs ("Arbeo Villas Villa 1" one run, "Villa
// 1" or just "1" the next) — strip the project's own name if echoed into the
// ref, common filler words, and non-alphanumerics, so all variants of the
// same physical unit resolve to one key. Originally lived in
// driveAvailabilitySync.ts (unit-status re-sync matching); shared here so
// ClientPresentationItem.unitRefs (src/app/c/[token]/page.tsx) uses the exact
// same normalization, since a mismatch would silently drop units.
export function normalizeRef(s: string, projectName = ""): string {
  let x = s.toLowerCase();
  // Strip a "block <letter> " prefix ONLY when that same letter is echoed again
  // immediately after (2026-08-13, Motive Point/Venara: "block a a101" and
  // "a101" are the same physical unit — this document's convention redundantly
  // repeats the block letter as the ref's own first character). The lookahead
  // requires that exact redundancy so it never fires for a development where
  // the block letter carries real, non-redundant meaning — confirmed on real
  // data: two other developments in this DB use "block a 101"/"block b 101" as
  // genuinely DIFFERENT units with no letter on the number itself; a blanket
  // strip would have silently merged those. Source-side (pdfPricelistExtract.ts)
  // now avoids generating this redundant prefix in the first place — this stays
  // as the safety net for reconciling rows written before that fix landed.
  x = x.replace(/^block\s+([a-z])\s+(?=\1)/, "");
  // Then drop the literal WORD "block" wherever it appears, keeping the letter
  // that follows it. Olias names the same flat three different ways depending on
  // which file you read: the developer-wide master sheet says "A 101", the
  // project's own subfolder sheet says "101" in a "Block A" sub-table, and the
  // curated rows in this DB say "Block A 101". Without this they are three
  // different units, so the nightly master-sheet sync would have written a
  // duplicate set next to every curated row (measured 2026-08-23: 32 for Arbeo
  // Park, 51 for Lazzero Park).
  //
  // Note the difference from the rule above, which is what makes this safe: that
  // one strips the block LETTER as well, so it has to stay narrowly guarded —
  // developments do exist here where "block a 101" and "block b 101" are two
  // genuinely different flats, and dropping the letter would merge them. This
  // rule keeps the letter ("a101" vs "b101"), so it cannot. Verified against all
  // 244 developments: 221 refs in 9 projects change key, zero of them collide
  // with another ref in their own project.
  x = x.replace(/\bblock\b/g, " ");
  if (projectName) x = x.split(projectName.toLowerCase()).join(" ");
  return x.replace(/\b(villas?|units?|apartments?|apt|houses?|plots?|no|nr|number)\b/g, "").replace(/[^a-z0-9]+/g, "");
}
