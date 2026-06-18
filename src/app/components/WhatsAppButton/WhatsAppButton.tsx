"use client";
import React, { FC } from "react";
import { FaWhatsapp } from "react-icons/fa";
import styles from "./WhatsAppButton.module.scss";

type Props = {
  lang: string;
};

const WhatsAppButton: FC<Props> = ({ lang }) => {
  const phone = "35799278285";

  const messages: Record<string, string> = {
    en: "Hello, I’m interested in buying property in Cyprus. Could you help me find suitable villas or apartments?",
    de: "Hallo, ich interessiere mich für den Kauf einer Immobilie auf Zypern. Bitte kontaktieren Sie mich.",
    pl: "Dzień dobry, interesuję się zakupem nieruchomości na Cyprze. Czy mogą mi Państwo doradzić odpowiednie wille lub apartamenty?",
    ru: "Здравствуйте! Я интересуюсь покупкой недвижимости на Кипре. Подскажите, пожалуйста, какие виллы или апартаменты доступны сейчас?",
  };

  const messageWithUrl: Record<string, string> = {
    en: `${messages.en}\n\nI'm sending this message from the page:`,
    de: `${messages.de}\n\nIch sende diese Nachricht von der Seite:`,
    pl: `${messages.pl}\n\nWiadomość wysyłam ze strony:`,
    ru: `${messages.ru}\n\nЯ отправляю это сообщение со страницы:`,
  };

  const label =
    lang === "en"
      ? "WhatsApp us now"
      : lang === "de"
        ? "WhatsApp senden"
        : lang === "pl"
          ? "Napisz do nas teraz"
          : lang === "ru"
            ? "Напишите нам сейчас"
            : "WhatsApp us";

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    if (typeof window !== "undefined") {
      const pageUrl = window.location.href;
      const message =
        (messageWithUrl[lang] || messageWithUrl.en) + ` ${pageUrl}`;
      const encodedText = encodeURIComponent(message);
      const finalUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodedText}`;

      if (window.fbq) {
        window.fbq("track", "Contact", {
          method: "whatsapp",
          placement: "floating_whatsapp_button",
          page_location: pageUrl,
        });
      }

      if (window.dataLayer) {
        window.dataLayer.push({
          event: "whatsapp_click",
          phone_number: phone,
          page_url: pageUrl,
          placement: "floating_whatsapp_button",
        });
      }

      window.open(finalUrl, "_blank");
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

export default WhatsAppButton;
