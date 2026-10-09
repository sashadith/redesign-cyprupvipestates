/* The public developer label for a development.

   `DeveloperAccount.name` is an ADMIN label. For 15 of the 25 accounts it ends
   in a parenthetical naming the integration method on purpose — "BBF (API)",
   "Island Blue (XML)", "Korantina Homes (SharePoint)", "AGG (CC)", "Kuutio
   (drive)" — which is how the operator tells two routes to the same brand
   apart in the developments list.

   Every adapter used to copy that label straight into
   `Development.developer`, which is the PUBLIC display label: it is printed on
   the project page ("Developer: …") and emitted as the JSON-LD
   `offers.seller.name`. On 2026-10-09 that put "Korantina Homes (SharePoint)"
   on 34 published pages and in their structured data.

   Two layers, in order of preference:

   1. The linked public developer page's own title. `DeveloperAccount
      .developerTranslationGroupId` is a human-reviewed link (never guessed from
      name similarity — see the schema comment), and `Developer.title` is the
      brand exactly as the public site already spells it. That is the real
      source of truth, and it is the layer that fixes the two cases where the
      brand is not just the account name minus its marker: "Kuutio (drive)" is
      "Kuutio Homes" publicly, and "G&V (drive)" is "G&V Hadjidemosthenous".

   2. Failing that — unlinked account, or a link gone stale, which the schema
      comment warns can happen silently — the account name with a RECOGNISED
      integration marker stripped.

   Why a vocabulary and not "strip any trailing parenthetical": a parenthetical
   is a perfectly ordinary part of a real name in this data.
   `Development.developerName` holds "The View (Phase B)" and "Georgia 12
   (A&B)", and a phase or block suffix on an account would be just as
   legitimate. An unrecognised token is therefore left alone on purpose. */

import { prisma } from "@/lib/prisma";

/* The integration methods that appear in an account name. The five actually in
   use today are API, CC, SharePoint, XML and drive; the rest are the remaining
   adapter/source words a new account is likely to be labelled with, so that
   onboarding one does not silently reintroduce this bug. */
const INTEGRATION_MARKERS = new Set([
  "api",
  "cc",
  "csv",
  "drive",
  "dropbox",
  "feed",
  "json",
  "manual",
  "onedrive",
  "portal",
  "scrape",
  "sharepoint",
  "xml",
]);

/** `"Korantina Homes (SharePoint)"` → `"Korantina Homes"`. A name with no
 *  trailing parenthetical, or one whose token is not an integration method, is
 *  returned untouched. */
export function stripIntegrationMarker(name: string): string {
  const m = name.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (!m) return name.trim();
  const [, base, token] = m;
  if (!INTEGRATION_MARKERS.has(token.trim().toLowerCase())) return name.trim();
  // A name that is NOTHING but a marker would strip to "", which would be a
  // worse public label than the marker itself.
  return base.trim() || name.trim();
}

/** The brand to show the public for this account. Pass the account row the
 *  adapter already has in hand; only the linked-page lookup touches the DB. */
export async function publicDeveloperLabel(acct: {
  name: string;
  developerTranslationGroupId?: string | null;
}): Promise<string> {
  const fallback = stripIntegrationMarker(acct.name);
  if (!acct.developerTranslationGroupId) return fallback;
  try {
    /* Any locale will do — the title is the brand and is identical across the
       group — but prefer `en` so the choice is deterministic rather than
       whichever row Postgres hands back first. */
    const rows = await prisma.developer.findMany({
      where: { translationGroupId: acct.developerTranslationGroupId },
      select: { language: true, title: true },
    });
    const title = (rows.find((r) => r.language === "en") ?? rows[0])?.title?.trim();
    return title || fallback;
  } catch {
    /* A sync must never fail over a cosmetic label. */
    return fallback;
  }
}
