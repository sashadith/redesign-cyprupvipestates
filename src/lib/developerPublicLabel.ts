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

/** The linked public developer page's own title, or null when the account is
 *  unlinked, the link has gone stale, or the lookup fails. */
export async function publicPageTitle(groupId: string | null | undefined): Promise<string | null> {
  if (!groupId) return null;
  try {
    /* Any locale will do — the title is the brand and is identical across the
       group — but prefer `en` so the choice is deterministic rather than
       whichever row Postgres hands back first. */
    const rows = await prisma.developer.findMany({
      where: { translationGroupId: groupId },
      select: { language: true, title: true },
    });
    return (rows.find((r) => r.language === "en") ?? rows[0])?.title?.trim() || null;
  } catch {
    /* A sync must never fail over a cosmetic label. */
    return null;
  }
}

/** The linked public page's title for an account known only by id — for the
 *  feed path, which has the id but not the row. Null when the account is
 *  unlinked, so a caller can keep whatever it already had. */
export async function publicPageTitleForAccount(accountId: string): Promise<string | null> {
  try {
    const acct = await prisma.developerAccount.findUnique({
      where: { id: accountId }, select: { developerTranslationGroupId: true },
    });
    return await publicPageTitle(acct?.developerTranslationGroupId);
  } catch {
    return null;
  }
}

/** The brand to show the public for this account. Pass the account row the
 *  adapter already has in hand; only the linked-page lookup touches the DB. */
export async function publicDeveloperLabel(acct: {
  name: string;
  developerTranslationGroupId?: string | null;
}): Promise<string> {
  return (await publicPageTitle(acct.developerTranslationGroupId)) ?? stripIntegrationMarker(acct.name);
}

/* ---------------------------------------------------------------------------
   The admin-side guard.

   stripIntegrationMarker only removes a parenthetical it RECOGNISES, which is
   what keeps "The View (Phase B)" intact. The flip side: renaming an account to
   something like "Foo (Bitrix)" produces a marker nothing here knows about, so
   it would be treated as part of the brand and — for an account with no linked
   public page — handed straight to clients again. That is the 2026-10-09 bug
   returning through the one door the write-path fix cannot close.

   So the account forms warn once, rather than silently accepting it. Not a hard
   block: a real brand may genuinely contain a parenthetical, and only the
   operator knows. The message says what clients would actually see, which
   depends on whether a public page is linked. */

/** The trailing parenthetical on an account name, and whether it is one of the
 *  integration markers this module strips. */
export function reviewAccountName(name: string): { marker: string | null; recognised: boolean } {
  const m = String(name).match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (!m || !m[1].trim()) return { marker: null, recognised: false };
  const token = m[2].trim();
  return { marker: token, recognised: INTEGRATION_MARKERS.has(token.toLowerCase()) };
}

/* Listed in the warning so the operator can pick a word that works instead of
   guessing. Display spelling, not the lower-cased set. */
const MARKER_EXAMPLES = "API, CC, CSV, drive, dropbox, feed, JSON, manual, OneDrive, portal, scrape, SharePoint, XML";

/** Warning for a name whose trailing parenthetical is NOT a recognised
 *  integration marker, or null when the name is unambiguous. Pure — the caller
 *  resolves `linkedPageTitle` (via publicPageTitle) because create and edit
 *  read the link from different places. */
export function accountNameWarning(name: string, linkedPageTitle: string | null): string | null {
  const { marker, recognised } = reviewAccountName(name);
  if (!marker || recognised) return null;
  const head = `“(${marker})” is not a recognised integration marker.`;
  const tail = `Recognised markers: ${MARKER_EXAMPLES}. Press Save again to keep this name as it is.`;
  return linkedPageTitle
    ? `${head} New projects would still show “${linkedPageTitle}” publicly, from the linked public developer page — but if that link is ever cleared or goes stale, clients would see “${name.trim()}” instead. ${tail}`
    : `${head} This account has no linked public developer page, so clients would see “${name.trim()}” as the developer on every new project, and in its structured data. Link a public page, use a recognised marker, or keep it. ${tail}`;
}
