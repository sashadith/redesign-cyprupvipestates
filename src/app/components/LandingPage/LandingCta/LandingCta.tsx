import React, { FC } from "react";
import styles from "./LandingCta.module.scss";
import { Oswald } from "next/font/google";
import { ButtonModal } from "../../ButtonModal/ButtonModal";
import Image from "next/image";
import FadeUpAnimate from "../../FadeUpAnimate/FadeUpAnimate";

const oswald = Oswald({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400"],
});

type Props = {
  lang: string;
};

type PartnersCtaTranslation = {
  titleStart: string;
  titleHighlight: string;
  description: string;
  button: string;
};

const translations: Record<string, PartnersCtaTranslation> = {
  de: {
    titleStart: "finden Sie Ihr ",
    titleHighlight: "Zuhause auf Zypern",
    description:
      "Teilen Sie uns Ihre Wünsche mit – innerhalb von 24 Stunden senden wir eine kuratierte Auswahl und planen Besichtigungen, vor Ort oder online. Unverbindlich.",
    button: "meine auswahl erhalten",
  },
  en: {
    titleStart: "secure your ",
    titleHighlight: "home in Cyprus",
    description:
      "Tell us what you’re looking for—within 24 hours we’ll send a curated shortlist and arrange viewings, on-site or virtual. No obligation.",
    button: "get my shortlist",
  },
  pl: {
    titleStart: "znajdź swoje ",
    titleHighlight: "miejsce na Cyprze",
    description:
      "Podaj nam preferencje — w 24 godziny wyślemy dopasowaną listę ofert i zaplanujemy oględziny, na miejscu lub online. Bez zobowiązań.",
    button: "otrzymaj listę ofert",
  },
  ru: {
    titleStart: "найдите свой ",
    titleHighlight: "дом на Кипре",
    description:
      "Расскажите о пожеланиях — за 24 часа пришлём подборку и организуем просмотры, офлайн или онлайн. Без обязательств.",
    button: "получить подборку",
  },
};

const LandingCta: FC<Props> = ({ lang }) => {
  const t = translations[lang] ?? translations["de"];

  return (
    <section className={styles.partnersCta}>
      <div className="container">
        <div className={styles.cta}>
          <div className={styles.ctaWrapper}>
            <div className={styles.ctaContent}>
              <h2 className={`${styles.title} ${oswald.className}`}>
                {t.titleStart}
                <span className={styles.highlight}>{t.titleHighlight}</span>
              </h2>
              <p className={styles.description}>{t.description}</p>
            </div>
            <FadeUpAnimate delay={150}>
              <div className={styles.ctaButton}>
                <ButtonModal>{t.button}</ButtonModal>
              </div>
            </FadeUpAnimate>
          </div>
          <FadeUpAnimate delay={50}>
            <Image
              src="/uploads/files/616ecfad4ada6eef63240e5727f0d5da6bb53434.png"
              alt="Partnering with Cyprus VIP Estates"
              width={600}
              height={520}
              className={styles.image}
            />
          </FadeUpAnimate>
        </div>
      </div>
    </section>
  );
};

export default LandingCta;
