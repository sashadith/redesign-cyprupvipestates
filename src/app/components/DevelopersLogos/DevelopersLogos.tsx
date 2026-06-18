import { Logo } from "@/types/homepage";
import React, { FC } from "react";
import styles from "./DevelopersLogos.module.scss";
import LogosCarousel from "../LogosCarousel/LogosCarousel";

type Props = {
  logos: Logo[];
  lang: string;
};

const DevelopersLogos: FC<Props> = ({ logos, lang }) => {
  if (!logos || logos.length === 0) {
    return null;
  }

  return (
    <section className={styles.develpersLogos}>
      <div className="container">
        {/* <h2 className="h2-white">
          {lang === "de"
            ? "Die besten Entwickler Zyperns vertrauen uns"
            : lang === "ru"
              ? "Мы работаем с ведущими застройщиками Кипра"
              : lang === "pl"
                ? "Współpracujemy z najlepszymi deweloperami na Cyprze"
                : "We work with the best developers in Cyprus"}
        </h2> */}
      </div>
      <LogosCarousel logos={logos} />
    </section>
  );
};

export default DevelopersLogos;
