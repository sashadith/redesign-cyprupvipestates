// Developer Feed Analysis — XML structure analysis (discovery only).
// Parses an XML feed, finds the repeating item node, flattens each item to leaf
// field paths, samples example values, and annotates every field with an
// inferred type + suggested internal field + recommendation. NO import, NO DB,
// NO writes to Project. Uses the already-installed `xml2js`.

import { parseStringPromise } from "xml2js";
import { inferType, suggestInternalField, recommend, CATALOG_BY_KEY, locationLabel, NUMERIC_KEYS, type InferredType, type Recommendation } from "./catalog";

export const MAX_FEED_BYTES = 5 * 1024 * 1024; // 5 MB app-level cap (see rawXml)

export type FieldDescriptor = {
  path: string; // dot path within an item, attributes prefixed with "@"
  originalName: string; // leaf name only
  inferredType: InferredType;
  exampleValues: string[]; // up to 3 distinct non-empty samples
  occurrencePct: number; // % of items that have this field (0..100)
  suggestedInternalField: string | null;
  existsInInternal: boolean;
  internalLocation: string | null; // human label, null when not stored
  recommendation: Recommendation;
  include: boolean; // admin toggle (default true unless recommendation is "ignore")
  notes: string;
};

export type AnalysisResult = {
  itemNodePath: string | null;
  itemCount: number;
  fields: FieldDescriptor[];
};

const ATTR_KEY = "$";
const CHAR_KEY = "_";

// Parse XML into a JS tree. explicitArray:false → single children stay objects,
// repeated children become arrays (natural shape for detection + flattening).
export async function parseXml(xml: string): Promise<any> {
  return parseStringPromise(xml, {
    explicitArray: false,
    mergeAttrs: false,
    attrkey: ATTR_KEY,
    charkey: CHAR_KEY,
    trim: true,
    explicitRoot: true,
  });
}

const isPlainObject = (v: any) => v != null && typeof v === "object" && !Array.isArray(v);

// Walk the tree collecting every array-of-objects with its dotted path. The
// repeating item collection is the array with the most elements (tie-break: the
// richest/most-consistent object shape).
function findItemArrays(node: any, path: string, out: { path: string; items: any[] }[]) {
  if (Array.isArray(node)) {
    if (node.some(isPlainObject)) out.push({ path, items: node.filter(isPlainObject) });
    node.forEach((child) => { if (isPlainObject(child)) walkChildren(child, path, out); });
    return;
  }
  if (isPlainObject(node)) walkChildren(node, path, out);
}
function walkChildren(obj: any, path: string, out: { path: string; items: any[] }[]) {
  for (const [k, v] of Object.entries(obj)) {
    if (k === ATTR_KEY || k === CHAR_KEY) continue;
    findItemArrays(v, path ? `${path}.${k}` : k, out);
  }
}

// Arrays whose element is a media node (an image/photo/gallery/floorplan list)
// must never be chosen as the repeating PROPERTY node — feeds often carry more
// image nodes than properties, which used to hijack detection.
const MEDIA_KEYS = new Set([
  "image", "images", "img", "photo", "photos", "picture", "pictures",
  "gallery", "galleries", "floorplan", "floorplans", "media", "thumbnail",
  "thumbnails", "video", "videos", "attachment", "attachments",
]);
const lastSeg = (p: string) => p.split(".").pop()!.toLowerCase();

// Pick the repeating item node. Media arrays are excluded; among the rest the
// largest array of objects wins (tie-break: richer object). If a feed has a
// single item (no arrays), fall back to the deepest record-like object.
export function detectItems(parsed: any): { itemNodePath: string | null; items: any[] } {
  const all: { path: string; items: any[] }[] = [];
  findItemArrays(parsed, "", all);
  // Prefer non-media candidates; only fall back to media ones if nothing else.
  const nonMedia = all.filter((c) => !MEDIA_KEYS.has(lastSeg(c.path)));
  const candidates = nonMedia.length ? nonMedia : all;
  if (candidates.length) {
    candidates.sort((a, b) => {
      if (b.items.length !== a.items.length) return b.items.length - a.items.length;
      const keys = (c: typeof a) => (c.items[0] ? Object.keys(c.items[0]).length : 0);
      return keys(b) - keys(a);
    });
    const best = candidates[0];
    return { itemNodePath: best.path, items: best.items };
  }
  // fallback: single-item feed — deepest object with the most leaf keys
  let best: { path: string; obj: any; score: number } | null = null;
  const visit = (node: any, path: string) => {
    if (!isPlainObject(node)) return;
    const leafCount = Object.entries(node).filter(([k, v]) => k !== ATTR_KEY && k !== CHAR_KEY && (v == null || typeof v !== "object")).length;
    if (!best || leafCount > best.score) best = { path, obj: node, score: leafCount };
    for (const [k, v] of Object.entries(node)) {
      if (k === ATTR_KEY || k === CHAR_KEY) continue;
      visit(v, path ? `${path}.${k}` : k);
    }
  };
  visit(parsed, "");
  const b = best as { path: string; obj: any; score: number } | null;
  return b && b.score > 0 ? { itemNodePath: b.path, items: [b.obj] } : { itemNodePath: null, items: [] };
}

