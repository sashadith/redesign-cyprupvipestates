import { Logo } from "@/types/homepage";
import React, { FC } from "react";
import styles from "./DevelopersLogos.module.scss";
import LogosCarousel from "../LogosCarousel/LogosCarousel";
import { developersLogosCopy } from "./DevelopersLogos.copy";

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
        {/* <h2 className="h2-white">{developersLogosCopy(lang).trustedBy}</h2> */}
      </div>
      <LogosCarousel logos={logos} />
    </section>
  );
};

export default DevelopersLogos;
