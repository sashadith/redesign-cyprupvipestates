// Text block under the /projects results (2026-11-12): the page's H1 plus ~1,700 words of
// reading in two columns, per language. The copy lives in code (one file per language next to
// this one), not in the CMS: it is evergreen, reviewed as a whole, and ships with the page.
//
// Inline links use `[anchor text]{key}`; the key resolves through projectsSeoLinks.ts to the
// final (post-redirect) path of the target page in the same language. An unknown key renders as
// plain text, so a missing link can never break the page.
//
// Hebrew (added 2026-11-12 at the operator's explicit request) is written to docs/i18n/he-styleguide.md
// and he-glossary.md and carries REVIEW(he): it has had an editor pass but no native-speaker review yet.

import { copy as en } from "./projectsSeo.en";
import { copy as de } from "./projectsSeo.de";
import { copy as pl } from "./projectsSeo.pl";
import { copy as ru } from "./projectsSeo.ru";
import { copy as he } from "./projectsSeo.he";

export type SeoBlock = { p: string } | { h3: string } | { ul: string[] };
export type SeoSection = { h2: string; blocks: SeoBlock[] };
export type SeoCopy = { lead: string; sections: SeoSection[] };

const COPY: Record<string, SeoCopy> = { en, de, pl, ru, he };

export function projectsSeoCopy(lang: string): SeoCopy | null {
  return COPY[lang] ?? null;
}
