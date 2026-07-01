"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { i18n } from "@/i18n.config";
import type { Translation } from "@/types/homepage";
import { Globe, ChevronDown, LANG_LABELS, langCode } from "./navShared";

/* Glass language switcher for the desktop nav (redesign look), wired to the REAL
   multilingual routing: the current language shows as active; the other languages
   that actually have a translation for this page link to their localized URL.
   Hover/focus reveals the panel (CSS). Hidden < 1024px (language lives in the
   burger menu on mobile). */
export default function HeaderLangSwitch({ translations }: { translations?: Translation[] }) {
  const params = useParams();
  const currentLang = (params?.lang as string) ?? "en";
  const byLang = new Map((translations ?? []).map((t) => [t.language, t.path]));

  return (
    <div className="lang">
      <button className="lang__btn" type="button" aria-haspopup="true" aria-label="Select language">
        <Globe />
        <span className="lang__cur">{langCode(currentLang)}</span>
        <ChevronDown />
      </button>
      <div className="lang__menu" role="menu">
        {i18n.languages.map((l) => {
          const label = LANG_LABELS[l.id]?.name ?? l.id;
          if (l.id === currentLang) {
            return (
              <a key={l.id} role="menuitem" aria-current="page" className="is-active">
                <span className="lang__name">{label}</span>
              </a>
            );
          }
          const path = byLang.get(l.id);
          if (!path) return null; // no translation for this page → don't offer it
          return (
            <Link key={l.id} href={path} locale={l.id} role="menuitem">
              <span className="lang__name">{label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
