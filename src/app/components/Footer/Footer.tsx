import React from "react";
import Link from "next/link";
import { getFooterByLang } from "@/sanity/sanity.utils";
import { urlFor } from "@/sanity/sanity.client";
import type {
  Contact,
  SocialLink,
  Paragraph,
  FooterColumn,
  FooterColumnLink,
  Link as FooterLink,
} from "@/types/footer";
import FooterContact from "./FooterContact";
import FooterNewsletter from "./FooterNewsletter";

/* Global site footer — quiet-luxury redesign (migrated from the staging preview).
   All content still comes from the CMS via getFooterByLang; contact links and the
   newsletter keep their previous tracking / CRM behaviour (see FooterContact /
   FooterNewsletter). Only the design/markup changed. */

type Props = {
  params: { lang: string };
};

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

const placeholderFor = (lang: string) =>
  lang === "de"
    ? "Ihre E-Mail Adresse"
    : lang === "pl"
      ? "Twój adres e-mail"
      : lang === "ru"
        ? "Ваш email"
        : "Your email";

const Footer = async ({ params }: Props) => {
  const data = await getFooterByLang(params.lang);
  if (!data) return null;

  const {
    logo,
    socialLinks,
    companyTitle,
    companyParagraphs,
    contactTitle,
    contacts,
    newsletterTitle,
    newsletterButtonLabel,
    copyright,
    policyLinks,
    footerColumns,
    discklaimer,
  } = data;

  const logoUrl = safeUrl(logo);

  return (
    <footer className="pf" id="footer">
      <div className="pf__container">
        <div className="pf__top">
          <div className="pf__brand">
            {logoUrl && <img className="pf__logo" src={logoUrl} alt="Cyprus VIP Estates" />}
          </div>

          <div className="pf__col">
            {companyTitle && <p className="pf__col-title">{companyTitle}</p>}
            {companyParagraphs?.length > 0 && (
              <div className="pf__about">
                {companyParagraphs.map((p: Paragraph) => (
                  <p key={p._key}>{p.paragraph}</p>
                ))}
              </div>
            )}
          </div>

          <div className="pf__col">
            {contactTitle && <p className="pf__col-title">{contactTitle}</p>}
            <div className="pf__contacts">
              {contacts?.map((c: Contact) => (
                <FooterContact key={c._key} contact={c} />
              ))}
            </div>
            {socialLinks?.length > 0 && (
              <div className="pf__social">
                {socialLinks.map((s: SocialLink) => {
                  const icon = safeUrl(s.icon);
                  return (
                    <a
                      key={s._key}
                      href={s.link}
                      target="_blank"
                      rel="noopener nofollow"
                      className="pf__social-link"
                      aria-label={s.label}
                    >
                      {icon && <img src={icon} alt="" width={20} height={20} />}
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pf__col pf__col--news">
            {newsletterTitle && <p className="pf__col-title">{newsletterTitle}</p>}
            <FooterNewsletter
              placeholder={placeholderFor(params.lang)}
              buttonLabel={newsletterButtonLabel}
              lang={params.lang}
            />
          </div>
        </div>

        {footerColumns?.length > 0 && (
          <nav className="pf__nav" aria-label="Footer navigation">
            {footerColumns.map((col: FooterColumn) =>
              col?.title || col?.links?.length ? (
                <div key={col._key} className="pf__navcol">
                  {col.title && <p className="pf__col-title">{col.title}</p>}
                  {col.links?.length > 0 && (
                    <ul>
                      {col.links.map((l: FooterColumnLink) =>
                        l?.label && l?.url ? (
                          <li key={l._key}>
                            <Link
                              href={l.url}
                              {...(l.url.startsWith("http")
                                ? { target: "_blank", rel: "noopener noreferrer" }
                                : {})}
                            >
                              {l.label}
                            </Link>
                          </li>
                        ) : null
                      )}
                    </ul>
                  )}
                </div>
              ) : null
            )}
          </nav>
        )}

        <div className="pf__bottom">
          <div className="pf__bottom-row">
            {copyright && <p className="pf__copy">{copyright}</p>}
            {policyLinks?.length > 0 && (
              <div className="pf__policy">
                {policyLinks.map((p: FooterLink) => (
                  <Link key={p._key} href={p.link}>
                    {p.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
          {discklaimer && <p className="pf__disclaimer">{discklaimer}</p>}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
