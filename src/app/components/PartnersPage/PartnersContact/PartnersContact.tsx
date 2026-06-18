import React, { FC } from "react";
import styles from "./PartnersContact.module.scss";
import FormPartners from "../../FormPartners/FormPartners";
import { FormStandardDocument } from "@/types/formStandardDocument";
import { Oswald } from "next/font/google";
import Image from "next/image";
import FadeUpAnimate from "../../FadeUpAnimate/FadeUpAnimate";

const oswald = Oswald({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400"],
});

type Props = {
  lang: string;
  form: FormStandardDocument;
};

type PartnersContactTranslation = {
  titleStart: string;
  titleHighlight: string;
  titleEnd: string;
};

const translations: Record<string, PartnersContactTranslation> = {
  de: {
    titleStart: "Registriere ",
    titleHighlight: "dich",
    titleEnd: " als partner!",
  },
  en: {
    titleStart: "Register ",
    titleHighlight: "now",
    titleEnd: " as a partner!",
  },
  pl: {
    titleStart: "Zarejestruj ",
    titleHighlight: "się",
    titleEnd: " jako partner!",
  },
  ru: {
    titleStart: "Зарегистрируйся ",
    titleHighlight: "сейчас",
    titleEnd: " как партнёр!",
  },
};

const PartnersContact: FC<Props> = ({ lang, form }) => {
  const t = translations[lang] ?? translations["de"];

  return (
    <section className={styles.contacts}>
      <div className="container">
        <div className={styles.contactsBlock}>
          <div className={styles.contactsWrapper}>
            <h2 className={`${styles.title} ${oswald.className}`}>
              {t.titleStart}
              <span className={styles.highlight}>{t.titleHighlight}</span>
              {t.titleEnd}
            </h2>
            <FadeUpAnimate>
              <div className={styles.formContainer}>
                <FormPartners lang={lang} form={form} />
              </div>
            </FadeUpAnimate>
          </div>
          <Image
            src="/uploads/files/f8e80269dea26143ecd6c4f26bf204a1fc78fe4e.png"
            alt="Partnering with Cyprus VIP Estates"
            width={416}
            height={850}
            className={styles.imageOne}
          />
          <Image
            src="/uploads/files/5dec9449a1856a42ed6aacf8bf2e9d0dadbb0b29.png"
            alt="Partnering with Cyprus VIP Estates"
            width={323}
            height={610}
            className={styles.imageTwo}
          />
        </div>
      </div>
    </section>
  );
};

export default PartnersContact;
