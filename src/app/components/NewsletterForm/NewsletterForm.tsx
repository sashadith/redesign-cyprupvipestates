"use client";

import React, { useState, useEffect } from "react";
import styles from "./NewsletterForm.module.scss";

type NewsletterFormProps = {
  placeholder: string;
  buttonLabel: string;
  lang: string;
};

const NewsletterForm: React.FC<NewsletterFormProps> = ({
  placeholder,
  buttonLabel,
  lang,
}) => {
  const [email, setEmail] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);

  const supportedLanguages = ["en", "de", "pl", "ru"] as const;
  type SupportedLang = (typeof supportedLanguages)[number];

  const getValidatedLang = (lang: string): SupportedLang => {
    return supportedLanguages.includes(lang as SupportedLang)
      ? (lang as SupportedLang)
      : "en";
  };

  const getLocalizedMessage = (
    type: "success" | "error" | "invalid",
    lang: string
  ): string => {
    const validatedLang = getValidatedLang(lang);

    const messages = {
      en: {
        success: "You have successfully subscribed to our newsletter!",
        error: "Failed to subscribe. Please try again.",
        invalid: "Please enter a valid email address.",
      },
      de: {
        success:
          "Sie haben sich erfolgreich für unseren Newsletter angemeldet!",
        error: "Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.",
        invalid: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
      },
      pl: {
        success: "Pomyślnie zapisałeś się na nasz newsletter!",
        error: "Nie udało się zapisać. Spróbuj ponownie.",
        invalid: "Wprowadź poprawny adres e-mail.",
      },
      ru: {
        success: "Вы успешно подписались на нашу рассылку!",
        error: "Не удалось подписаться. Попробуйте еще раз.",
        invalid: "Пожалуйста, введите корректный адрес электронной почты.",
      },
    };

    return messages[validatedLang][type];
  };

  const handleNewsletterSubmit = async () => {
    if (!email) {
      setMessage(getLocalizedMessage("invalid", lang));
      return;
    }

    // Получение текущей даты и текущей страницы
    const currentDate = new Date().toISOString().split("T")[0]; // Формат YYYY-MM-DD
    const currentPage = window.location.href; // Текущий URL страницы

    try {
      const response = await fetch("/api/monday-newsletter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          currentDate,
          currentPage,
        }),
      });

      if (response.ok) {
        setMessage(getLocalizedMessage("success", lang));

        // GTM event
        if (typeof window !== "undefined" && window.dataLayer) {
          window.dataLayer.push({
            event: "newsletter_subscribe",
            page_url: window.location.href,
          });
        }

        setEmail(""); // Очистка поля
      } else {
        const errorData = await response.json();
        setMessage(errorData.error || getLocalizedMessage("error", lang));
      }
    } catch (error) {
      console.error("Error subscribing to newsletter:", error);
      setMessage(getLocalizedMessage("error", lang));
    }
  };

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [message]);

  return (
    <div className={styles.newsLetterForm}>
      <input
        type="email"
        placeholder={placeholder}
        className={styles.newsLetterInput}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button
        className={styles.newsLetterButton}
        onClick={handleNewsletterSubmit}
      >
        {buttonLabel}
      </button>
      {message && <p className={styles.message}>{message}</p>}
    </div>
  );
};

export default NewsletterForm;
