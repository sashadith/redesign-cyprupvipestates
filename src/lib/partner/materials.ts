// Materials page (partner portal phase 3d). Pure: brochure links on the main site.
// Absolute main-site URLs — /api is not served on the partner host.
import { isLocale } from "@/lib/locale";
import { publicProjectUrl } from "./clientDto";

export const BROCHURE_CAP = 300;
const MAIN_SITE = "https://cyprusvipestates.com";
// The PDF route (src/app/api/projects/[lang]/[slug]/pdf) renders every site locale except he; anything else → en.
export function brochurePdfLang(locale: string): string {
  return isLocale(locale) && locale !== "he" ? locale : "en";
}

export type BrochureLinks = { page: string; pdf: string };

/** Project page (en without prefix) and PDF brochure for a slug; null without a slug. */
export function brochureLinks(locale: string, slug: string | null | undefined): BrochureLinks | null {
  const s = slug?.trim();
  if (!s) return null;
  const lang = brochurePdfLang(locale);
  const page = publicProjectUrl(lang, s);
  if (!page) return null;
  return { page, pdf: `${MAIN_SITE}/api/projects/${lang}/${encodeURIComponent(s)}/pdf` };
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
