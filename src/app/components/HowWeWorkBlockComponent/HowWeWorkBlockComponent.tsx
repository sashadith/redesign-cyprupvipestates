import React, { FC } from "react";
import styles from "./HowWeWorkBlockComponent.module.scss";
import { HowWeWorkBlock as HowWeWorkBlockType } from "@/types/blog";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import { MdOutlineArrowCircleDown } from "react-icons/md";

type Props = {
  block: HowWeWorkBlockType;
  lang: string;
};

const marginValues: Record<string, string> = {
  small: "clamp(0.625rem, 2.5vw, 1.875rem)",
  medium: "clamp(1.25rem, 0.5rem + 3vw, 2.75rem)",
  large: "clamp(1.25rem, 5vw, 3.75rem)",
};

const icons = [
  "/uploads/images/010e554d53e8a2f99f7d779b88ad4802ea879931-500x500.svg",
  "/uploads/images/ea98b4b1814fb2a981c5db0f004a959d3df14989-500x500.svg",
  "/uploads/images/34191203d1e6add0437bc90f08afd32a2bb00102-500x500.svg",
  "/uploads/images/fddcb74dc9aa266cf6c1fa5bbafddc4f09f037ad-500x500.svg",
  "/uploads/images/01fd70faab96a48e121b9588c547e3a711cce430-500x500.svg",
  "/uploads/images/b2beb1ac8dbcd8bbcc7ce08387c37268c8c162be-500x500.svg",
];

const stepsText: Record<string, string[]> = {
  de: [
    "Sie kontaktieren uns über das Formular auf unserer Website",
    "Wir melden uns bei Ihnen und gehen Ihre Wünsche durch",
    "Sie planen mit uns zusammen Ihre Reise nach Zypern",
    "Wir besichtigen gemeinsam alle passenden Projekte",
    "Sie unterzeichnen den Kaufvertrag mit dem Bauunternehmer",
    "Nach Fertigstellung übergeben wir Ihnen feierlich die Schlüssel",
  ],
  en: [
    "You contact us via the form on our website",
    "We will contact you and discuss your requirements",
    "You plan your trip to Cyprus with us",
    "We visit all suitable projects together",
    "You sign the purchase agreement with the developer",
    "After completion, we will ceremoniously hand over the keys to you",
  ],
  pl: [
    "Skontaktuj się z nami za pomocą formularza na naszej stronie internetowej",
    "Wizyta na mieSkontaktujemy się z Tobą i omówimy Twoje życzeniajscu",
    "Zaplanuj z nami swoją podróż na Cypr",
    "Wspólnie odwiedzimy wszystkie odpowiednie projekty",
    "Podpisujesz umowę kupna z wykonawcą",
    "Po zakończeniu prac uroczyście przekażemy Państwu klucze",
  ],
  ru: [
    "Вы связываетесь с нами через форму на нашем сайте",
    "Мы быстро ответим вам и обсудим ваши пожелания",
    "Вы планируете свою поездку на Кипр вместе с нами",
    "Мы посетим все подходящие объекты вместе",
    "Вы подписываете договор купли-продажи с подрядчиком",
    "После завершения строительства мы торжественно передадим вам ключи",
  ],
};

const HowWeWorkBlockComponent: FC<Props> = ({ block, lang }) => {
  const { title, marginTop, marginBottom } = block;
  const texts = stepsText[lang] || stepsText.en;

  const computedMarginTop =
    marginTop && marginValues[marginTop] ? marginValues[marginTop] : "0";

  const computedMarginBottom =
    marginBottom && marginValues[marginBottom]
      ? marginValues[marginBottom]
      : "0";

  return (
    <section
      className={styles.howWeWorkBlock}
      style={{
        marginTop: computedMarginTop,
        marginBottom: computedMarginBottom,
      }}
    >
      <div className="container">
        <div className={styles.inner}>
          <h2 className="h2">{title}</h2>
          <div className={styles.steps}>
            {icons.map((icon, index) => (
              <div key={index} className={styles.step}>
                <div className={styles.icon}>
                  <Image
                    alt={texts[index]}
                    src={icon}
                    width={80}
                    height={80}
                    unoptimized
                    className={styles.icon}
                  />
                </div>
                <div className={styles.text}>
                  <p className={styles.title}>{texts[index]}</p>
                </div>
                {index < icons.length - 1 && (
                  <MdOutlineArrowCircleDown
                    size={35}
                    color="#bd8948"
                    className={styles.arrow}
                    aria-hidden="true"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowWeWorkBlockComponent;
