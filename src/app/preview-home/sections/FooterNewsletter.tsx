"use client";

import React, { useState, useEffect } from "react";

/* Footer newsletter — preview restyle of NewsletterForm, keeping the submission
   (/api/monday-newsletter), honeypot, formStartTime + GTM tracking. EN-only
   messages in the preview. */

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
      setMessage("Please enter a valid email address.");
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
        setMessage("You have successfully subscribed to our newsletter.");
        if (typeof window !== "undefined" && window.dataLayer) {
          window.dataLayer.push({ event: "newsletter_subscribe", page_url: window.location.href });
        }
        setEmail("");
      } else {
        const d = await res.json().catch(() => ({}));
        setMessage(d.error || "Failed to subscribe. Please try again.");
      }
    } catch (err) {
      console.error("Newsletter error:", err);
      setMessage("Failed to subscribe. Please try again.");
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
        {/* honeypot */}
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
        <button type="submit" className="btn btn--glass pf__news-btn">{buttonLabel}</button>
      </div>
      {message && <p className="pf__news-msg" role="alert" aria-live="assertive">{message}</p>}
    </form>
  );
}
