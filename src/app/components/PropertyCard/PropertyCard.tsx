import { urlFor } from "@/sanity/sanity.client";
import { Property } from "@/types/property";
import Image from "next/image";
import Link from "next/link";
import React, { FC } from "react";
import styles from "./PropertyCard.module.scss";

type Props = {
  property: Property;
  lang: string;
};

const PropertyCard: FC<Props> = ({ property, lang }) => {
  return (
    <Link
      href={`/${lang}/properties/${property.slug[lang]?.current}`}
      className={styles.card}
    >
      <div className={styles.cardWrapper}>
        <div className={styles.imageBlock}>
          <div className={styles.city}>{property.city}</div>
          {property.images?.[0] && (
            <Image
              src={urlFor(property.images[0]).url()} // Обновите путь к картинке в соответствии с вашей структурой
              alt={property.title}
              fill={true}
              className={styles.image}
              sizes="(max-width: 768px) 100vw, 360px"
            />
          )}
        </div>
        <div className={styles.contentBlock}>
          <p className={styles.title}>{property.title}</p>
          <div className={styles.button}>
            {property.price.toLocaleString("en-US")} €
          </div>
        </div>
      </div>
    </Link>
  );
};

export default PropertyCard;
