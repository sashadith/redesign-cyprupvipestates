"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import styles from "./CustomCookieConsent.module.scss";

const COOKIE_NAME = "cookieConsent";

type Consent = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

type Props = {
  lang: "en" | "de" | "pl" | "ru";
};

const dictionary = {
  en: {
    title: "We use cookies",
    description:
      "We use necessary cookies for the site to work. We also use analytics and marketing cookies to improve our services – only if you agree.",
    acceptAll: "Accept all",
    rejectAll: "Only necessary",
    privacy: "Cookie Policy",
  },
  de: {
    title: "Wir verwenden Cookies",
    description:
      "Wir verwenden notwendige Cookies für den Betrieb der Website. Zusätzlich setzen wir Analyse- und Marketing-Cookies nur mit Ihrer Zustimmung.",
    acceptAll: "Alle akzeptieren",
    rejectAll: "Nur notwendige",
    privacy: "Cookie-Richtlinie",
  },
  pl: {
    title: "Używamy plików cookie",
    description:
      "Używamy niezbędnych plików cookie, aby strona działała poprawnie. Analityczne i marketingowe pliki cookie wykorzystujemy tylko za Twoją zgodą.",
    acceptAll: "Akceptuj wszystkie",
    rejectAll: "Tylko niezbędne",
    privacy: "Polityka plików cookie",
  },
  ru: {
    title: "Мы используем файлы cookie",
    description:
      "Мы используем необходимые файлы cookie для работы сайта. Аналитические и маркетинговые файлы cookie используются только с вашего согласия.",
    acceptAll: "Принять все",
    rejectAll: "Только необходимые",
    privacy: "Политика использования cookies",
  },
};

export default function CustomCookieConsent({ lang }: Props) {
  const router = useRouter();
  const t = dictionary[lang] || dictionary.en;

  const getNormalizedHref = (lang: string, link: string) => {
    const normalizedLink = link.startsWith("/") ? link.slice(1) : link;
    const languagePrefix = lang === "de" ? "" : `/${lang}`;
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
      <p>{t.description}</p>

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

      <p className={styles.policyLink}>
        <a
          href={getNormalizedHref(
            lang,
            {
              en: "privacy-policy",
              de: "datenschutzrichtlinie",
              pl: "polityka-prywatnosci",
              ru: "politika-privatnosti",
            }[lang]
          )}
          target="_blank"
        >
          {t.privacy}
        </a>
      </p>
    </div>
  );
}
