"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import styles from "./CustomCookieConsent.module.scss";
import { localePrefix, type Locale } from "@/lib/locale";
import { CORPORATE_SLUGS } from "@/lib/corporatePageSlugs";
import { COOKIE_CONSENT_COPY } from "./CustomCookieConsent.copy";

const COOKIE_NAME = "cookieConsent";

type Consent = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

type Props = {
  lang: Locale;
};

export default function CustomCookieConsent({ lang }: Props) {
  const router = useRouter();
  const t = COOKIE_CONSENT_COPY[lang];

  const getNormalizedHref = (lang: string, link: string) => {
    const normalizedLink = link.startsWith("/") ? link.slice(1) : link;
    const languagePrefix = localePrefix(lang);
    return `${languagePrefix}/${normalizedLink}`;
  };

  const [visible, setVisible] = useState(false);

  // показать баннер только если куки ещё нет
  useEffect(() => {
    const saved = Cookies.get(COOKIE_NAME);
    if (!saved) {
      setVisible(true);
    }
  }, []);

  const acceptAll = () => {
    const consent: Consent = {
      necessary: true,
      analytics: true,
      marketing: true,
    };
    Cookies.set(COOKIE_NAME, JSON.stringify(consent), {
      expires: 180,
      sameSite: "Lax",
    });
    setVisible(false);
    router.refresh();
  };

  const rejectAll = () => {
    const consent: Consent = {
      necessary: true,
      analytics: false,
      marketing: false,
    };
    Cookies.set(COOKIE_NAME, JSON.stringify(consent), {
      expires: 180,
      sameSite: "Lax",
    });
    setVisible(false);
    router.refresh();
  };

  if (!visible) return null;

  return (
    <div className={styles.cookieBanner}>
      <h3>{t.title}</h3>
      <p>
        {t.description}{" "}
        <a
          href={getNormalizedHref(lang, CORPORATE_SLUGS.privacy[lang])}
          target="_blank"
          className={styles.policyLink}
        >
          {t.privacy}
        </a>
      </p>

      <div className={styles.buttons}>
        <button
          type="button"
          onClick={acceptAll}
          className={styles.primaryButton}
        >
          {t.acceptAll}
        </button>
        <button
          type="button"
          onClick={rejectAll}
          className={styles.secondaryButton}
        >
          {t.rejectAll}
        </button>
      </div>
    </div>
  );
}
