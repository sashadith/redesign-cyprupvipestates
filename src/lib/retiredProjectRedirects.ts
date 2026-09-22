/* Project slugs that were retired in favour of another project's page.

   Keyed by the retired slug, valued by the surviving one. Locale-preserving:
   a German visitor on the retired slug lands on the German survivor.

   /projects/golf-residences was a Development created BY HAND on 2026-07-12.
   On 2026-08-28 BBF's feed adapter first saw the same building as project 38
   and created a second row, because a Development's identity is its feedKey
   ("manual:<uuid>" vs "bbf:38") and nothing matches on name. Both pages then
   ran live against each other for two and a half weeks — the hand-made one
   with 0 images, no location and units frozen since July; the feed one with
   53 units, images and a daily sync. The operator archived the hand-made one
   on 2026-09-16, which 404s it; this points its 90 impressions and 1 click
   from the prior 90 days at the page that survived.

   Deliberately not a database feature. LegacyProjectRedirect is bound to
   Project by a foreign key and cannot hold a Development, and no
   Development-to-Development redirect exists anywhere. One retired slug does
   not justify a schema. A second one is the moment to re-take that decision
   rather than let this list quietly grow. */
import { nonDefaultLocalePattern } from "@/lib/locale";

export const RETIRED_PROJECT_REDIRECTS: Record<string, string> = {
  "golf-residences": "eden-golf",
};

/* The target path for a retired project URL, or null when the path is not one.
   Only the bare project path matches: a sub-path under a retired slug falls
   through rather than being silently flattened onto the survivor, which would
   send /projects/golf-residences/anything to a page that never had it.

   Kept out of middleware.ts so it can be asserted without constructing a
   NextRequest — the redirect data lives in lib the same way
   nestedPageRedirects.json does. */
export function retiredProjectTarget(pathname: string): string | null {
  // Locale prefix from lib/locale, not a hard-coded (de|pl|ru): with the
  // literal list, /he/projects/<retired> fell through to a 404 while every
  // other locale 308'd (staging, 2026-09-20).
  const m = pathname.match(new RegExp(`^\\/(?:(${nonDefaultLocalePattern()})\\/)?projects\\/([^/]+)$`));
  if (!m) return null;
  const target = RETIRED_PROJECT_REDIRECTS[m[2]];
  if (!target) return null;
  return m[1] ? `/${m[1]}/projects/${target}` : `/projects/${target}`;
}
