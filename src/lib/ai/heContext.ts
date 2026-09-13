import { readFileSync } from "node:fs";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";

/* Server-only. Loads the Hebrew style guide + glossary once at module load and
   exposes them as a cacheable system block for the AI generators
   (projectDescription.ts, areaContent.ts, seoMeta.ts).

   These two files are ~7k tokens combined and byte-stable across calls — the
   opposite of the <1k-token, per-call-interpolated blocks the "prompt caching
   evaluated: skipped" comments in those three files ruled OUT for their own
   system/prompt text. This block is big enough (well over Sonnet's 1024-token
   cache-eligibility floor) and stable enough (same file bytes on every call, no
   per-project interpolation) to actually earn cache_control. */

const read = (f: string) => readFileSync(path.join(process.cwd(), "docs", "i18n", f), "utf8");

const STYLEGUIDE = read("he-styleguide.md");
const GLOSSARY = read("he-glossary.md");

export const HE_STYLE_CONTEXT = `# Hebrew (he) writing rules — binding\n\n${STYLEGUIDE}\n\n${GLOSSARY}`;

export type HeContextKind = "description" | "area" | "seo";

/**
 * Pure helper: splits `md` on "\n## " headings and keeps the sections whose
 * heading starts with one of `wantedPrefixes` (e.g. "3" matches a heading like
 * "3. Satzbau und Länge"). Falls back to the FULL, unsliced text when none of
 * the prefixes match a heading — e.g. if the docs get renumbered, callers still
 * get the complete style context rather than an empty or wrong system block.
 */
export function sliceSections(md: string, wantedPrefixes: string[]): string {
  const parts = md.split("\n## ");
  // parts[0] is whatever comes before the first "## " heading (title, front
  // matter); real sections start at parts[1].
  const sections = parts.slice(1).map((p) => `## ${p}`);
  const matched = sections.filter((section) => {
    const heading = section.slice(3); // strip the leading "## "
    return wantedPrefixes.some((prefix) => heading.startsWith(`${prefix}.`) || heading.startsWith(`${prefix} `));
  });
  return matched.length ? matched.join("\n\n") : md;
}

// Section numbers selected per generator kind (see task-4-brief.md). Property
// and area descriptions need the writing-register rules — tone, gender,
// sentence shape, spelling, numbers, banned AI patterns, factual truths.
// SEO meta needs the rules that actually bear on a 60/155-character field —
// spelling, numbers, the SEO-specific section, banned patterns — and can skip
// the tone/register material (§1-3) that doesn't change a title or description.
const STYLEGUIDE_SECTIONS: Record<HeContextKind, string[]> = {
  description: ["1", "2", "3", "4", "5", "7", "8"],
  area: ["1", "2", "3", "4", "5", "7", "8"],
  seo: ["4", "5", "6", "7"],
};

const GLOSSARY_SECTIONS: Record<HeContextKind, string[]> = {
  description: ["1", "2", "3", "5"],
  area: ["1", "2", "3", "5"],
  seo: ["2", "4", "5"],
};

/**
 * Trimmed Hebrew style/glossary context for one generator kind. Falls back to
 * the full HE_STYLE_CONTEXT if a wanted heading isn't found (see sliceSections).
 */
export function heContext(kind: HeContextKind): string {
  const style = sliceSections(STYLEGUIDE, STYLEGUIDE_SECTIONS[kind]);
  const glossary = sliceSections(GLOSSARY, GLOSSARY_SECTIONS[kind]);
  return `# Hebrew (he) writing rules — binding\n\n${style}\n\n${glossary}`;
}

/** Cacheable system block for `client.messages.create({ system: [...] })`. */
export function heSystemBlock(kind: HeContextKind): Anthropic.TextBlockParam {
  return { type: "text", text: heContext(kind), cache_control: { type: "ephemeral" } };
}
