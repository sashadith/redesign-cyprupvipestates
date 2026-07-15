import { anthropic, AI_MODEL_FAST } from "./anthropic";

/* Extract project + per-unit data from a developer's master price list (a flattened
   spreadsheet / CSV / PDF text). To avoid the model intermittently mis-formatting a
   nested projects[].units[] tool payload, everything is requested as FLAT arrays
   (one item per unit / per project) across small calls, then grouped in code. */

export type ExtractedUnit = {
  ref: string;
  bedrooms?: string;
  bathrooms?: string;
  areaBuilt?: string;       // total built/internal area, when given as one figure
  areaGroundFloor?: string; // internal ground-floor area, when the sheet splits by floor instead
  areaUpperFloor?: string;  // internal upper/lower/first-floor area (the other half of the split)
  areaPlot?: string;
  areaVeranda?: string;     // covered veranda(s)
  areaVerandaOpen?: string; // uncovered veranda / veranda with louvers
  parking?: string;         // covered or semi-covered parking
  storage?: string;         // plant room / storage
  pool?: string;            // private pool dimensions, when the unit has its own
  extras?: string;          // any other notable per-unit detail (e.g. "2 floors", "Gym 20m²")
  price: number | null;
  status: "available" | "reserved" | "sold";
};
export type ExtractedPricelistProject = {
  project: string;
  location?: string;
  mapsUrl?: string;
  propertyType?: string;
  completion?: string;
  amenities?: string[];
  notes?: string; // raw "Prices include…" paragraph, verbatim — feeds the description generator as real source text
  units: ExtractedUnit[];
};

const flatSchema = (itemProps: Record<string, any>, required: string[]) => ({
  type: "object",
  properties: { items: { type: "array", items: { type: "object", properties: itemProps, required } } },
  required: ["items"],
});

const SCHEMA_UNITS = flatSchema({
  project: { type: "string" },
  ref: { type: "string" },
  bedrooms: { type: "string" },
  bathrooms: { type: "string" },
  areaBuilt: { type: "string" },
  areaGroundFloor: { type: "string" },
  areaUpperFloor: { type: "string" },
  areaPlot: { type: "string" },
  areaVeranda: { type: "string" },
  areaVerandaOpen: { type: "string" },
  parking: { type: "string" },
  storage: { type: "string" },
  pool: { type: "string" },
  extras: { type: "string" },
  price: { type: ["number", "null"] },
  status: { type: "string", enum: ["available", "reserved", "sold"] },
}, ["project", "ref", "status"]);

const SCHEMA_CATALOG = flatSchema({
  project: { type: "string" },
}, ["project"]);

const SCHEMA_META = flatSchema({
  project: { type: "string" },
  location: { type: "string" },
  mapsUrl: { type: "string" },
  propertyType: { type: "string" },
  completion: { type: "string" },
}, ["project"]);

const SCHEMA_AMEN = flatSchema({
  project: { type: "string" },
  amenities: { type: "array", items: { type: "string" } },
  notes: { type: "string" },
}, ["project", "amenities"]);

// Prompt-caching evaluated for these four static prompts (they're identical across
// all sections/developers within a sync run — the classic cache_control candidate).
// Not applied: this file runs on AI_MODEL_FAST (Haiku 4.5), whose minimum cacheable
// prefix is 2048 tokens (Sonnet/Opus is 1024). Even PROMPT_UNITS, the largest, is
// only ~600 tokens of instruction text (~750-800 incl. its tool schema) — about a
// third of the Haiku floor. cache_control would be silently ignored by the API
// (no error, no cache_creation, no read savings), so it's omitted here rather than
// added as dead weight. Revisit if PROMPT_UNITS grows substantially or this file
// moves to a Sonnet/Opus-tier model.
const PROMPT_CATALOG = `You are given a developer's master PRICE LIST (flattened text), usually starting with a summary/catalogue table listing every project once. Return a FLAT list "items" — ONE item per DISTINCT project in the whole document, using each project's full, canonical name as given in that summary table (not an abbreviated tab title used later in the document):
- project: the canonical project name.

PRICE LIST:
`;

