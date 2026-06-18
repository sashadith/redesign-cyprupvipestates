import React, { FC } from "react";
import styles from "./LandingIntroBlockComponent.module.scss";
import Image from "next/image";
import { ButtonModal } from "../../ButtonModal/ButtonModal";
import { Oswald } from "next/font/google";
import { LandingIntroBlock } from "@/types/blog";
import { urlFor } from "@/sanity/sanity.client";

type Props = {
  lang: string;
  block: LandingIntroBlock;
};

type PartnersHeroTranslation = {
  subtitleTop: string;
  titleStart: string;
  titleHighlight: string;
  titleEnd: string;
  subtitleBottom: string;
  button: string;
  note: string;
};

const oswald = Oswald({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400"],
});

const translations: Record<string, PartnersHeroTranslation> = {
  de: {
    subtitleTop: "Werde partner von cyprus vip estates",
    titleStart: "Werde jetzt teil unseres ",
    titleHighlight: "partnerprogramms",
    titleEnd: " und verdiene mit uns!",
    subtitleBottom: "Verdiene bis zu 40 % unserer provision*",
    button: "jetzt partner werden!",
    note: "* Für Immobilienkäufe erhalten unsere Partner eine Provision von 30 % bis 50 %. Für die Empfehlung von Eigentümern bestehender Immobilien zahlen wir 10 % Vermittlungsprovision.",
  },
  en: {
    subtitleTop: "Become a partner of Cyprus VIP Estates",
    titleStart: "Join our ",
    titleHighlight: "partner program",
    titleEnd: " and earn with us!",
    subtitleBottom: "Earn up to 40% of our commission*",
    button: "become a partner",
    note: "* For real estate purchases, our partners receive a commission of 30–50%. For referring property owners, we pay a 10% referral fee.",
  },
  pl: {
    subtitleTop: "Zostań partnerem Cyprus VIP Estates",
    titleStart: "Dołącz do naszego ",
    titleHighlight: "programu partnerskiego",
    titleEnd: " i zarabiaj z nami!",
    subtitleBottom: "Zarabiaj do 40% naszej wynagrodzenia*",
    button: "zostań partnerem",
    note: "* Za sprzedaż nieruchomości partnerzy otrzymują wynagrodzenie 30–50%. Za polecenie właścicieli nieruchomości wypłacamy 10% wynagrodzenia.",
  },
  ru: {
    subtitleTop: "Стань партнёром Cyprus VIP Estates",
    titleStart: "Стань частью ",
    titleHighlight: "партнёрской программы",
    titleEnd: " и зарабатывай с нами!",
    subtitleBottom: "Зарабатывай до 40% нашего вознаграждения*",
    button: "стать партнёром",
    note: "* За продажу недвижимости партнёры получают комиссию от 30 до 50%. За рекомендации владельцев — 10% вознаграждение.",
  },
};

const LandingIntroBlockComponent: FC<Props> = ({ lang, block }) => {
  const { subtitle, title, description, buttonLabel, image } = block;
  const t: PartnersHeroTranslation = translations[lang] ?? translations.de;

  return (
    <section className={styles.partnersHero}>
      <div className="container-full">
        <div className={styles.wrapper}>
          <div className={styles.partnersHeroImage}>
            <div className={styles.overlay}></div>
            <Image
              src={urlFor(image).url()}
              alt="Partnering with Cyprus VIP Estates"
              width={800}
              height={800}
              className={styles.image}
            />
          </div>
          <div className={styles.content}>
            <div className={styles.contentWrapper}>
              <div className={`${styles.contentText} ${oswald.className}`}>
                <p className={styles.subtitle}>{subtitle}</p>
                <h1 className={styles.title}>{title}</h1>
                <p className={styles.subtitle}>{description}</p>
              </div>
              <div className={styles.contentButton}>
                <ButtonModal>{buttonLabel}</ButtonModal>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingIntroBlockComponent;
