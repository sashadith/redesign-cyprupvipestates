import React from "react";
import { localizedHref, localePrefix } from "@/lib/locale";

/* Shared nav data + lightweight SVG icons (no icon library) + link resolution.
   Used by the desktop nav links, the language switcher, and the mobile menu.
   Language is text-only (no flags). Ported from the redesign preview, adapted
   for the LIVE multilingual site (localized hrefs + real language switching). */

/* i18n language id → { code shown in the pill, native name in the menu } */
export const LANG_LABELS: Record<string, { code: string; name: string }> = {
  en: { code: "EN", name: "English" },
  de: { code: "DE", name: "Deutsch" },
  pl: { code: "PL", name: "Polski" },
  ru: { code: "RU", name: "Русский" },
};

export const langCode = (id: string) => LANG_LABELS[id]?.code ?? id.toUpperCase();

/* Routes with a dark, full-bleed hero where the nav should stay FULLY transparent
   at the top (signature look): the home page and the /projects listing, in every
   language. Every other route falls back to the legible deep-green top bar (see
   header-footer.css). Keep this in sync with the inline pre-paint script in
   [lang]/layout.tsx. */
export function isDarkHeroPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  return /^\/(de|pl|ru)?$/.test(p) || /^(\/(de|pl|ru))?\/projects$/.test(p);
}

export type ResolvedNav = {
  href: string;
  external: boolean;
  /** true when the link is an in-page section anchor (e.g. CMS link "reviews") */
  anchor: boolean;
  /** section id when `anchor` is true */
  id?: string;
};

/* Mirrors the previous live NavLinks logic so behaviour is identical:
   - "https?://…"  → external link (new tab)
   - "/path"       → localized site link ("/de/projects", …)
   - anything else → in-page section anchor ("#reviews" / "/de/#reviews") */
export function resolveNav(lang: string, link: string): ResolvedNav {
  const raw = (link || "").trim();
  if (/^https?:\/\//i.test(raw)) return { href: raw, external: true, anchor: false };
  if (raw.startsWith("/")) return { href: localizedHref(lang, raw), external: false, anchor: false };
  return { href: `${localePrefix(lang)}/#${raw}`, external: false, anchor: true, id: raw };
}

export const Globe = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.2" />
    <path d="M3 12h18M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

export const ChevronDown = ({ className }: { className?: string }) => (
  <svg className={className} width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
    <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
