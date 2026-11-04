/* Extra links an admin can attach to a development: a project video, a 360°
   tour, a virtual walkthrough, a project camera. Each one renders as a button
   under the description on the project page and opens in a new tab.

   The admin stores a KIND, never a caption: the caption is resolved at render
   time from developmentCopy, so one stored link reads correctly in all five
   languages. Adding a kind means adding it here AND a label in all five
   DEVELOPMENT_STRINGS objects — the ExtraLinkKind type makes a missing label a
   type error rather than a blank button.

   Lives in DevelopmentOverride (not on Development): feedSync.ts writes the
   Development row on every sync and would wipe an admin's links the next night,
   exactly as it used to wipe `stage` (Celestia, 2026-07-17/18). Nothing ever
   syncs into the override table. */

export const EXTRA_LINK_KINDS = ["video", "tour360", "walkthrough", "camera"] as const;
export type ExtraLinkKind = (typeof EXTRA_LINK_KINDS)[number];

export type ExtraLink = { kind: ExtraLinkKind; url: string };

const isKind = (v: unknown): v is ExtraLinkKind => typeof v === "string" && (EXTRA_LINK_KINDS as readonly string[]).includes(v);

/** https:// only. A bare domain, http:// or a javascript:/data: URL is refused
 *  rather than silently rendered — the href goes straight into the page. */
export function isValidExtraLinkUrl(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const s = raw.trim();
  if (!s) return false;
  try {
    return new URL(s).protocol === "https:";
  } catch {
    return false;
  }
}

/** A link straight to a video FILE (our own /uploads, 2026-10-31: Riviera
 *  Resort's two films) plays in a popup on the page instead of opening a tab
 *  that shows nothing but the browser's bare player. Pages — YouTube, a 360°
 *  viewer, a camera portal — still open in a new tab. */
export function isPlayableVideoUrl(raw: string): boolean {
  try {
    return /\.(mp4|webm|m4v)$/i.test(new URL(raw).pathname);
  } catch {
    return false;
  }
}

/** Read whatever sits in the Json column into a list the page can render.
 *
 *  Defensive on purpose: this parses a Json column, so it may hold anything an
 *  older write or a hand-edited row left behind. Unknown kinds, bad URLs and
 *  non-objects are dropped one by one — a single bad entry must not cost the
 *  page its other buttons. A duplicate kind keeps the FIRST occurrence, so the
 *  page never shows the same caption twice pointing at two different places. */
export function parseExtraLinks(value: unknown): ExtraLink[] {
  if (!Array.isArray(value)) return [];
  const out: ExtraLink[] = [];
  const seen = new Set<ExtraLinkKind>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const kind = (item as { kind?: unknown }).kind;
    const url = (item as { url?: unknown }).url;
    if (!isKind(kind) || seen.has(kind)) continue;
    if (!isValidExtraLinkUrl(url)) continue;
    seen.add(kind);
    out.push({ kind, url: String(url).trim() });
  }
  return out;
}

/** Form value (a JSON string from ExtraLinksField) → the column value.
 *  An empty list stores as null, the same null-when-empty convention the
 *  description and promoBlocks fields in this override already follow. */
export function extraLinksFromJson(raw: unknown): ExtraLink[] | null {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return null;
    try {
      parsed = JSON.parse(s);
    } catch {
      return null;
    }
  }
  const links = parseExtraLinks(parsed);
  return links.length ? links : null;
}
