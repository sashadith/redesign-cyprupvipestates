"use client";
import React from "react";
import "./leadForm.css";

/* "Contact me by" as one segmented row (operator, 2026-11-01): replaces the
   three pill radios on every public lead form. Real radio inputs underneath
   (keyboard, screen readers, Formik's name/value); only the look is new.
   The picked segment turns WhatsApp green for WhatsApp, bronze otherwise. */

export type ContactChannel = "phone" | "whatsapp" | "email";

const ICONS: Record<ContactChannel, React.ReactNode> = {
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
  whatsapp: (
    <>
      <path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4z" />
      <path d="M9 8.6c0 3.3 3 6.4 6.4 6.4l1-1.5-2-1-1 .9c-1-.4-2.4-1.8-2.8-2.8l.9-1-1-2z" strokeWidth="1.5" />
    </>
  ),
  email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
    </>
  ),
};

const ORDER: ContactChannel[] = ["phone", "whatsapp", "email"];

export function ContactPicker({ name, value, onChange, onBlur, legend, labels, className }: {
  name: string;
  value: string;
  onChange: (v: ContactChannel) => void;
  onBlur?: () => void;
  legend: React.ReactNode;
  labels: Record<ContactChannel, string>;
  className?: string;
}) {
  return (
    <fieldset className={`lf-contact${className ? ` ${className}` : ""}`}>
      <legend className="lf-contact__legend">{legend}</legend>
      <div className="lf-contact__seg">
        {ORDER.map((c) => (
          <label key={c} className={`lf-contact__opt lf-contact__opt--${c}`}>
            <input type="radio" name={name} value={c} checked={value === c} onChange={() => onChange(c)} onBlur={onBlur} />
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[c]}</svg>
            <span>{labels[c]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
