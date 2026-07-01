import Link from "next/link";
import { getHeaderByLang } from "@/sanity/sanity.utils";
import { urlFor } from "@/sanity/sanity.client";
import { Translation } from "@/types/homepage";
import { localizedHref } from "@/lib/locale";
import ScrollFlag from "./ScrollFlag";
import HeaderNavLinks from "./HeaderNavLinks";
import HeaderLangSwitch from "./HeaderLangSwitch";
import HeaderMobileMenu from "./HeaderMobileMenu";

/* Global site header — quiet-luxury redesign (migrated from the staging preview).
   Transparent at the top of the page, frosted on scroll. Content (logo + menu)
   still comes from the CMS via getHeaderByLang; the language switcher is wired to
   the real multilingual routing through the `translations` prop. Per the approved
   migration there is no "Get Consultation" CTA (matches staging). */

type Props = {
  translations?: Translation[];
  params: { lang: string };
};

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

const Header = async ({ translations, params }: Props) => {
  const data = await getHeaderByLang(params.lang);
  const logo = safeUrl(data.logo);
  const logoMobile = safeUrl(data.logoMobile) ?? logo;

  return (
    <header className="nav">
      <ScrollFlag />
      <div className="nav__inner">
        <Link className="nav__logo" href={localizedHref(params.lang)} aria-label="Cyprus VIP Estates — home">
          {logo && <img className="nav__logo-full" src={logo} alt="Cyprus VIP Estates" />}
          {logoMobile && <img className="nav__logo-mark" src={logoMobile} alt="Cyprus VIP Estates" />}
        </Link>

        <HeaderNavLinks navLinks={data.navLinks} lang={params.lang} />

        <div className="nav__right">
          <HeaderLangSwitch translations={translations} />
          <HeaderMobileMenu navLinks={data.navLinks} lang={params.lang} translations={translations} />
        </div>
      </div>
    </header>
  );
};

export default Header;