const PROMPT_UNITS = `You are given ONE section of a developer's master PRICE LIST (spreadsheet flattened to text) — it covers exactly ONE project, named in its own first row/title. Return a FLAT list "items" of EVERY sellable unit in this section — one item per unit:
- project: the SAME project name for every single item, taken from this section's own title/first row. A section is often internally divided into sub-groups (e.g. "Block A", "Block B", a separate "Villa Number" table, apartments vs villas) — those are NOT separate projects, they are all part of THIS ONE project. Never invent a per-block or per-subtable project name; use one identical string for all items.
- ref: the unit / villa / apartment label as shown (prefix the block, e.g. "Block A 201").
- bedrooms, bathrooms: as given.
- areaBuilt: the total built/internal area, ONLY when the sheet gives ONE such figure.
- areaGroundFloor, areaUpperFloor: when the sheet instead SPLITS internal area by floor (e.g. "Ground Floor (m²)" + "Lower Floor (m²)" / "First Floor (m²)") — fill these two instead of areaBuilt.
- areaPlot: plot size, when given.
- areaVeranda: COVERED veranda(s) area (may be labelled "Covered Verandas", possibly split Ground/First floor — sum them into one figure).
- areaVerandaOpen: UNCOVERED veranda area, or a "Verandas with Louvers" column if the sheet has both covered and louvered verandas as distinct columns (louvers go here).
- parking: covered or semi-covered parking area/description.
- storage: "Plant Room / Storage" area/description.
- pool: private pool dimensions for THIS unit only (e.g. "3.5 x 9m"), not a shared/common pool.
- extras: any other short notable per-unit detail in a "Details"/"Extras"-type column (e.g. "2 floors", "Gym 20m²") — leave blank if there's no such column or it's empty for this row.
- price: numeric EUR digits ONLY if the unit is available, else null.
- status: "sold" if the price cell reads SOLD; "reserved" if RESERVED; otherwise "available".
A numeric price ⇒ available. Only fill the fields the sheet actually provides for that project — leave the rest blank, never invent values. Ignore payment/furniture-package/notes rows — those are not units. Do not invent units.

PRICE LIST:
`;

const PROMPT_META = `You are given a developer's master PRICE LIST (flattened text). Return a FLAT list "items" with ONE item per PROJECT:
- project: the project name.
- location: the location text.
- mapsUrl: the Google Maps URL if present (often a "Location:" row with a goo.gl/maps or maps.app.goo.gl link — copy it EXACTLY as shown, do not shorten/modify).
- propertyType: e.g. "Luxury Villas" / "Luxury Apartments".
- completion: the delivery date if given (e.g. "November 2028").

PRICE LIST:
`;

const PROMPT_AMEN = `You are given a developer's master PRICE LIST (flattened text). Return a FLAT list "items" with ONE item per PROJECT:
- project: the project name.
- amenities: the included features from the "Notes: In the prices we include …" / "Features INCLUDED" rows (e.g. "VRV cooling", "Underfloor heating", "Photovoltaic system", "Alarm system", "Swimming pool", "Electric car charger", "Children's playground"). Split combined sentences into separate items; drop prices and furniture-package lines.
- notes: the FULL "Notes: …" sentence(s) verbatim, exactly as written (including any furniture-package price mentioned) — this is used as authentic source text, not just tags. Empty string if there's no notes row.

PRICE LIST:
`;

