import { getHeaderByLang } from "@/sanity/sanity.utils";
import { urlFor } from "@/sanity/sanity.client";
import ScrollFlag from "./ScrollFlag";
import LangSwitch from "./LangSwitch";

/* Restyled top navigation for the preview. Transparent at the top; frosted on
   scroll. Real logo + menu from the content DB; CSS-only hover dropdowns.
   Links are right-aligned; the CTA now lives in the hero. */

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
          {logo && <img src={logo} alt="Cyprus VIP Estates" />}
        </a>

        <nav className="nav__links" aria-label="Primary">
          {data.navLinks?.map((l) => (
            <div className="nav__item" key={l._key}>
              <a className="nav__link" href={l.link || "#"}>{l.label}</a>
              {l.subLinks?.length > 0 && (
                <div className="nav__dropdown">
                  {l.subLinks.map((s) => (
                    <a key={s._key} href={s.link || "#"}>{s.label}</a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <LangSwitch />
      </div>
    </header>
  );
};

export default Nav;
