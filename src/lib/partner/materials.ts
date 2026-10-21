// Materials page (partner portal phase 3d). Pure: project-page links on the main site.
// Absolute main-site URLs — the partner host serves only the portal.
import { isLocale } from "@/lib/locale";
import { publicProjectUrl } from "./clientDto";

export const BROCHURE_CAP = 300;
// Main-site project pages exist in every site locale; the partner portal never links to he, anything else → en.
export function brochureLang(locale: string): string {
  return isLocale(locale) && locale !== "he" ? locale : "en";
}

export type BrochureLinks = { page: string };

/** Main-site project page (en without prefix) for a slug; null without a slug. */
export function brochureLinks(locale: string, slug: string | null | undefined): BrochureLinks | null {
  const s = slug?.trim();
  if (!s) return null;
  const page = publicProjectUrl(brochureLang(locale), s);
  return page ? { page } : null;
}

export type BrochureRow = { id: string; name: string; town: string | null } & BrochureLinks;

/** Projects with a slug → brochure rows, in the given (name) order, capped. */
export function brochureRows(
  locale: string,
  projects: { id: string; name: string; town: string | null; slug: string | null }[],
  cap = BROCHURE_CAP,
): BrochureRow[] {
  const out: BrochureRow[] = [];
  for (const p of projects) {
    if (out.length >= cap) break;
    const links = brochureLinks(locale, p.slug);
    if (links) out.push({ id: p.id, name: p.name, town: p.town, ...links });
  }
  return out;
}
