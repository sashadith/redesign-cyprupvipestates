/* Which file in a DOMO project folder is a photo, a floor plan, or neither
 * (2026-11-13). Pure — no SharePoint, no Prisma — so the rules that decide what
 * ends up on a project page can be tested without the network.
 *
 * Measured against all 16 folders of the Agents Library share before this was
 * written; every rule below exists because of something actually in there:
 *
 *  - Photos live under "Renders/", in up to three subfolders: Exteriors,
 *    Interiors and Common Areas. Nothing else in the share is a project photo.
 *  - Floor plans are PDFs, and they are named three different ways: a file
 *    ("Hampton Floor plans.pdf", "Mantua - Floor Plan.pdf"), a folder of
 *    per-storey files ("Domo Properties - EVORA - Layouts/EVORA_01_1ST FLOOR.pdf")
 *    or a dated folder ("Siena floor plans 2026/Siena Floor Plans_Jul 2026.pdf").
 *  - "Unbranded_<project>_brochure with prices_<date>.pdf" is in every folder and
 *    is NEVER a plan: it is a sales brochure whose price pages are two months
 *    older than the master price list. It is read for copy, not for figures.
 *  - "<project> Overview.docx" is marketing copy for the same purpose.
 *
 * The renaming trap: five projects were renamed and their FILES still carry the
 * old studio names — Messina's files say Alveo, Milford Heights says Seya,
 * Navarre says Vireo, Padua says Orien, Mantua says Caeli. Nothing here may
 * derive a project's identity from a file name for that reason; identity comes
 * from the folder, which is the name DOMO sells under.
 */

export type DomoFile = {
  /** Path inside the project folder, e.g. "/Renders/Exteriors/Siena_1.png". */
  path: string;
  name: string;
  mimeType: string;
  size: number;
};

export type DomoKind = "photo" | "plan" | "brochure" | "overview" | "skip";

const IMAGE_RE = /\.(jpe?g|png|webp)$/i;
const PDF_RE = /\.pdf$/i;
const JUNK_RE = /^(thumbs\.db|\.ds_store|\._.*|desktop\.ini)$/i;

/** "Renders" and anything under it. */
const RENDERS_RE = /(^|\/)renders?(\/|$)/i;
/** A floor-plan file or the folder holding a set of them. */
const PLAN_RE = /(floor\s*plans?|^.*-\s*floor\s*plan|layouts?)/i;
/** The sales brochure that sits at the root of every project folder. */
const BROCHURE_RE = /^unbranded[_\s].*brochure/i;
const OVERVIEW_RE = /overview\.docx?$/i;

export function classify(f: DomoFile): DomoKind {
  const name = (f.name || "").trim();
  if (!name || JUNK_RE.test(name)) return "skip";
  if (BROCHURE_RE.test(name)) return "brochure";
  if (OVERVIEW_RE.test(name)) return "overview";
  if (PDF_RE.test(name) && (PLAN_RE.test(name) || PLAN_RE.test(f.path))) return "plan";
  // An image inside a plans folder is a plan, not a photo.
  if (IMAGE_RE.test(name) && PLAN_RE.test(f.path) && !RENDERS_RE.test(f.path)) return "plan";
  if (IMAGE_RE.test(name) && RENDERS_RE.test(f.path)) return "photo";
  return "skip";
}

/* Card image first. The listing grid shows photo[0] and nothing else, so the
 * order here IS the thumbnail choice: an exterior render sells the building, an
 * en-suite bathroom does not. Common areas come next (pool, lobby), interiors
 * last. Within a group the developer's own numbering is kept — their files are
 * prefixed "01. ", "02. " in exactly the order they present them. */
const GROUP = (p: string): number =>
  /exterior/i.test(p) ? 0 : /common/i.test(p) ? 1 : /interior/i.test(p) ? 2 : 3;

export function orderPhotos(files: DomoFile[]): DomoFile[] {
  return files
    .map((f, i) => ({ f, i }))
    .sort((a, b) => GROUP(a.f.path) - GROUP(b.f.path) || a.f.path.localeCompare(b.f.path) || a.i - b.i)
    .map((x) => x.f);
}

export type DomoFolderMedia = {
  photos: DomoFile[];
  plans: DomoFile[];
  brochures: DomoFile[];
  overviews: DomoFile[];
};

export function splitFolder(files: DomoFile[]): DomoFolderMedia {
  const out: DomoFolderMedia = { photos: [], plans: [], brochures: [], overviews: [] };
  for (const f of files) {
    switch (classify(f)) {
      case "photo": out.photos.push(f); break;
      case "plan": out.plans.push(f); break;
      case "brochure": out.brochures.push(f); break;
      case "overview": out.overviews.push(f); break;
    }
  }
  out.photos = orderPhotos(out.photos);
  return out;
}

/* Two projects share one set of renders, and it is not a near-match: Messina and
 * Padua carry the same five interior files, byte for byte (verified by MD5 on
 * 2026-11-13 — "01. LIVING AREA.png", "02. VERANDA.png", two master bedrooms and
 * an en-suite). Mirroring both would put the identical five photos on two
 * lead-generating pages.
 *
 * The sync therefore hashes every image it mirrors and asks this first. The
 * FIRST project to claim a file keeps it; a later one is told to skip, which is
 * why the sync walks folders in a stable order — otherwise which project gets
 * the interiors would change from run to run.
 */
export function claimPhoto(seen: Map<string, string>, hash: string, projectSlug: string): { take: boolean; ownedBy: string } {
  const owner = seen.get(hash);
  if (owner && owner !== projectSlug) return { take: false, ownedBy: owner };
  if (!owner) seen.set(hash, projectSlug);
  return { take: true, ownedBy: projectSlug };
}
