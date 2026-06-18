import React, { FC } from "react";
import styles from "../../BenefitsBlock/BenefitsBlock.module.scss";
import CountNumber from "../../CountNumber/CountNumber";
import Image from "next/image";

type Props = {
  lang: string;
};

type BenefitItem = {
  number: string;
  sign?: string;
  title: string;
  description: string;
};

type PartnersCountTranslation = BenefitItem[];

const translations: Record<string, PartnersCountTranslation> = {
  de: [
    {
      number: "195",
      title: "Immobilienprojekte",
      description:
        "Auf Süd-Zypern. Von Studio Apartments bis High Class Villas",
    },
    {
      number: "10",
      title: "Jahre Erfahrung",
      description: "als Full-Service Immobilien Marketing Agentur",
    },
    {
      number: "360",
      sign: "°",
      title: "Service für unsere Kunden",
      description:
        "Wir begleiten Sie vom ersten Kontakt bis zur Schlüsselübergabe",
    },
    {
      number: "100",
      sign: "%",
      title: "Zufriedene Kunden",
      description: "Aus Deutschland, Österreich, Schweiz und weiteren Ländern",
    },
  ],
  en: [
    {
      number: "195",
      title: "Real estate projects",
      description:
        "In Southern Cyprus. From studio apartments to high-class villas",
    },
    {
      number: "10",
      title: "Years of experience",
      description: "as a full-service real estate marketing agency",
    },
    {
      number: "360",
      sign: "°",
      title: "Customer service",
      description: "We guide you from the first contact to key handover",
    },
    {
      number: "100",
      sign: "%",
      title: "Satisfied clients",
      description: "From Germany, Austria, Switzerland and beyond",
    },
  ],
  pl: [
    {
      number: "195",
      title: "Projektów nieruchomości",
      description: "Na południu Cypru – od kawalerek po luksusowe wille",
    },
    {
      number: "10",
      title: "Lat doświadczenia",
      description: "jako agencja marketingu nieruchomości typu full-service",
    },
    {
      number: "360",
      sign: "°",
      title: "Obsługa klienta",
      description:
        "Prowadzimy Cię od pierwszego kontaktu do przekazania kluczy",
    },
    {
      number: "100",
      sign: "%",
      title: "Zadowoleni klienci",
      description: "Z Niemiec, Austrii, Szwajcarii i innych krajów",
    },
  ],
  ru: [
    {
      number: "195",
      title: "Проектов недвижимости",
      description: "На юге Кипра: от студий до элитных вилл",
    },
    {
      number: "10",
      title: "Лет опыта",
      description: "как агентство полного цикла по маркетингу недвижимости",
    },
    {
      number: "360",
      sign: "°",
      title: "Сервис для клиентов",
      description: "Мы сопровождаем вас от первого контакта до передачи ключей",
    },
    {
      number: "100",
      sign: "%",
      title: "Довольных клиентов",
      description: "Из Германии, Австрии, Швейцарии и других стран",
    },
  ],
};

const PartnersCount: FC<Props> = ({ lang }) => {
  const benefits = translations[lang] ?? translations["de"];

  return (
    <section className={styles.benefitsBlock}>
      <div className="container">
        <div className={styles.inner}>
          <div className={styles.benefitsList}>
            {benefits.map((benefit) => (
              <div key={benefit.title} className={styles.benefitItem}>
                <div className={styles.image}>
                  <Image
                    src="/uploads/files/fc32736b9254db609636afb517d52ee174377d9f.png"
                    alt="Cyprus VIP Estates Benefits"
                    width={80}
                    height={80}
                    unoptimized
                    className={styles.icon}
                  />
                </div>
                <div className={styles.content}>
                  <div className={styles.conuting}>
                    <div className={styles.conuter}>
                      <CountNumber>{benefit.number}</CountNumber>
                      {benefit.sign && <span>{benefit.sign}</span>}
                    </div>
                  </div>
                  <div className={styles.text}>
                    <p className={styles.title}>{benefit.title}</p>
                    <p className={styles.description}>{benefit.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PartnersCount;
