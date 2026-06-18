import React from "react";
import styles from "./Footer.module.scss";
import { getFooterByLang } from "@/sanity/sanity.utils";
import Link from "next/link";
import {
  Link as FooterLink,
  SocialLink,
  Paragraph,
  Contact,
  FooterColumn,
  FooterColumnLink,
} from "@/types/footer"; // Импортируйте тип Link и переименуйте его, чтобы избежать конфликта с Link из next/link
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import NewsletterForm from "../NewsletterForm/NewsletterForm";
import ContactLink from "../ContactLink/ContactLink";

type Props = {
  params: { lang: string };
};

const Footer = async ({ params }: Props) => {
  const data = await getFooterByLang(params.lang);

  const {
    logo,
    socialLinks,
    companyTitle,
    companyParagraphs,
    vatNumber,
    contactTitle,
    contacts,
    newsletterTitle,
    newsletterButtonLabel,
    copyright,
    policyLinks,
    footerColumns,
    discklaimer,
  } = data;

  const cleanLink = (link: string) => {
    // Оставляем буквы, цифры, символы @ и +
    return link.replace(/[^a-zA-Z0-9@+]/g, "");
  };

  const getContactHref = (contact: Contact) => {
    const cleanedLabel = cleanLink(contact.label);

    switch (contact.type) {
      case "Email":
        return `mailto:${cleanedLabel}`;

      case "Phone":
        // Если это телефон, возвращаем ссылку для звонка
        return `tel:${cleanedLabel}`;

      case "Link":
        // Если в label содержится номер телефона, формируем ссылку на WhatsApp
        if (cleanedLabel.match(/^\+?\d+$/)) {
          const whatsappNumber = cleanedLabel.replace("+", ""); // Убираем плюс для WhatsApp
          return `https://wa.me/${whatsappNumber}`;
        }
        // Если это обычная ссылка, проверяем на наличие http/https
        return cleanedLabel.startsWith("http://") ||
          cleanedLabel.startsWith("https://")
          ? cleanedLabel
          : `https://${cleanedLabel}`;

      default:
        return "#";
    }
  };

  const getPlaceholderText = (lang: string) => {
    switch (lang) {
      case "en":
        return "Your email";
      case "de":
        return "Ihre E-Mail Adresse";
      case "pl":
        return "Twój adres e-mail";
      case "ru":
        return "Ваш email";
      default:
        return "Your email"; // Значение по умолчанию
    }
  };

  return (
    <footer className={styles.footer} id="footer">
      <div className={styles.top}>
        <div className="container">
          <div className={styles.footerGrid}>
            <div className={styles.logoLinks}>
              <div className={styles.logoBlock}>
                <Image
                  alt="Cyprys VIP Estates"
                  src={urlFor(logo).url()}
                  width={400}
                  height={400}
                  className={styles.image}
                  unoptimized
                />
              </div>
              <div className={styles.socialLinks}>
                {socialLinks.map((socialLink: SocialLink) => (
                  <Link
                    href={socialLink.link}
                    key={socialLink._key}
                    className={styles.socialLink}
                    target="_blank"
                    rel="noopener nofollow"
                  >
                    <Image
                      alt={socialLink.label}
                      src={urlFor(socialLink.icon).url()}
                      width={30}
                      height={30}
                      unoptimized
                    />
                  </Link>
                ))}
              </div>
            </div>
            <div className={styles.companyBlock}>
              <p className={styles.title}>{companyTitle}</p>
              <div className={styles.paragraphs}>
                {companyParagraphs.map((paragraph: Paragraph) => (
                  <p key={paragraph._key} className={styles.paragraph}>
                    {paragraph.paragraph}
                  </p>
                ))}
              </div>
              {/* <p className={styles.paragraph}>{vatNumber}</p> */}
            </div>
            <div className={styles.contactBlock}>
              <p className={styles.title}>{contactTitle}</p>
              <div className={styles.contacts}>
                {contacts.map((contact: Contact) => (
                  <ContactLink key={contact._key} contact={contact} />
                ))}
              </div>
            </div>
            <div className={styles.newsLetterBlock}>
              <p className={styles.title}>{newsletterTitle}</p>
              <NewsletterForm
                placeholder={getPlaceholderText(params.lang)}
                buttonLabel={newsletterButtonLabel}
                lang={params.lang}
              />
            </div>
          </div>
        </div>
      </div>
      {footerColumns?.length > 0 && (
        <div className={styles.footerMiddle}>
          <div className="container">
            <nav
              className={styles.footerColumns}
              aria-label="Footer navigation"
            >
              {footerColumns.map((column: FooterColumn) => {
                if (!column?.title && !column?.links?.length) return null;

                return (
                  <div key={column._key} className={styles.footerColumn}>
                    {column.title && (
                      <p className={styles.title}>{column.title}</p>
                    )}

                    {column.links?.length > 0 && (
                      <ul className={styles.columnLinks}>
                        {column.links.map((link: FooterColumnLink) => {
                          if (!link?.label || !link?.url) return null;

                          const isExternal = link.url.startsWith("http");

                          return (
                            <li key={link._key} className={styles.columnLink}>
                              <Link
                                href={link.url}
                                {...(isExternal
                                  ? {
                                      target: "_blank",
                                      rel: "noopener noreferrer",
                                    }
                                  : {})}
                              >
                                {link.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </div>
      )}
      {/* <div className={styles.footerDivider}></div> */}
      <div className={styles.bottom}>
        <div className="container">
          <div className={styles.bottomWrapper}>
            <div className={styles.bottomLeft}>
              <p className={styles.policyLink}>{copyright}</p>
            </div>
            <div className={styles.bottomRight}>
              <div className={styles.policyLinks}>
                {policyLinks.map(
                  (
                    policyLink: FooterLink, // Укажите тип для policyLink
                  ) => (
                    <Link
                      href={policyLink.link}
                      key={policyLink._key}
                      className={styles.policyLink}
                    >
                      {policyLink.label}
                    </Link>
                  ),
                )}
              </div>
            </div>
          </div>
          <div className={styles.discklaimer}>{discklaimer}</div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
