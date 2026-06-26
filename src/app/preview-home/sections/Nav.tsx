import { getHeaderByLang } from "@/sanity/sanity.utils";
import { urlFor } from "@/sanity/sanity.client";
import ScrollFlag from "./ScrollFlag";
import LangSwitch from "./LangSwitch";
import MobileMenu from "./MobileMenu";
import { ChevronDown, MOBILE_LOGO } from "./navShared";

/* Mobile-first top navigation for the preview. Transparent at the top; frosted on
   scroll. Real logo + menu from the content DB. Desktop: inline links with
   hover dropdowns + glass language switcher. Mobile: short logo + burger overlay. */

const Nav = async () => {
  const data = await getHeaderByLang("en");
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
        <a className="nav__logo" href="/preview-home" aria-label="Cyprus VIP Estates — home">
          {logo && <img className="nav__logo-full" src={logo} alt="Cyprus VIP Estates" />}
          <img className="nav__logo-mark" src={MOBILE_LOGO} alt="Cyprus VIP Estates" />
        </a>

        <nav className="nav__links" aria-label="Primary">
          {data.navLinks?.map((l) => {
            const hasSub = (l.subLinks?.length ?? 0) > 0;
            return (
              <div className="nav__item" key={l._key}>
                <a className="nav__link" href={l.link || "#"} aria-haspopup={hasSub || undefined}>
                  {l.label}
                  {hasSub && <ChevronDown className="nav__caret" />}
                </a>
                {hasSub && (
                  <div className="nav__dropdown">
                    {l.subLinks.map((s) => (
                      <a key={s._key} href={s.link || "#"}>{s.label}</a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="nav__right">
          <LangSwitch />
          <MobileMenu navLinks={data.navLinks} />
        </div>
      </div>
    </header>
  );
};

export default Nav;
