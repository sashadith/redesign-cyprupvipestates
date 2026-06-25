import React, { FC } from "react";
import { CitiesBlock } from "@/types/homepage";
import styles from "./CitiesHomepage.module.scss";
import Link from "next/link";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import { blurProps } from "@/lib/imageBlur";

type Props = {
  citiesBlock: CitiesBlock;
};

const CitiesHomepage: FC<Props> = ({ citiesBlock }) => {
  const { title, cities } = citiesBlock;

  return (
    <section className={styles.citiesHomepage}>
      <div className="container">
        <h2 className="h2">{title}</h2>
        <div className={styles.citiesWrapper}>
          {cities.map((city) => (
            <Link key={city._key} href={city.link} className={styles.cityCard}>
              <div className={styles.imageWrapper}>
                <Image
                  src={urlFor(city.image).url()}
                  alt={city.image.alt || city.city}
                  className={styles.image}
                  fill={true}
                  sizes="(max-width: 768px) 50vw, 320px"
                  {...blurProps(city.image)}
                />
              </div>
              <h3 className={styles.cityName}>{city.city}</h3>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CitiesHomepage;
