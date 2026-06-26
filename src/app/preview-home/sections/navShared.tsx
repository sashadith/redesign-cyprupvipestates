import React from "react";

/* Shared nav data + lightweight SVG icons (no icon library). Used by the
   desktop Nav, the LangSwitch, and the mobile menu. Language is text-only. */

export const MOBILE_LOGO = "/uploads/images/c4911e6ba6654becbeda47f9485754fbcfeb407e-500x634.png";

/* [code, label] — displayed as text, no flags */
export const LANGS: [string, string][] = [
  ["EN", "English"],
  ["DE", "Deutsch"],
  ["PL", "Polski"],
  ["RU", "Русский"],
];

export const Globe = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.2" />
    <path d="M3 12h18M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

export const ChevronDown = ({ className }: { className?: string }) => (
  <svg className={className} width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
    <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
