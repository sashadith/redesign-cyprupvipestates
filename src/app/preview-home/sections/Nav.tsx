import { getHeaderByLang } from "@/sanity/sanity.utils";
import { urlFor } from "@/sanity/sanity.client";
import { resolveNav } from "@/app/components/Header/navShared";
import type { Translation } from "@/types/homepage";
import ScrollFlag from "./ScrollFlag";
import LangSwitch from "./LangSwitch";
import MobileMenu from "./MobileMenu";
import { ChevronDown, MOBILE_LOGO } from "./navShared";

/* Mobile-first top navigation for the preview. Transparent at the top; frosted on
   scroll. Real logo + menu from the content DB. Desktop: inline links with
   hover dropdowns + glass language switcher. Mobile: short logo + burger overlay.

   lang/translations/homeHref are optional and default to the original English-
   only behavior (lang="en", homeHref="/preview-home") — every existing caller
   (preview-home, preview-insights, preview-faq) is unaffected. Pages that ARE
   real, multi-language routes (preview-case-studies) pass all three: lang for
   the CMS menu content, translations for a working LangSwitch/MobileMenu, and
   homeHref (localizedHref(lang)) so the logo goes to the real localized home,
   not the isolated /preview-home. Link resolution reuses resolveNav from
   components/Header/navShared — the same helper the LIVE site header already
   uses — instead of the raw, unlocalized `l.link || "#"` this used before. */

const Nav = async ({
  lang = "en",
  translations,
  homeHref = "/preview-home",
}: {
  lang?: string;
  translations?: Translation[];
  homeHref?: string;
}) => {
  const data = await getHeaderByLang(lang);
  const logo = (() => {
    try {
      return urlFor(data.logo).url();
    } catch {
      return undefined;
    }
  })();

  return (
    <header className="nav">
      <ScrollFlag />
      <div className="nav__inner wrap">
        <a className="nav__logo" href={homeHref} aria-label="Cyprus VIP Estates — home">
          {logo && <img className="nav__logo-full" src={logo} alt="Cyprus VIP Estates" />}
          <img className="nav__logo-mark" src={MOBILE_LOGO} alt="Cyprus VIP Estates" />
        </a>

        <nav className="nav__links" aria-label="Primary">
          {data.navLinks?.map((l) => {
            const hasSub = (l.subLinks?.length ?? 0) > 0;
            const resolved = resolveNav(lang, l.link);
            return (
              <div className="nav__item" key={l._key}>
                <a
                  className="nav__link"
                  href={resolved.href}
                  aria-haspopup={hasSub || undefined}
                  {...(resolved.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {l.label}
                  {hasSub && <ChevronDown className="nav__caret" />}
                </a>
                {hasSub && (
                  <div className="nav__dropdown">
                    {l.subLinks.map((s) => (
                      <a key={s._key} href={resolveNav(lang, s.link).href}>{s.label}</a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="nav__right">
          <LangSwitch lang={lang} translations={translations} />
          <MobileMenu navLinks={data.navLinks} lang={lang} translations={translations} />
        </div>
      </div>
    </header>
  );
};

export default Nav;
