// One key per place name, whatever the feed's spelling (2026-11-07). Feeds
// write the same area as "Tombs Of The Kings" and "Tombs of the Kings", or
// transliterate it two ways ("Agios Nicolaos" / "Agios Nikolaos"); the
// presentation filter listed each spelling as its own chip. Leaf module: the
// client filter strip and the server matcher share it.

// Same place, other transliteration -> the key of the spelling we keep.
const ALIASES: Record<string, string> = {
  "agios nicolaos": "agios nikolaos",
  "pareklissia": "parekklisia",
  "souni zanatzia": "souni",
};

/** Lower case, accents and punctuation folded to single spaces, known transliterations merged. */
export function placeKey(raw: string | null | undefined): string {
  const k = (raw ?? "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return ALIASES[k] ?? k;
}

// "Of", "The" ... written capitalised inside a name: the weaker spelling.
const CAPPED_LINK = /\s(Of|The|And|Kai|De)\b/;

/** One display label per key: the spelling without capitalised link words, then the most frequent, then A-Z. */
export function canonicalPlaceLabels(values: Iterable<string>): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  Array.from(values).forEach((v) => {
    const label = v.trim();
    const key = placeKey(label);
    if (!key) return;
    const m = counts.get(key) ?? new Map<string, number>();
    m.set(label, (m.get(label) ?? 0) + 1);
    counts.set(key, m);
  });
  const out = new Map<string, string>();
  counts.forEach((spellings, key) => {
    const best = Array.from(spellings.entries()).sort(([a, na], [b, nb]) =>
      Number(CAPPED_LINK.test(a)) - Number(CAPPED_LINK.test(b)) || nb - na || a.localeCompare(b))[0][0];
    out.set(key, best);
  });
  return out;
}
