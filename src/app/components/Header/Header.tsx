import Link from "next/link";
import { getHeaderByLang } from "@/sanity/sanity.utils";
import { urlFor } from "@/sanity/sanity.client";
import { Translation } from "@/types/homepage";
import { localizedHref } from "@/lib/locale";
import ScrollFlag from "./ScrollFlag";
import HeaderNavLinks from "./HeaderNavLinks";
import HeaderLangSwitch from "./HeaderLangSwitch";
import HeaderMobileMenu from "./HeaderMobileMenu";
import HeaderConsultButton from "./HeaderConsultButton";
import ModalBrochure from "../ModalBrochure/ModalBrochure";
import { getFormStandardDocumentByLang } from "@/sanity/sanity.utils";
import type { FormStandardDocument } from "@/types/formStandardDocument";

/* Global site header — quiet-luxury redesign (migrated from the staging preview).
   Transparent at the top of the page, frosted on scroll. Content (logo + menu)
   still comes from the CMS via getHeaderByLang; the language switcher is wired to
   the real multilingual routing through the `translations` prop.

   2026-09-26: the migration note that used to sit here — "there is no Get
   Consultation CTA (matches staging)" — no longer holds. The header now carries
   one conversion button, HeaderConsultButton, between the nav and the language
   switcher.

   The modal that button opens is rendered HERE rather than per page. It used to
   be mounted by each page that wanted it, which covered 8 routes — but the header
   renders on 13, so /projects, /developers, the 404 page and both preview-project
   routes would have shown a button that opened nothing. Mounting it beside the
   button makes the pair impossible to separate: any route with the header has the
   modal. Those 8 pages fetched the form document for no other purpose, so they
   lost the fetch and the render together; getFormStandardDocumentByLang is now
   cache()d so this fetch costs nothing on a page that still needs its own. */

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

/* The logo URL is about to be interpolated into a CSS url() token, so it is
   checked rather than trusted. urlFor() above only builds a URL, it does not
   constrain the characters in it, and the result feeds mask-image: a value
   carrying a quote or a bracket could redirect the mask at an arbitrary remote
   image, which would log every page view. Requires https or a site-relative
   path, rejects the characters that could close the token, and escapes what is
   left. Returning undefined drops the custom property entirely, which the
   stylesheet already handles with a transparent-mask fallback. */
const cssUrl = (u?: string) => {
  if (!u || !/^(https:\/\/|\/)[^"')\\\s]+$/.test(u)) return undefined;
  return `url("${u.replace(/["\\]/g, (c) => `\\${c}`)}")`;
};

const Header = async ({ translations, params }: Props) => {
  const data = await getHeaderByLang(params.lang);
  const logo = safeUrl(data.logo);
  const logoMobile = safeUrl(data.logoMobile) ?? logo;
  const formDocument: FormStandardDocument = await getFormStandardDocumentByLang(params.lang);

  return (
    <header className="nav">
      <ScrollFlag />
      <div className="nav__inner">
        {/* The logo URLs are handed to CSS as custom properties so header-footer.css
            can use the image as the MASK for the 45-degree sheen sweep. They cannot
            be written in the stylesheet: the logo comes from the CMS and differs per
            site. Absent values simply omit the property, and the CSS falls back to a
            transparent mask (no sheen) rather than an unmasked rectangle. */}
        <Link
          className="nav__logo"
          href={localizedHref(params.lang)}
          aria-label="Cyprus VIP Estates — home"
          style={
            {
              ...(cssUrl(logo) ? { "--logo-full-url": cssUrl(logo) } : {}),
              ...(cssUrl(logoMobile) ? { "--logo-mark-url": cssUrl(logoMobile) } : {}),
            } as React.CSSProperties
          }
        >
          {logo && <img className="nav__logo-full" src={logo} alt="Cyprus VIP Estates" />}
          {logoMobile && <img className="nav__logo-mark" src={logoMobile} alt="Cyprus VIP Estates" />}
        </Link>

        <HeaderNavLinks navLinks={data.navLinks} lang={params.lang} />

        <div className="nav__right">
          <HeaderConsultButton lang={params.lang} />
          <HeaderLangSwitch translations={translations} />
          <HeaderMobileMenu navLinks={data.navLinks} lang={params.lang} translations={translations} />
        </div>
      </div>
      <ModalBrochure lang={params.lang} formDocument={formDocument} />
    </header>
  );
};

export default Header;
