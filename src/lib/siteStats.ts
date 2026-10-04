import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getFilteredProjectsCount } from "@/sanity/sanity.utils";

/* One source for the figures the marketing "track record" bands quote, so the
   Partners and About bands can't drift apart or contradict the site itself
   (2026-09-29). Before this they used three different definitions: Partners had
   a hand-maintained 195, About counted `publishStatus != "archived"` — which
   includes drafts, 323 at the time — and the homepage band carried 195 as CMS
   content. Same page, same claim, three numbers.

   Both helpers fall back to the last hand-maintained figure rather than letting
   a database hiccup render a zero, or take the page down. */

/** Exactly what a visitor can page through on /projects in THAT locale.
    Measured 2026-09-29: en 271, de 273, pl 273, ru 272 — the listing is built
    from per-language rows, so a project missing one translation drops out of
    that locale's count. The figures therefore differ slightly between
    languages by design; each one matches its own /projects page. (An earlier
    comment here claimed they were identical, based on the pager's last page
    number — that only resolves to 14 projects, far too coarse to tell.) */
export const getPublicProjectCount = cache(async (lang: string): Promise<number> => {
  try {
    return await getFilteredProjectsCount(lang, {});
  } catch {
    return 195;
  }
});

/** Units that are actually still for sale. Deliberately narrower than the raw
    DevelopmentUnit total (4,636), which also counts sold, reserved and unlisted
    rows plus units belonging to drafts and archived projects. */
export const getAvailableUnitCount = cache(async (): Promise<number> => {
  try {
    return await prisma.developmentUnit.count({
      where: { status: "available", development: { publishStatus: "published" } },
    });
  } catch {
    return 0;
  }
});
