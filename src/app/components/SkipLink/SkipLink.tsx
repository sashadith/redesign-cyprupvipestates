"use client";

import React from "react";

type SkipLinkProps = {
  label: string;
};

/**
 * Accessible "skip to main content" link.
 *
 * Rendered as the first focusable element in <body>, it stays visually hidden
 * (see `.skip-to-main` in globals.css) until it receives keyboard focus.
 * It targets the page's <main> landmark at click time via querySelector, so no
 * per-page markup change is required — a single global implementation.
 */
const SkipLink: React.FC<SkipLinkProps> = ({ label }) => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const main = document.querySelector("main");
    if (!main) return;

    // <main> isn't normally focusable; make it programmatically focusable,
    // move focus there, then bring it into view (instant — no smooth scroll).
    if (!main.hasAttribute("tabindex")) {
      main.setAttribute("tabindex", "-1");
    }
    (main as HTMLElement).focus();
    main.scrollIntoView();
  };

  return (
    <a href="#main" className="skip-to-main" onClick={handleClick}>
      {label}
    </a>
  );
};

export default SkipLink;
