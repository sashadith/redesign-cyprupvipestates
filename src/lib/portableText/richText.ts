// Shared, dependency-free helpers for locating and addressing Portable Text
// fields anywhere inside a content block. Used by the admin BlockFieldEditor
// (client) to render a RichTextField per rich field, and by the save actions
// (server) to write converted Portable Text back at the right path. Keeping the
// detection generic means NO per-block-type registry and no hand-built PT.

/** A value is Portable Text if it's an array containing at least one `block`. */
export function isPortableText(v: unknown): boolean {
  return Array.isArray(v) && v.some((n) => n && typeof n === "object" && (n as any)._type === "block");
}

/**
 * While editing, a rich field's value is replaced by `{ __html }` (the editor
 * works in HTML; htmlToPortableText only runs server-side). The marker travels
 * with its parent through add/remove/reorder, and the save action converts every
 * marker back to Portable Text. This avoids index-fragile path bookkeeping.
 */
export function isHtmlMarker(v: unknown): v is { __html: string } {
  return !!v && typeof v === "object" && !Array.isArray(v) && typeof (v as any).__html === "string";
}

const isIndex = (s: string) => /^\d+$/.test(s);

/** Read a value at a dot-path ("a.b.0.c"). */
export function getAtPath(obj: any, path: string): any {
  return path.split(".").reduce((o, seg) => (o == null ? o : o[isIndex(seg) ? Number(seg) : seg]), obj);
}

/** Write a value at a dot-path, creating intermediate objects/arrays as needed. */
export function setAtPath(obj: any, path: string, value: any): void {
  const segs = path.split(".");
  let o = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const key = isIndex(segs[i]) ? Number(segs[i]) : segs[i];
    if (o[key] == null) o[key] = isIndex(segs[i + 1]) ? [] : {};
    o = o[key];
  }
  const last = segs[segs.length - 1];
  o[isIndex(last) ? Number(last) : last] = value;
}

export type RichField = { path: string; label: string };

/** Recursively collect every Portable Text field within a block, by path. */
export function findRichFields(node: any, base = "", out: RichField[] = []): RichField[] {
  if (isPortableText(node) || isHtmlMarker(node)) {
    out.push({ path: base, label: humanizePath(base) });
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((n, i) => findRichFields(n, base ? `${base}.${i}` : String(i), out));
    return out;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith("_")) continue; // skip _type/_key etc.
      findRichFields(v, base ? `${base}.${k}` : k, out);
    }
  }
  return out;
}

const FILLER = new Set(["blockContent", "content", "value"]);
/** Turn "leftContent.blockContent.content" → "Left", "reviews.0.text" → "Reviews #1 Text". */
export function humanizePath(path: string): string {
  const parts = path
    .split(".")
    .filter((s) => !FILLER.has(s))
    .map((s) => (isIndex(s) ? `#${Number(s) + 1}` : s.replace(/([a-z])([A-Z])/g, "$1 $2")))
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
  return parts.join(" ").trim() || "Rich text";
}
