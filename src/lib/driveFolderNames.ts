/* Pure name logic for the Drive folder adapter — no database, no network, no AI.
   Split out of driveAvailabilitySync.ts (2026-08-24) so it can be exercised directly:
   this is where a mistake silently writes one project onto another project's row,
   and it is the one part of the adapter that can be checked without touching Drive
   or the database at all. */

export const nameKey = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
/** A prefix relation below this many characters is a coincidence, not a match. */
export const MIN_PREFIX_KEY = 6;

/* Deterministic project-name matching for FOLDER identity. Deliberately NOT
   buildCanonicalMatcher (2026-08-24) — that one scores by word overlap over the
   larger word count and accepts anything from 0.5 up, which is fine for resolving
   an AI's paraphrase of a name it just read, and catastrophic here: within one
   developer's catalogue almost every name ends in the same generic noun, so a
   SINGLE shared word clears the threshold. Measured against Olias Homes' real
   folder list and real rows: "Amalfi Homes" scored 0.5 against "Olivelia Homes"
   and "Birch Park" 0.5 against "Blossom Park" — both matched, i.e. two brand-new
   projects would each have been written straight onto an existing, published
   project's row, pruning its units against a completely different price list.

   Exact normalized key first, then a prefix relation in either direction (which
   is what "Tenera Villas" → "Tenera Villas 1A & 1B" needs, and what no unrelated
   pair in the catalogue satisfies). More than one candidate at the same level is
   AMBIGUOUS and resolves to nothing: guessing between two real projects is the
   one outcome worse than reporting that a folder could not be placed. */
export function matchProjectByName<T>(names: string[], publicNameOf: (t: T) => string, candidates: T[]): { hit: T | null; ambiguous: T[] } {
  const keys = names.map(nameKey).filter(Boolean);
  if (!keys.length) return { hit: null, ambiguous: [] };

  const exact = candidates.filter((c) => keys.includes(nameKey(publicNameOf(c))));
  if (exact.length === 1) return { hit: exact[0], ambiguous: [] };
  if (exact.length > 1) return { hit: null, ambiguous: exact };

  const prefixed = candidates.filter((c) => {
    const ck = nameKey(publicNameOf(c));
    return !!ck && keys.some((k) => (k.startsWith(ck) || ck.startsWith(k)) && Math.min(k.length, ck.length) >= MIN_PREFIX_KEY);
  });
  if (prefixed.length === 1) return { hit: prefixed[0], ambiguous: [] };
  return { hit: null, ambiguous: prefixed };
}

/* A per-project price list should describe exactly one project — but a folder can
   also end up holding a copy of the developer-wide sheet, and this failure mode is
   already on record here: Kuutio's shared workbook carries three leftover Olias
   Homes tabs. Combined with knownProject (which forces EVERY row onto this folder's
   project), that would import another project's units under this project's name and
   then prune the real ones away.

   Narrow, deliberately: a tab is dropped ONLY when its name matches a DIFFERENT
   project of this same developer. Anything else stays — "Sheet1", "Properties",
   "Gaia", "Edge", "Block B", "Notes" (all real tab names in this developer's
   folders) mean nothing to us and must never be second-guessed. An earlier version
   kept only tabs matching THIS project and dropped the rest; against the real
   folders that would have thrown away a legitimate second block tab the moment a
   sheet had one, to defend against a case that isn't present. Deterministic, no AI,
   and it can only ever remove a tab that provably belongs to a sibling project. */
export function scopeSheetToProject(text: string, project: string, siblings: string[]): string {
  const parts = text.split(/^### (.+)$/m);
  const sectionCount = (parts.length - 1) / 2;
  if (sectionCount < 2 || !siblings.length) return text;
  const pk = nameKey(project);
  const foreign = siblings.map(nameKey).filter((k) => k && k !== pk);
  if (!foreign.length) return text;

  const kept: string[] = [];
  let dropped = 0;
  for (let i = 1; i < parts.length; i += 2) {
    const tk = nameKey(parts[i]);
    const isForeign =
      !!tk && tk !== pk &&
      foreign.some((k) => k === tk || (Math.min(k.length, tk.length) >= MIN_PREFIX_KEY && (k.startsWith(tk) || tk.startsWith(k))));
    if (isForeign) { dropped++; continue; }
    kept.push(`### ${parts[i]}\n${parts[i + 1] ?? ""}`);
  }
  return dropped && kept.length ? kept.join("\n") : text;
}

/** Strip the location/stage suffix Drive folder names routinely carry — "Grato
 *  Homes 2 - Sea Caves/Pegia", "Osmia Bee Home - Tala", "Arbeo Park (SOLD OUT)"
 *  — so the folder name can be compared with, and become, a project name. Only
 *  the LAST " - " segment goes, so a project genuinely called "A - B - C" keeps
 *  "A - B". Nothing is lost by stripping: the location comes back off the price
 *  list's own "Location:" row as `area`, which is also where the twelve projects
 *  already in the database got theirs — none of them carries the suffix in its
 *  publicName, so keeping it here would fork every one of them into a duplicate. */
export const folderProjectName = (name: string) =>
  name.replace(/\s*\([^)]*\)\s*$/, "").replace(/\s+[-–—]\s+[^-–—]+$/, "").trim() || name.trim();