async function callTool(client: any, prompt: string, schema: any): Promise<any[]> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const msg = await client.messages.create({
      model: AI_MODEL_FAST,
      max_tokens: 16000,
      tools: [{ name: "data", description: "Extracted items.", input_schema: schema }],
      tool_choice: { type: "tool", name: "data" },
      messages: [{ role: "user", content: prompt }],
    });
    const tool = msg.content.find((b: any) => b.type === "tool_use") as any;
    let items: any = tool?.input?.items;
    if (typeof items === "string") { try { items = JSON.parse(items); } catch { items = null; } }
    if (Array.isArray(items)) return items;
  }
  return [];
}

const key = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const words = (s: string) => (s || "").toLowerCase().match(/[a-z0-9]+/g) || [];

// Resolve a per-call project-name guess to one canonical name from the catalogue,
// by word overlap (normalized by the SHORTER word-list so an abbreviated guess like
// "Lazzero" or "Grato 2" — or a guess a section-level call polluted with an internal
// sub-group like "Arbeo Park - Block A" — still matches its one true project). Falls
// back to the guess itself when nothing scores above the threshold, so we never drop data.
export function buildCanonicalMatcher(names: string[]) {
  const entries = names.map((n) => ({ name: n, w: new Set(words(n)) }));
  const cache = new Map<string, { name: string; matched: boolean }>();
  return (guess: string): { name: string; matched: boolean } => {
    if (!guess) return { name: guess, matched: false };
    const cached = cache.get(guess);
    if (cached) return cached;
    const gw = words(guess);
    let best: { name: string; score: number } | null = null;
    for (const e of entries) {
      if (!e.w.size) continue;
      const hit = gw.filter((w) => e.w.has(w)).length;
      const score = hit / Math.min(gw.length || 1, e.w.size);
      if (hit > 0 && (!best || score > best.score || (score === best.score && e.name.length > best.name.length))) best = { name: e.name, score };
    }
    const result = best && best.score >= 0.5 ? { name: best.name, matched: true } : { name: guess, matched: false };
    cache.set(guess, result);
    return result;
  };
}

// The sheet is laid out as one "### Project Name" section per project (added by
// getSpreadsheetText, one per source tab). Splitting the UNITS extraction per
// section keeps each call small and focused — asking for every unit across an
// entire multi-project catalogue in one tool call made the (now much larger,
// per-field) output prone to hitting the token cap and returning nothing at all.
// The tradeoff: scoped to one section, the AI sometimes drifts on the `project`
// name (an abbreviated tab title instead of the catalogue's full name, or even a
// per-block name for a section with internal sub-groups like "Block A"/"Block B").
// buildCanonicalMatcher() resolves every returned name back to one canonical project
// name so grouping — and the feedKey slug it drives — stays stable across re-syncs.
function splitSections(text: string): string[] {
  const idxs: number[] = [];
  const re = /^### .+$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) idxs.push(m.index);
  if (!idxs.length) return [text];
  return idxs.map((start, i) => text.slice(start, i + 1 < idxs.length ? idxs[i + 1] : text.length));
}

async function mapWithConcurrency<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const worker = async () => { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); } };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

