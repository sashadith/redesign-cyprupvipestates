"use client";
import React, { FC } from "react";
import { FaWhatsapp } from "react-icons/fa";
import styles from "./WhatAppButtonProject.module.scss";
import { isLocale } from "@/lib/locale";
import { messageWithUrl, label as labelByLang } from "./WhatAppButtonProject.copy";

type Props = {
  lang: string;
};

const WhatAppButtonProject: FC<Props> = ({ lang }) => {
  const phone = "35799278285";

  const label = labelByLang[isLocale(lang) ? lang : "en"];

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    if (typeof window !== "undefined") {
      const pageUrl = window.location.href;
      const message =
        (messageWithUrl[isLocale(lang) ? lang : "en"]) + ` ${pageUrl}`;
      const encodedText = encodeURIComponent(message);
      const finalUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodedText}`;

      if (window.fbq) {
        window.fbq("track", "Contact", {
          method: "whatsapp",
          placement: "project_whatsapp_button",
          page_location: pageUrl,
        });
      }

      if (
        typeof window !== "undefined" &&
        typeof (window as any).lintrk === "function"
      ) {
        (window as any).lintrk("track", {
          conversion_id: 27871529,
        });
      }

      if (window.dataLayer) {
        window.dataLayer.push({
          event: "whatsapp_click",
          phone_number: phone,
          page_url: pageUrl,
          placement: "project_whatsapp_button",
        });
      }

      setTimeout(() => {
        window.open(finalUrl, "_blank");
      }, 100);
    }
  };

  return (
    <a
      href="#"
      onClick={handleClick}
      className={styles.whatsappButton}
      aria-label={label}
    >
      <FaWhatsapp size={20} />
      <span className={styles.label}>{label}</span>
    </a>
  );
};

export default WhatAppButtonProject;
