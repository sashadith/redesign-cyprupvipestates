// Generic editable-text traversal for the homepage CMS document. Surfaces every plain-string
// leaf (titles, descriptions, labels, slide/city/review/benefit texts) as an editable field path,
// while leaving structure, media refs and rich (Portable Text) content untouched. Used by both
// the homepage admin editor (to render fields) and the save action (to write them back).

const SKIP_KEYS = new Set([
  "_key", "_type", "_ref", "_id", "_rev", "_createdAt", "_updatedAt",
  "asset", "type", "language", "slug",
]);
// Top-level homepage keys excluded from the generic text editor:
//  - title: internal admin label ("Homepage EN")
//  - contentBlocks: the rich page-builder array (its own follow-up tooling)
const EXCLUDE_TOP = new Set(["title", "contentBlocks"]);

// A Portable Text array (rich text) — never surfaced as plain editable strings.
function isPtArray(v: any): boolean {
  return Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === "object" && x._type === "block");
}

export function collectStringPaths(data: any): string[] {
  const out: string[] = [];
  const walk = (node: any, path: string) => {
    if (typeof node === "string") { if (path) out.push(path); return; }
    if (Array.isArray(node)) {
      if (isPtArray(node)) return;
      node.forEach((it, i) => walk(it, path ? `${path}.${i}` : String(i)));
      return;
    }
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        if (SKIP_KEYS.has(k)) continue;
        if (path === "" && EXCLUDE_TOP.has(k)) continue;
        walk(v, path ? `${path}.${k}` : k);
      }
    }
  };
  walk(data, "");
  return out;
}

export function getAtPath(data: any, path: string): string {
  let cur = data;
  for (const s of path.split(".")) {
    if (cur == null || typeof cur !== "object") return "";
    cur = cur[/^\d+$/.test(s) ? Number(s) : s];
  }
  return typeof cur === "string" ? cur : "";
}

// Only ever overwrites an EXISTING string leaf — never creates structure or touches non-strings.
export function deepSetString(data: any, path: string, value: string): void {
  const segs = path.split(".");
  let cur = data;
  for (let i = 0; i < segs.length - 1; i++) {
    const s = segs[i];
    const key = /^\d+$/.test(s) ? Number(s) : s;
    if (cur == null || typeof cur !== "object" || cur[key] == null || typeof cur[key] !== "object") return;
    cur = cur[key];
  }
  const last = segs[segs.length - 1];
  const lk = /^\d+$/.test(last) ? Number(last) : last;
  if (cur && typeof cur === "object" && typeof cur[lk] === "string") cur[lk] = value;
}

const titleCase = (s: string) => s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

export function groupLabel(seg: string): string {
  return titleCase(seg).replace(/ Block$/, "");
}

export function fieldLabel(path: string): string {
  const segs = path.split(".");
  return segs.slice(1).map((s) => (/^\d+$/.test(s) ? `#${Number(s) + 1}` : titleCase(s))).join(" › ") || titleCase(segs[0]);
}
