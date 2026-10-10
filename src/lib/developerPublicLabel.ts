import { prisma } from "@/lib/prisma";

/**
 * The PUBLIC brand name for a developer account.
 *
 * Three different "developer name" fields exist and only one of them is public:
 *
 *   DeveloperAccount.name     ADMIN ONLY. 15 of the 25 accounts deliberately end
 *                             in a parenthetical naming the integration method —
 *                             "BBF (API)", "Aristo (XML)", "AGG (CC)",
 *                             "Korantina Homes (SharePoint)", "Kuutio (drive)".
 *                             It exists so an operator can tell two pipelines
 *                             apart. Never render it, never copy it anywhere
 *                             public.
 *   Development.developer     PUBLIC. Printed as the developer on
 *                             /projects/<slug> and emitted as the JSON-LD
 *                             offers.seller.name.
 *   Development.developerName The feed's own project string. Legitimately
 *                             contains parentheses ("Georgia 12 (A&B)"), so it
 *                             must never be run through a paren strip.
 *
 * Six folder-based adapters and the admin's manual-create copied the admin
 * label straight into the public column, which put "Korantina Homes
 * (SharePoint)" on 34 live project pages — in the visible copy and in the
 * structured data. The rows were corrected on 2026-10-09; this exists so the
 * next created project does not reintroduce them.
 *
 * SOURCE OF TRUTH is the linked public developer page's title, reached via
 * DeveloperAccount.developerTranslationGroupId — a link a human reviewed. It is
 * NOT the account name minus its marker, and that is not a corner case:
 * measured across all 25 accounts on 2026-10-10, the two disagree for 9 of them.
 * "AGG (CC)" is publicly AGG Luxury Homes, "Kuutio (drive)" is Kuutio Homes,
 * "G&V (drive)" is G&V Hadjidemosthenous, "Mito (XML)" is Mito Developers.
 * Stripping the marker would have been confidently wrong for a third of the
 * catalogue.
 */

// Only markers we have actually seen are stripped. A parenthetical this list
// does not know is LEFT ALONE and reported by the caller rather than guessed
// at: an unrecognised one is as likely to be part of a real brand name as it is
// to be a pipeline tag, and a wrong public name is worse than an ugly one.
const KNOWN_MARKERS = ["api", "xml", "cc", "sharepoint", "drive", "dropbox", "manual"];
const TRAILING_PAREN = /\s*\(([^)]*)\)\s*$/;

/** The fallback: strip a KNOWN marker, or return the name untouched. */
export function stripKnownMarker(accountName: string): string {
  const m = accountName.match(TRAILING_PAREN);
  if (!m) return accountName;
  return KNOWN_MARKERS.indexOf(m[1].trim().toLowerCase()) === -1
    ? accountName
    : accountName.replace(TRAILING_PAREN, "").trim();
}

/** True when the name ends in a parenthetical this module cannot classify. */
export function hasUnknownMarker(accountName: string): boolean {
  const m = accountName.match(TRAILING_PAREN);
  return !!m && KNOWN_MARKERS.indexOf(m[1].trim().toLowerCase()) === -1;
}

// One lookup per account per process. These adapters create many projects in a
// single run and the answer cannot change mid-run; without this the label would
// be re-queried once per project.
const cache = new Map<string, string>();

/**
 * Resolve the public label for an account id. Prefers the linked page title,
 * falls back to the marker strip, and never returns an empty string.
 *
 * `fallbackName` is the account name the caller already holds, so a missing
 * link degrades to something sensible instead of throwing. Pass it whenever you
 * have it.
 */
export async function publicDeveloperLabel(accountId: string, fallbackName?: string): Promise<string> {
  const cached = cache.get(accountId);
  if (cached) return cached;

  const acct = await prisma.developerAccount.findUnique({
    where: { id: accountId },
    select: { name: true, developerTranslationGroupId: true },
  });
  const name = acct?.name ?? fallbackName ?? "";

  let label = "";
  if (acct?.developerTranslationGroupId) {
    // EN is the canonical row: it is the language the admin writes first and
    // the only one guaranteed to exist for every linked page.
    const page = await prisma.developer.findFirst({
      where: { translationGroupId: acct.developerTranslationGroupId, language: "en" },
      select: { title: true },
    });
    label = (page?.title ?? "").trim();
  }
  if (!label) label = stripKnownMarker(name).trim();
  if (!label) label = name;

  if (label) cache.set(accountId, label);
  return label;
}

/** Testing/maintenance only — the cache is per process and never invalidated. */
export function clearPublicDeveloperLabelCache(): void {
  cache.clear();
}
