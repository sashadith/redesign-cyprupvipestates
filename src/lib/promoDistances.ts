/* The project page shows the same eight distances twice: once as the
   DistancesStrip computed from the project's coordinates, and again a thousand
   pixels further down as a table inside the admin-authored promo text, which
   the content initiative wrote by hand from those very figures. Measured on
   /projects/cap-st-georges-resort: identical values, category for category.

   Rather than edit 587 stored tables across 150 projects and four languages,
   the duplicate is dropped at render. Nothing leaves the database, so this is
   reversible by deleting one call.

   SEO note (checked before building, 2026-10-03): every proper noun inside the
   removed text — "Kafizis Beach", "Paphos International Airport", all eight
   categories — still occurs elsewhere on the same page, and the section's own
   H2 is untouched, so no term and no heading is lost. The page does get
   shorter: 2,894 -> 2,600 characters excluding spaces on that project, which
   takes it further below the initiative's own 3,000-character floor. */

const DISTANCE_HEADING = /distan|entfernung|odleg|расстоя|\btime\b|zeit|czas|врем|\bmin|\bkm\b|км/i;
const DISTANCE_VALUE = /^[~≈<>\s]*\d+(?:[.,]\d+)?\s*(?:km|км|min\b|minute|minuten|minut|мин)/i;

/** A two-column table of places and how far away they are.
 *
 *  Two signals, because the content uses both shapes: the unit sits in the
 *  value ("1 km", "3 minutes") on most tables, but in the column heading
 *  ("Distance (km)", "Approx. time (minutes)") on a few, whose cells are then
 *  bare numbers. An earlier version tested only for minutes and would have
 *  left every kilometre table in place — the larger half of them.
 *
 *  Deliberately NOT matched: a bare "m", which would make this fire on floor
 *  areas ("35 m²"). Size, specification and layout tables all pass through. */
export function isDistanceTable(block: unknown): boolean {
  const b = block as { _type?: string; columns?: unknown; rows?: unknown };
  if (b?._type !== "tableBlock") return false;
  const columns = Array.isArray(b.columns) ? b.columns : [];
  const rows = Array.isArray(b.rows) ? b.rows : [];
  if (columns.length !== 2 || rows.length < 3) return false;
  if (DISTANCE_HEADING.test(String(columns[1] ?? ""))) return true;
  const hits = rows.filter((r) => {
    const cells = (r as { cells?: unknown })?.cells;
    return DISTANCE_VALUE.test(String((Array.isArray(cells) ? cells[1] : "") ?? "").trim());
  }).length;
  return hits >= Math.ceil(rows.length / 2);
}

const ENDS_WITH_COLON = /[:：]\s*$/;

/* A heading that announces nothing but where the place is. Checked against the
   real content before being trusted: of the 149 English distance tables, 55 sit
   under one of these and 94 do not — and the ones that do not are headings like
   "Two Duplex Penthouses With Roof Terraces" or "A Boutique Building of Nine
   Apartments", sections about the homes that merely happen to carry a distance
   table. Dropping those outright would have deleted up to 966 characters of
   unique copy per project. */
const LOCATION_HEADING =
  /^(?:location|lage|lokalizacja|расположение|standort)\b|distan|entfernung|odleg|расстоя|nearby|getting around|umgebung|okolica|поблизости|how far|wie weit|jak daleko|как далеко|how close|wie nah|jak blisko|насколько близко|how central/i;

/* …and even then only when there is barely any prose around the table. 250
   characters is roughly two sentences: enough for "the resort sits on Kafizis
   Beach" and a closing line, not enough to be carrying an argument. Above it
   the section keeps its heading and text and loses only the table. */
const STUB_PROSE_LIMIT = 250;

const blockText = (node: unknown): string => {
  const children = (node as { children?: unknown })?.children;
  if (!Array.isArray(children)) return "";
  return children.map((c) => String((c as { text?: unknown })?.text ?? "")).join("").trim();
};