export async function extractAvailabilityFromPricelist(text: string, full = false): Promise<ExtractedPricelistProject[]> {
  const client = anthropic();
  if (!client) throw new Error("ANTHROPIC_API_KEY not configured");
  const wholeDoc = text.slice(0, 120000);
  const sections = splitSections(text.slice(0, 400000)).map((s) => s.slice(0, 30000));

  const [catalog, perSection] = await Promise.all([
    callTool(client, PROMPT_CATALOG + wholeDoc, SCHEMA_CATALOG),
    mapWithConcurrency(sections, 4, (body) => callTool(client, PROMPT_UNITS + body, SCHEMA_UNITS)),
  ]);
  const unitItems = perSection.flat();
  if (!unitItems.length) return [];

  // The catalog call sometimes mistakes the summary/overview sheet's own tab for
  // a project in its own right ("All Projects", "Summary", …) — exclude those so
  // they can never become a valid match target (real projects legitimately named
  // e.g. "The Overview Residences" would still need to pass the FULL-string test).
  const GENERIC_NAME_RE = /^(all\s+projects?|summary|overview|price\s*list|catalogue|catalog|index|master\s*(list|sheet))$/i;
  const canonicalNames = Array.from(new Set(catalog.map((c: any) => String(c?.project || "")).filter(Boolean)))
    .filter((n) => !GENERIC_NAME_RE.test(n.trim()));
  const toCanonical = buildCanonicalMatcher(canonicalNames);

  // Group units under their project, preserving first-seen order. When the catalog
  // call succeeded, silently drop any guess that doesn't resolve to a real project —
  // that's how the catalogue/summary sheet itself (its own "### " tab, each row
  // looking like a "unit" named after a project) used to leak in as a bogus project.
  const byProject = new Map<string, ExtractedPricelistProject>();
  for (const u of unitItems) {
    if (!u?.project || !u?.ref) continue;
    const { name: project, matched } = toCanonical(u.project);
    if (canonicalNames.length && !matched) continue;
    const k = key(project);
    if (!byProject.has(k)) byProject.set(k, { project, units: [] });
    byProject.get(k)!.units.push({
      ref: String(u.ref),
      bedrooms: u.bedrooms || undefined,
      bathrooms: u.bathrooms || undefined,
      areaBuilt: u.areaBuilt || undefined,
      areaGroundFloor: u.areaGroundFloor || undefined,
      areaUpperFloor: u.areaUpperFloor || undefined,
      areaPlot: u.areaPlot || undefined,
      areaVeranda: u.areaVeranda || undefined,
      areaVerandaOpen: u.areaVerandaOpen || undefined,
      parking: u.parking || undefined,
      storage: u.storage || undefined,
      pool: u.pool || undefined,
      extras: u.extras || undefined,
      price: typeof u.price === "number" ? u.price : null,
      status: (u.status === "sold" || u.status === "reserved") ? u.status : "available",
    });
  }

  if (full) {
    const [meta, amen] = await Promise.all([
      callTool(client, PROMPT_META + wholeDoc, SCHEMA_META),
      callTool(client, PROMPT_AMEN + wholeDoc, SCHEMA_AMEN),
    ]);
    const metaMap = new Map<string, any>(meta.map((m: any) => [key(toCanonical(m.project).name), m]));
    const amenMap = new Map<string, any>(amen.map((a: any) => [key(toCanonical(a.project).name), a]));
    // Optional string fields aren't in the schema's `required` list, but a model can
    // still choose to fill an unfindable one with a literal placeholder ("<UNKNOWN>",
    // "N/A", "None") instead of just omitting it — that placeholder is truthy and was
    // overwriting genuinely correct previously-stored values (e.g. area "Anavargos" →
    // "<UNKNOWN>"). Treat those tokens as no-value, same as an empty string.
    const clean = (v?: string) => {
      const t = (v ?? "").trim().replace(/^<|>$/g, "");
      return t && !/^(unknown|n\/?a|none|null|tbd|tba|-)$/i.test(t) ? v : undefined;
    };
    Array.from(byProject.entries()).forEach(([k, p]) => {
      const m = metaMap.get(k);
      if (m) { p.location = clean(m.location); p.mapsUrl = clean(m.mapsUrl); p.propertyType = clean(m.propertyType); p.completion = clean(m.completion); }
      const a = amenMap.get(k);
      if (a) {
        const list = Array.isArray(a.amenities) ? a.amenities.filter(Boolean) : [];
        if (list.length) p.amenities = list;
        if (clean(a.notes)) p.notes = String(a.notes);
      }
    });
  }

  // Unconditional final safety net — don't rely on the catalog call having
  // succeeded this run (when it comes back empty, the per-project drop-unmatched
  // guard above has nothing to check against and lets everything through).
  return Array.from(byProject.values()).filter((p) => !GENERIC_NAME_RE.test(p.project.trim()));
}
