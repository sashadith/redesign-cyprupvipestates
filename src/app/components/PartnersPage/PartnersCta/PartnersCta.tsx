import React, { FC } from "react";
import styles from "./PartnersCta.module.scss";
import { Oswald } from "next/font/google";
import { ButtonModal } from "../../ButtonModal/ButtonModal";
import Image from "next/image";
import FadeUpAnimate from "../../FadeUpAnimate/FadeUpAnimate";
import type { Locale } from "@/lib/locale";

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

const EN: PartnersCtaTranslation = {
  titleStart: "become our ",
  titleHighlight: "partner!",
  description: "Fill out the form and become part of our international team",
  button: "become a partner",
};

const translations: Record<Locale, PartnersCtaTranslation> = {
  de: {
    titleStart: "werde unser ",
    titleHighlight: "partner!",
    description:
      "Fülle das Formular aus und werde Teil unseres internationalen Teams",
    button: "jetzt partner werden!",
  },
  en: EN,
  pl: {
    titleStart: "zostań naszym ",
    titleHighlight: "partnerem!",
    description:
      "Wypełnij formularz i dołącz do naszego międzynarodowego zespołu",
    button: "zostań partnerem",
  },
  ru: {
    titleStart: "стань нашим ",
    titleHighlight: "партнёром!",
    description: "Заполни форму и стань частью нашей международной команды",
    button: "стать партнёром",
  },
  he: EN, // decision J: Partners page stays English for he
};

const PartnersCta: FC<Props> = ({ lang }) => {
  const t = translations[lang as Locale] ?? translations.en;

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

export default PartnersCta;