/** Drops every distance table, plus the sentence that introduced it.
 *
 *  That sentence is the last paragraph of the preceding textContent block and
 *  always ends in a colon ("...both within easy reach:"), which is what makes
 *  it safe to identify: a paragraph ending that way is announcing something,
 *  and the thing it announced is gone. Any other trailing paragraph stays. */
const isPlainParagraph = (node: unknown): boolean => {
  const n = node as { _type?: string; style?: string; listItem?: unknown };
  return n?._type === "block" && (n.style ?? "normal") === "normal" && !n.listItem;
};

export function stripDuplicatedDistances<T>(blocks: T[] | null | undefined): T[] {
  if (!Array.isArray(blocks)) return [];
  const out: T[] = [];
  /* Set when a whole section is dropped: the paragraphs that trailed the table
     live at the START of the NEXT textContent block, which has not been visited
     yet. */
  let dropLeadingNodes = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i] as { _type?: string; content?: unknown[] };

    if (dropLeadingNodes > 0) {
      const pending = dropLeadingNodes;
      dropLeadingNodes = 0;
      if (block?._type === "textContent" && Array.isArray(block.content)) {
        const rest = block.content.slice(pending);
        if (rest.length > 0) out.push({ ...block, content: rest } as T);
        continue;
      }
    }

    if (!isDistanceTable(blocks[i])) {
      out.push(blocks[i]);
      continue;
    }

    const prev = out[out.length - 1] as { _type?: string; content?: unknown[] } | undefined;
    const next = blocks[i + 1] as { _type?: string; content?: unknown[] } | undefined;

    // The section this table sits in: back to the last h2, forward to the next.
    let headingIndex = -1;
    const proseBefore: string[] = [];
    if (prev?._type === "textContent" && Array.isArray(prev.content)) {
      const nodes = prev.content;
      let k = nodes.length - 1;
      while (k >= 0 && (nodes[k] as { style?: string })?.style !== "h2") {
        if (isPlainParagraph(nodes[k])) proseBefore.unshift(blockText(nodes[k]));
        k--;
      }
      headingIndex = k;
    }
    const heading = headingIndex >= 0 ? blockText(prev!.content![headingIndex]) : null;

    let leadingNodesAfter = 0;
    const proseAfter: string[] = [];
    if (next?._type === "textContent" && Array.isArray(next.content)) {
      for (const node of next.content) {
        if ((node as { style?: string })?.style === "h2") break;
        if (isPlainParagraph(node)) proseAfter.push(blockText(node));
        leadingNodesAfter++;
      }
    }

    const proseLength = [...proseBefore, ...proseAfter].join(" ").replace(/\s/g, "").length;
    const isLocationStub =
      heading !== null && LOCATION_HEADING.test(heading) && proseLength <= STUB_PROSE_LIMIT;

    if (isLocationStub) {
      // Heading, its paragraphs, the table and whatever trailed it: the whole
      // section said only where the place is, which the DistancesStrip and the
      // neighbourhood block above already say.
      const kept = prev!.content!.slice(0, headingIndex);
      if (kept.length === 0) out.pop();
      else out[out.length - 1] = { ...prev, content: kept } as T;
      dropLeadingNodes = leadingNodesAfter;
      continue;
    }

    // Otherwise the section is about something else and keeps its copy. Only the
    // table goes — and with it the sentence that introduced it, recognised by
    // its trailing colon: it announced something that is no longer there.
    if (prev?._type === "textContent" && Array.isArray(prev.content) && prev.content.length > 0) {
      const nodes = prev.content;
      const last = nodes[nodes.length - 1];
      if (isPlainParagraph(last) && ENDS_WITH_COLON.test(blockText(last))) {
        const trimmed = nodes.slice(0, -1);
        // A textContent holding nothing but the lead-in would otherwise render
        // as an empty <div class="iart__rich">.
        if (trimmed.length === 0) out.pop();
        else out[out.length - 1] = { ...prev, content: trimmed } as T;
      }
    }
  }

  return out;
}