// Flatten one item to { leafPath: scalarValue }. Attributes → "@name"; text of a
// node with attributes → the node's own path; arrays collapse the index (so
// repeated <image> become one "images.image" field with multiple samples).
function flattenItem(node: any, prefix: string, out: Record<string, string[]>) {
  const push = (p: string, val: any) => {
    if (val == null) return;
    const s = String(val).trim();
    if (s === "") return;
    (out[p] ||= []).push(s);
  };
  if (node == null) return;
  if (Array.isArray(node)) {
    node.forEach((child) => flattenItem(child, prefix, out));
    return;
  }
  if (isPlainObject(node)) {
    for (const [k, v] of Object.entries(node)) {
      if (k === ATTR_KEY && isPlainObject(v)) {
        for (const [ak, av] of Object.entries(v as Record<string, any>)) push(`${prefix ? prefix + "." : ""}@${ak}`, av);
      } else if (k === CHAR_KEY) {
        push(prefix, v); // text content of a node that also had attributes
      } else {
        flattenItem(v, prefix ? `${prefix}.${k}` : k, out);
      }
    }
    return;
  }
  push(prefix, node); // scalar leaf
}

const leafName = (path: string) => path.replace(/^@/, "").split(".").pop()!.replace(/^@/, "");
const uniq = (arr: string[]) => Array.from(new Set(arr));
const isNum = (v: string) => v != null && String(v).trim() !== "" && !isNaN(Number(String(v).replace(/[\s,€$£%]/g, "")));
// Localized / generic wrappers whose own name carries no meaning — match on the
// PARENT segment instead (so "Description.description.en" → "description").
const WRAPPER = /^(en|de|pl|ru|gr|el|fr|it|es|value|text|_)$/i;

// The name to match a field on: usually its leaf, but for localized/generic
// wrappers use the parent path segment.
function matchName(path: string): string {
  const leaf = leafName(path);
  if (!WRAPPER.test(leaf)) return leaf;
  const segs = path.split(".");
  return segs.length >= 2 ? segs[segs.length - 2].replace(/^@/, "") : leaf;
}

// Build the field descriptor list from the detected items.
export function buildFields(items: any[]): FieldDescriptor[] {
  const total = items.length || 1;
  const perField: Record<string, string[]> = {};
  const presence: Record<string, number> = {};
  for (const item of items) {
    const flat: Record<string, string[]> = {};
    flattenItem(item, "", flat);
    for (const [p, vals] of Object.entries(flat)) {
      (perField[p] ||= []).push(...vals);
      presence[p] = (presence[p] ?? 0) + 1; // present in this item
    }
  }
  const fields: FieldDescriptor[] = Object.keys(perField).sort().map((path) => {
    const values = perField[path];
    const examples = uniq(values).slice(0, 3);
    const name = matchName(path);
    const type = inferType(name, values);
    let suggested = suggestInternalField(name);
    let note = "";
    // Non-numeric guard: a numeric-expecting field mapped from a name but whose
    // sampled values are non-numeric labels (e.g. "Area" = "Polis") → drop it.
    if (suggested && NUMERIC_KEYS.has(suggested) && !values.some(isNum)) {
      suggested = null;
      note = "Values look non-numeric — likely a label, not this field. Review.";
    }
    const entry = suggested ? CATALOG_BY_KEY[suggested] : undefined;
    const exists = !!entry && entry.location.kind !== "none";
    const rec = recommend(suggested, type, name);
    return {
      path,
      originalName: leafName(path),
      inferredType: type,
      exampleValues: examples,
      occurrencePct: Math.round(((presence[path] ?? 0) / total) * 100),
      suggestedInternalField: suggested,
      existsInInternal: exists,
      internalLocation: entry ? locationLabel(entry.location) : null,
      recommendation: rec,
      include: rec !== "ignore",
      notes: note,
    };
  });
  return fields;
}

export async function analyzeXml(xml: string): Promise<AnalysisResult> {
  const parsed = await parseXml(xml);
  const { itemNodePath, items } = detectItems(parsed);
  const fields = buildFields(items);
  return { itemNodePath, itemCount: items.length, fields };
}
