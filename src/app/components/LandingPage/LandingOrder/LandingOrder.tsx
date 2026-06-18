import React, { FC } from "react";
import styles from "./LandingOrder.module.scss";
import { Oswald, Libre_Baskerville } from "next/font/google";
import FadeUpAnimate from "../../FadeUpAnimate/FadeUpAnimate";

type Props = {
  lang: string;
};

const oswald = Oswald({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400"],
});

const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400"],
});

type BenefitItem = {
  number: string;
  title: string;
  description: string;
};

type PartnersBenefitsTranslation = {
  headingStart: string;
  headingHighlight: string;
  headingEnd: string;
  items: BenefitItem[];
};

const translations: Record<string, PartnersBenefitsTranslation> = {
  de: {
    headingStart: "Ihr Weg ",
    headingHighlight: "zum Eigenheim",
    headingEnd: " auf Zypern",
    items: [
      {
        number: "1",
        title: "Beratung und Auswahl",
        description:
          "Kontaktieren Sie uns und teilen Sie uns Ihre Wünsche und Ihr Budget mit. Wir präsentieren Ihnen passende Immobilienoptionen und beraten Sie zu allen Details.",
      },
      {
        number: "2",
        title: "Besichtigung vor Ort oder online",
        description:
          "Wir organisieren persönliche Besichtigungen auf Zypern oder virtuelle Rundgänge, damit Sie Ihre Favoriten in Ruhe prüfen können.",
      },
      {
        number: "3",
        title: "Kaufvertrag und rechtliche Prüfung",
        description:
          "Wir vermitteln Ihnen vertrauenswürdige Rechtsexperten, die sich um den Vertrag kümmern – von der Vertragsvorbereitung bis zur Eintragung ins Grundbuch.",
      },
      {
        number: "4",
        title: "Übergabe und Einzug",
        description:
          "Nach Abschluss der Zahlung und aller Formalitäten erhalten Sie die Schlüssel und können Ihr neues Zuhause auf Zypern genießen.",
      },
    ],
  },
  en: {
    headingStart: "Your path ",
    headingHighlight: "to owning property",
    headingEnd: " in Cyprus",
    items: [
      {
        number: "1",
        title: "Consultation & selection",
        description:
          "Contact us with your preferences and budget. We will present suitable property options and advise you on every detail.",
      },
      {
        number: "2",
        title: "Viewing on-site or online",
        description:
          "We arrange in-person viewings in Cyprus or virtual tours so you can explore your shortlisted properties comfortably.",
      },
      {
        number: "3",
        title: "Purchase agreement & legal checks",
        description:
          "We introduce you to trusted legal experts who handle the contract to registering the property in the Land Registry.",
      },
      {
        number: "4",
        title: "Handover & move-in",
        description:
          "Once payment and formalities are complete, you receive the keys and can enjoy your new home in Cyprus.",
      },
    ],
  },
  pl: {
    headingStart: "Twój krok po kroku ",
    headingHighlight: "do zakupu nieruchomości",
    headingEnd: " na Cyprze",
    items: [
      {
        number: "1",
        title: "Konsultacja i wybór",
        description:
          "Skontaktuj się z nami, podaj swoje oczekiwania i budżet. Przedstawimy Ci dopasowane oferty i doradzimy w każdym szczególe.",
      },
      {
        number: "2",
        title: "Oględziny na miejscu lub online",
        description:
          "Zorganizujemy wizytę na Cyprze lub wirtualny spacer, abyś mógł dokładnie obejrzeć wybrane nieruchomości.",
      },
      {
        number: "3",
        title: "Umowa zakupu i weryfikacja prawna",
        description:
          "Przedstawiamy Państwu zaufanych ekspertów prawnych, którzy zajmują się umowami – od przygotowania umowy po wpis do księgi wieczystej.",
      },
      {
        number: "4",
        title: "Przekazanie kluczy i wprowadzenie się",
        description:
          "Po finalizacji płatności i formalności otrzymasz klucze i będziesz mógł cieszyć się swoim nowym domem na Cyprze.",
      },
    ],
  },
  ru: {
    headingStart: "Ваш путь ",
    headingHighlight: "к покупке недвижимости",
    headingEnd: " на Кипре",
    items: [
      {
        number: "1",
        title: "Консультация и подбор",
        description:
          "Свяжитесь с нами, расскажите о ваших пожеланиях и бюджете. Мы подберём подходящие варианты и подробно проконсультируем.",
      },
      {
        number: "2",
        title: "Просмотр на месте или онлайн",
        description:
          "Организуем личные показы на Кипре или онлайн-туры, чтобы вы могли тщательно оценить выбранные объекты.",
      },
      {
        number: "3",
        title: "Договор и юридическая проверка",
        description:
          "Мы предоставим вам проверенных юристов, который занимаются договором, — от подготовки договора до регистрации собственности в земельном кадастре.",
      },
      {
        number: "4",
        title: "Передача ключей и заселение",
        description:
          "После оплаты и оформления всех документов вы получите ключи и сможете наслаждаться своим новым домом на Кипре.",
      },
    ],
  },
};

const LandingOrder: FC<Props> = ({ lang }) => {
  const t = translations[lang] ?? translations.de;

  return (
    <section className={styles.benefits}>
      <div className="container">
        <h2 className={`${styles.title} ${oswald.className}`}>
          {t.headingStart}
          <span className={styles.highlight}>{t.headingHighlight}</span>
          {t.headingEnd}
        </h2>
        <div className={styles.benefitsItems}>
          {t.items.map((item, index) => (
            <FadeUpAnimate key={index} delay={index * 100}>
              <div className={styles.benefitsItem}>
                <div className={styles.benefitsItemNumber}>
                  <span
                    className={`${styles.number} ${libreBaskerville.className}`}
                  >
                    {item.number}
                  </span>
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

export default LandingOrder;
