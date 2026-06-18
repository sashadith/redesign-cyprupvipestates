"use client";
import React, { useState, useEffect } from "react";
import { useWindowScroll } from "react-use";
import styles from "./ParallaxImage.module.scss";
import { Image as ImageType } from "@/types/homepage";
import { urlFor } from "@/sanity/sanity.client";

type Props = {
  image: ImageType;
};

const ParallaxImage: React.FC<Props> = ({ image }) => {
  const { y } = useWindowScroll();

  const [isIOSMobile, setIsIOSMobile] = useState(false);

  useEffect(() => {
    const isMobile = typeof window !== "undefined" && window.innerWidth <= 480;
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    setIsIOSMobile(isMobile && isIOS);
  }, []);

  const imageUrl = urlFor(image).url();

  return isIOSMobile ? (
    <img src={imageUrl} alt="" className={styles.imageMobile} />
  ) : (
    <div
      className={styles.parallax}
      style={{
        backgroundImage: `url(${imageUrl})`,
      }}
    />
  );
};

export default ParallaxImage;
