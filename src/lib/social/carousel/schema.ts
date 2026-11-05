// Input schemas for render_instagram_carousel (2026-11-05). Strict on purpose:
// an unknown key is rejected rather than ignored, so a caller can never slip a
// logo, a phone number or a footer into the slides — everything static lives
// in the approved templates (assets/social-templates/), never in the input.
// Pure and client-safe: zod only.
import { z } from "zod";

// Plain text only. "\n" is allowed where a line break is meaningful (headlines,
// the cover title) and becomes <br>; every other control character is refused.
const CTRL = /[\u0000-\u0009\u000b-\u001f\u007f]/;
const text = (max: number) => z.string().trim().min(1).max(max).refine((s) => !CTRL.test(s) && !s.includes("\n"), "single line of plain text");
const multiline = (max: number) => z.string().trim().min(1).max(max).refine((s) => !CTRL.test(s), "plain text");
const image = z.string().trim().min(1).max(500).describe("https://cyprusvipestates.com/uploads/… — e.g. a crm_get_project gallery URL");

const countOccurrences = (hay: string, needle: string) => (needle ? hay.split(needle).length - 1 : 0);

/** Headline with exactly one marked phrase (rule 4: one marking per slide). */
const marked = {
  headline: multiline(140).describe('Use "\\n" for a line break, as in the approved designs.'),
  markedWords: text(48).describe("The phrase inside the headline that gets the marking; must occur exactly once."),
};

const Tile = z.object({ image, caption: text(24) }).strict();
const Facility = z.object({ facilityImage: image, caption: text(24) }).strict();
const Layout = z.object({ layout: text(24), size: text(24) }).strict();
const Row = z.object({ label: text(24), value: text(32) }).strict();

export const ProjectData = z
  .object({
    name: z.tuple([text(32), text(32)]).describe("Two lines; the second is set in gold."),
    location: text(60),
    heroImage: image,
    // slide2/slide3.image: the large photo at the top of those slides in the approved
    // design (not in the original field list; added 2026-11-05 so it is never guessed).
    slide2: z.object({ image, eyebrow: text(40), ...marked, body: text(160), tiles: z.tuple([Tile, Tile, Tile]) }).strict(),
    slide3: z.object({ image, eyebrow: text(40), ...marked, layouts: z.tuple([Layout, Layout, Layout]) }).strict(),
    slide4: z.object({ eyebrow: text(40), ...marked, image, facilities: z.tuple([Facility, Facility, Facility]) }).strict(),
    slide5: z
      .object({
        image,
        priceFrom: z.number().int().positive().max(1_000_000_000),
        vatNote: z.enum(["plus", "included"]).nullable(),
        rows: z.array(Row).max(3),
      })
      .strict(),
  })
  .strict();

const CyprusSlide = z
  .object({ image, eyebrow: text(40), ...marked, checks: z.tuple([text(60), text(60), text(60)]), source: text(80).optional() })
  .strict();

export const CyprusData = z
  .object({
    cover: z.object({ image, chip: text(24), title: multiline(90), accentWord: text(30), subtitle: text(90) }).strict(),
    slides: z.tuple([CyprusSlide, CyprusSlide, CyprusSlide, CyprusSlide]).describe("Slides 2–5."),
  })
  .strict();

export type ProjectData = z.infer<typeof ProjectData>;
export type CyprusData = z.infer<typeof CyprusData>;
export type Lang = "en" | "de";

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "kebab-case slug").max(80);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "not a real date");

export const RenderInput = z
  .object({
    template: z.enum(["project", "cyprus"]),
    lang: z.enum(["en", "de"]),
    slug: slug.describe('template "project": the slug of a published development; template "cyprus": a free kebab-case name such as "warum-zypern".'),
    postingDate: isoDate.optional().describe("Planned posting date; the folder uses its ISO week (Europe/Nicosia). Defaults to today."),
    data: z.union([ProjectData, CyprusData]),
  })
  .strict()
  .superRefine((v, ctx) => {
    const parsed = (v.template === "project" ? ProjectData : CyprusData).safeParse(v.data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) ctx.addIssue({ code: "custom", path: ["data", ...issue.path.map(String)], message: issue.message });
      return;
    }
    for (const p of markedProblems(v.template, parsed.data as ProjectData | CyprusData)) ctx.addIssue({ code: "custom", path: ["data", ...p.path], message: p.message });
  });

export type RenderInput =
  | { template: "project"; lang: Lang; slug: string; postingDate?: string; data: ProjectData }
  | { template: "cyprus"; lang: Lang; slug: string; postingDate?: string; data: CyprusData };

/** Marked phrase / accent word must sit inside its headline exactly once and on one line. */
export function markedProblems(template: "project" | "cyprus", data: ProjectData | CyprusData): { path: string[]; message: string }[] {
  const out: { path: string[]; message: string }[] = [];
  const check = (path: string[], label: string, hay: string, needle: string, field: string) => {
    const n = countOccurrences(hay, needle);
    if (n !== 1) out.push({ path: [...path, field], message: `${label}: "${needle}" must occur exactly once in the text (found ${n}×).` });
  };
  if (template === "project") {
    const d = data as ProjectData;
    (["slide2", "slide3", "slide4"] as const).forEach((k) => check([k], k, d[k].headline, d[k].markedWords, "markedWords"));
  } else {
    const d = data as CyprusData;
    check(["cover"], "cover", d.cover.title, d.cover.accentWord, "accentWord");
    d.slides.forEach((s, i) => check(["slides", String(i)], `slide ${i + 2}`, s.headline, s.markedWords, "markedWords"));
  }
  return out;
}
