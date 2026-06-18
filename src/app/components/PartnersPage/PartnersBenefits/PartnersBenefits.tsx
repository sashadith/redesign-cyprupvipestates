import React, { FC } from "react";
import styles from "./PartnersBenefits.module.scss";
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
    headingStart: "Die ",
    headingHighlight: "vorteile",
    headingEnd: " unseres partnerprograms",
    items: [
      {
        number: "1",
        title: "Schnelle Auszahlungen",
        description:
          "Wir zahlen innerhalb von 14 Tagen nach Zahlungsbestätigung durch den Bauträger einen 30% Vorschuss aus. Die verbleibenden 70 % erhältst Du, sobald wir die vollständige Vergütung erhalten haben.",
      },
      {
        number: "2",
        title: "Zusammenarbeit mit Experten",
        description:
          "Wir organisieren Besichtigungen, koordinieren den Kontakt zu unabhängigen Anwälten und unterstützen Dich bei der kompletten Abwicklung.",
      },
      {
        number: "3",
        title: "Exklusive Immobilien",
        description:
          "Du erhältst Zugriff auf unsere Datenbank und verkaufst exklusive Immobilien mit ausgewählten Angeboten und einmaligen Servicegebühren.",
      },
      {
        number: "4",
        title: "Immer am Puls der Zeit",
        description:
          "Jeder Schritt des Kunden wird digital erfasst. Deine Anfragen werden automatisch in unser CRM-System übernommen. Über das Partnerportal behältst Du jederzeit den Überblick über den aktuellen Stand. Detaillierte Reports stehen Dir jederzeit zur Verfügung.",
      },
    ],
  },
  en: {
    headingStart: "The ",
    headingHighlight: "benefits",
    headingEnd: " of our partner program",
    items: [
      {
        number: "1",
        title: "Fast payouts",
        description:
          "We pay a 30% advance within 14 days of payment confirmation by the developer. The remaining 70% will be paid once we receive the full service fee.",
      },
      {
        number: "2",
        title: "Expert collaboration",
        description:
          "We organize viewings, coordinate with independent lawyers, who handle legal matters, and support you throughout the entire process.",
      },
      {
        number: "3",
        title: "Exclusive properties",
        description:
          "You get access to our database and sell exclusive properties with selected offers and unique referral fee conditions.",
      },
      {
        number: "4",
        title: "Always up to date",
        description:
          "Each customer step is digitally tracked. Your requests are automatically transferred to our CRM system. The partner portal gives you full insight into the current status at any time. Detailed reports are always available.",
      },
    ],
  },
  pl: {
    headingStart: "Korzyści ",
    headingHighlight: "ze współpracy",
    headingEnd: " w naszym programie partnerskim",
    items: [
      {
        number: "1",
        title: "Szybkie wypłaty",
        description:
          "Wypłacamy 30% zaliczki w ciągu 14 dni od potwierdzenia płatności przez dewelopera. Pozostałe 70% otrzymasz po pełnym rozliczeniu opłaty za usługę.",
      },
      {
        number: "2",
        title: "Współpraca z ekspertami",
        description:
          "Organizujemy prezentacje, koordynujemy kontakt z niezależnymi prawnikami i wspieramy Cię na każdym etapie transakcji.",
      },
      {
        number: "3",
        title: "Ekskluzywne nieruchomości",
        description:
          "Otrzymujesz dostęp do naszej bazy danych i sprzedajesz ekskluzywne nieruchomości z wyselekcjonowanymi ofertami i wyjątkowymi warunkami wynagrodzenia.",
      },
      {
        number: "4",
        title: "Nowoczesne rozwiązania",
        description:
          "Każdy etap klienta jest rejestrowany cyfrowo. Twoje zgłoszenia trafiają bezpośrednio do naszego CRM. W portalu partnerskim masz pełny podgląd statusu. Szczegółowe raporty są zawsze dostępne.",
      },
    ],
  },
  ru: {
    headingStart: "Преимущества ",
    headingHighlight: "нашей программы",
    headingEnd: " для партнёров",
    items: [
      {
        number: "1",
        title: "Быстрые выплаты",
        description:
          "Мы выплачиваем аванс 30% в течение 14 дней после подтверждения оплаты от застройщика. Остальные 70% — после получения всего вознаграждения.",
      },
      {
        number: "2",
        title: "Сотрудничество с экспертами",
        description:
          "Мы организуем показы, координируем работу с независимыми юристами и сопровождаем сделку от начала до конца.",
      },
      {
        number: "3",
        title: "Эксклюзивная недвижимость",
        description:
          "Вы получаете доступ к нашей базе данных и продаёте эксклюзивную недвижимость с отобранными предложениями и уникальными условиями сервисного сбора.",
      },
      {
        number: "4",
        title: "Современные инструменты",
        description:
          "Каждое действие клиента фиксируется в CRM. Вы видите статус в партнёрском кабинете в любое время. Подробные отчёты доступны постоянно.",
      },
    ],
  },
};

const PartnersBenefits: FC<Props> = ({ lang }) => {
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

export default PartnersBenefits;
