"use client";

import React, { useEffect, useState } from "react";

/* Footer newsletter (redesign look) — keeps the previous live NewsletterForm
   behaviour verbatim: POST /api/monday-newsletter, honeypot + formStartTime
   anti-spam, GTM "newsletter_subscribe", and the localized success/error/invalid
   messages (en/de/pl/ru). Only the markup/classes changed for the new design. */

const supportedLanguages = ["en", "de", "pl", "ru"] as const;
type SupportedLang = (typeof supportedLanguages)[number];

const getValidatedLang = (lang: string): SupportedLang =>
  supportedLanguages.includes(lang as SupportedLang) ? (lang as SupportedLang) : "en";

const MESSAGES: Record<SupportedLang, Record<"success" | "error" | "invalid", string>> = {
  en: {
    success: "You have successfully subscribed to our newsletter!",
    error: "Failed to subscribe. Please try again.",
    invalid: "Please enter a valid email address.",
  },
  de: {
    success: "Sie haben sich erfolgreich für unseren Newsletter angemeldet!",
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

const msg = (type: "success" | "error" | "invalid", lang: string) =>
  MESSAGES[getValidatedLang(lang)][type];

export default function FooterNewsletter({
  placeholder,
  buttonLabel,
  lang = "en",
}: {
  placeholder: string;
  buttonLabel: string;
  lang?: string;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [company, setCompany] = useState(""); // honeypot — must stay empty
  const [formStartTime] = useState<number>(() => Date.now());

  const submit = async () => {
    const e = email.trim();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setMessage(msg("invalid", lang));
      return;
    }
    const currentDate = new Date().toISOString().split("T")[0];
    const currentPage = window.location.href;
    try {
      const res = await fetch("/api/monday-newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, currentDate, currentPage, lang, company, formStartTime }),
      });
      if (res.ok) {
        setMessage(msg("success", lang));
        if (typeof window !== "undefined" && window.dataLayer) {
          window.dataLayer.push({ event: "newsletter_subscribe", page_url: window.location.href });
        }
        setEmail("");
      } else {
        const d = await res.json().catch(() => ({}));
        setMessage(d.error || msg("error", lang));
      }
    } catch (err) {
      console.error("Newsletter error:", err);
      setMessage(msg("error", lang));
    }
  };

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(t);
  }, [message]);

  return (
    <form
      className="pf__news-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="pf__news-row">
        <input
          type="email"
          placeholder={placeholder}
          className="pf__news-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {/* honeypot — hidden from real users; bots that fill it are rejected server-side */}
        <input
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
        />
        <button type="submit" className="btn btn--glass pf__news-btn">
          {buttonLabel}
        </button>
      </div>
      {message && (
        <p className="pf__news-msg" role="alert" aria-live="assertive">
          {message}
        </p>
      )}
    </form>
  );
}
