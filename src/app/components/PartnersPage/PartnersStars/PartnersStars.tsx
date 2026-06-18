import React, { FC } from "react";
import styles from "./PartnersStars.module.scss";
import { Oswald } from "next/font/google";
import FadeUpAnimate from "../../FadeUpAnimate/FadeUpAnimate";

const oswald = Oswald({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400"],
});

type Props = {
  lang: string;
};

type StarsItem = {
  title: string;
  description: string;
};

type PartnersStarsTranslation = {
  headingStart: string;
  headingHighlight1: string;
  headingMiddle: string;
  headingHighlight2: string;
  items: StarsItem[];
};

const translations: Record<string, PartnersStarsTranslation> = {
  de: {
    headingStart: "Mit welchen ",
    headingHighlight1: "unternehmen",
    headingMiddle: " arbeiten wir ",
    headingHighlight2: "zusammen",
    items: [
      {
        title: "Bauunternehmer",
        description:
          "Unsere Partner sind die renommiertesten Bauträger der Insel – sorgfältig ausgewählt und geprüft, um unseren Kunden erstklassige Qualität bieten zu können.",
      },
      {
        title: "Rechtsberater",
        description:
          "Um unseren Kunden ein Höchstmaß an Sicherheit und Vertrauen in den gesamten Immobilienprozess zu gewährleisten, arbeiten wir eng mit erfahrenen Rechtsanwälten und Notaren zusammen.",
      },
      {
        title: "Immobilienagenturen und private Vermittler",
        description:
          "Du erhältst Zugriff auf unsere aktuelle Immobiliendatenbank mit ausgewählten Angeboten und exklusiven Konditionen.",
      },
    ],
  },
  en: {
    headingStart: "Which ",
    headingHighlight1: "companies",
    headingMiddle: " do we work ",
    headingHighlight2: "with",
    items: [
      {
        title: "Developers",
        description:
          "Our partners are the most reputable developers on the island – carefully selected and verified to ensure top quality for our clients.",
      },
      {
        title: "Legal advisors",
        description:
          "We work closely with experienced lawyers and notaries to guarantee maximum security and confidence throughout the property process.",
      },
      {
        title: "Agencies and private brokers",
        description:
          "You get access to our updated property database with selected listings and exclusive referral fee terms.",
      },
    ],
  },
  pl: {
    headingStart: "Z jakimi ",
    headingHighlight1: "firmami",
    headingMiddle: " współpracujemy ",
    headingHighlight2: "",
    items: [
      {
        title: "Deweloperzy",
        description:
          "Nasi partnerzy to najbardziej renomowani deweloperzy na wyspie – starannie wybrani i sprawdzeni, aby zapewnić naszym klientom najwyższą jakość.",
      },
      {
        title: "Doradcy prawni",
        description:
          "Współpracujemy z doświadczonymi prawnikami i notariuszami, aby zapewnić maksymalne bezpieczeństwo i zaufanie podczas całego procesu zakupu nieruchomości.",
      },
      {
        title: "Agencje i pośrednicy",
        description:
          "Otrzymujesz dostęp do naszej aktualnej bazy nieruchomości z wybranymi ofertami i korzystnymi warunkami wynagrodzenia.",
      },
    ],
  },
  ru: {
    headingStart: "С какими ",
    headingHighlight1: "компаниями",
    headingMiddle: " мы ",
    headingHighlight2: "сотрудничаем",
    items: [
      {
        title: "Застройщики",
        description:
          "Наши партнёры — это самые авторитетные застройщики на Кипре. Мы тщательно их отбираем и проверяем, чтобы гарантировать высокое качество нашим клиентам.",
      },
      {
        title: "Юридические консультанты",
        description:
          "Мы сотрудничаем с опытными юристами и нотариусами, чтобы обеспечить максимальную безопасность и доверие на всех этапах покупки недвижимости.",
      },
      {
        title: "Агентства и частные посредники",
        description:
          "Вы получаете доступ к нашей базе недвижимости с эксклюзивными предложениями и выгодными условиями партнёрства.",
      },
    ],
  },
};

const PartnersStars: FC<Props> = ({ lang }) => {
  const t = translations[lang] ?? translations.de;

  return (
    <section className={styles.stars}>
      <div className="container">
        <h2 className={`${styles.title} ${oswald.className}`}>
          {t.headingStart}
          <span className={styles.highlight}>{t.headingHighlight1}</span>
          {t.headingMiddle}
          <span className={styles.highlight}>{t.headingHighlight2}</span>
        </h2>
        <div className={styles.benefitsItems}>
          {t.items.map((item, index) => (
            <FadeUpAnimate key={item.title} delay={index * 150}>
              <div className={styles.benefitsItem}>
                <div className={styles.benefitsItemNumber}>
                  <svg
                    width="86"
                    height="82"
                    viewBox="0 0 86 82"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M42.7975 0L52.9007 31.0942H85.5951L59.1447 50.3115L69.2479 81.4058L42.7975 62.1885L16.3472 81.4058L26.4503 50.3115L0 31.0942H32.6944L42.7975 0Z"
                      fill="#BD8948"
                    ></path>
                  </svg>
                </div>
                <div className={styles.benefitsItemContent}>
                  <h3 className={styles.benefitsItemTitle}>{item.title}</h3>
                  <p className={styles.benefitsItemDescription}>
                    {item.description}
                  </p>
                </div>
              </div>
            </FadeUpAnimate>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PartnersStars;
