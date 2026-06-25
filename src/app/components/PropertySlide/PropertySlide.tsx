import { ImageAlt } from "@/types/property";
import React, { FC } from "react";
import styles from "./PropertySlide.module.scss";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import { blurProps } from "@/lib/imageBlur";

type Props = {
  image: ImageAlt;
};

const PropertySlide: FC<Props> = ({ image }) => {
  return (
    <div className={styles.propertySlide}>
      <Image
        src={urlFor(image).url()}
        alt={image.alt || "default alt text"}
        className={styles.image}
        fill={true}
        sizes="100vw"
        {...blurProps(image)}
      />
    </div>
  );
};

export default PropertySlide;
