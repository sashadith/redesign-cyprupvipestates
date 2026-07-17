import { i18n } from "@/i18n.config";
import type { Translation } from "@/types/homepage";
import { Globe, ChevronDown, LANG_LABELS, langCode } from "@/app/components/Header/navShared";

/* Glass language switcher for the desktop nav. Hover/focus reveals the panel;
   a transparent bridge keeps it open while moving to the items. Text-only
   options. Hidden on mobile (language lives in the burger menu).

   Without a `translations` prop this renders as English-only, unchanged for
   every pre-existing caller (preview-home, preview-insights, preview-faq).
   Pages that pass `translations` (an array of { language, path } — the
   locales that actually have a translated version of THIS page) get a real,
   working switcher: the current language is marked active/non-clickable,
   every other language links to its translated URL, and any language with
   no translation for this specific page is simply omitted rather than
   shown as a dead link. Same shape/behavior as HeaderLangSwitch, the
   already-working switcher used by the live site's main nav. */
const LangSwitch = ({ lang = "en", translations }: { lang?: string; translations?: Translation[] }) => {
  // No `translations` prop at all (vs. an empty array) means the caller hasn't
  // opted into real switching — keep rendering every language as a stub entry,
  // the pre-existing look for preview-home/preview-insights/preview-faq.
  const hasRealSwitching = translations !== undefined;
  const byLang = new Map((translations ?? []).map((t) => [t.language, t.path]));

  return (
    <div className="lang">
      <button className="lang__btn" type="button" aria-haspopup="true" aria-label="Select language">
        <Globe />
        <span className="lang__cur">{langCode(lang)}</span>
        <ChevronDown />
      </button>
      <div className="lang__menu" role="menu">
        {i18n.languages.map((l) => {
          const name = LANG_LABELS[l.id]?.name ?? l.id;
          if (l.id === lang) {
            return (
              <a key={l.id} role="menuitem" aria-current="page" className="is-active">
                <span className="lang__name">{name}</span>
              </a>
            );
          }
          if (!hasRealSwitching) {
            return (
              <a key={l.id} href="#" role="menuitem">
                <span className="lang__name">{name}</span>
              </a>
            );
          }
          const path = byLang.get(l.id);
          if (!path) return null;
          return (
            <a key={l.id} href={path} role="menuitem">
              <span className="lang__name">{name}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
};

export default LangSwitch;
