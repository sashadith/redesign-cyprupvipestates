import styles from "./LogosCarousel.module.scss";
import React, { FC } from "react";
import Link from "next/link";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import Marquee from "react-fast-marquee";
import { Logo } from "@/types/homepage";

type Props = {
  logos: Logo[];
};

const LogosCarousel: FC<Props> = ({ logos }) => {
  return (
    <div className={styles.logosCarousel}>
      <Marquee loop={0} gradient={false} speed={40} pauseOnHover={true}>
        {logos.map((logo) => (
          <div key={logo._key} className={styles.logoLink}>
            <Image
              alt={logo.image?.alt || "Property Developer in Cyprus"}
              title={logo.image?.alt || "Property Developer in Cyprus"}
              src={urlFor(logo).url()}
              width={250}
              height={200}
              unoptimized
              className={styles.logoIcon}
            />
          </div>
        ))}
      </Marquee>
    </div>
  );
};

export default LogosCarousel;
