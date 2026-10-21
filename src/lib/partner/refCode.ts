// Partner ref code (2026-10-18): "<slug>-<4 base36>", e.g. "alfa-homes-k3x9".
// Pure; the caller retries on a unique-constraint collision (max 5).
const MAP: Record<string, string> = {
  ä: "ae", ö: "oe", ü: "ue", ß: "ss",
  ą: "a", ł: "l", ś: "s", ż: "z", ź: "z", ć: "c", ń: "n", ó: "o", ę: "e",
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function slugify(input: string | null | undefined, max = 16): string {
  const lower = (input ?? "").toLowerCase();
  let out = "";
  // Mapped letters first (ä→ae, й→y need their precomposed form); any other accented letter is
  // decomposed (NFD) and its combining marks dropped, so "René" → "rene", "Noël" → "noel".
  for (const ch of lower.normalize("NFC")) out += MAP[ch] ?? ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return out.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/g, "");
}

export function newRefCode(seed: { company?: string | null; lastName: string }, random: () => string): string {
  const slug = slugify(seed.company) || slugify(seed.lastName) || "partner";
  return `${slug}-${random()}`;
}

/** 4 random base36 chars. */
export function randomSuffix(): string {
  let s = "";
  while (s.length < 4) s += Math.floor(Math.random() * 36).toString(36);
  return s;
}
