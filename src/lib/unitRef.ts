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
  if (projectName) x = x.split(projectName.toLowerCase()).join(" ");
  return x.replace(/\b(villas?|units?|apartments?|apt|houses?|plots?|no|nr|number)\b/g, "").replace(/[^a-z0-9]+/g, "");
}
