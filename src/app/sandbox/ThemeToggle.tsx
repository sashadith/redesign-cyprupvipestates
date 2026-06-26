"use client";

import { useEffect, useState } from "react";

/**
 * Dark/Light comparison toggle for the redesign sandbox + preview.
 * Evaluation aid only (per brief) — not a public theme switcher.
 * Persists to localStorage and flips [data-theme] on <html>.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const current =
      (document.documentElement.getAttribute("data-theme") as
        | "dark"
        | "light") || "dark";
    setTheme(current);
  }, []);

  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("cve-redesign-theme", next);
    } catch {}
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={flip}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      style={{
        position: "fixed",
        top: "var(--s-5)",
        right: "var(--gutter)",
        zIndex: 50,
      }}
      className="btn btn--ghost glass"
    >
      <span style={{ fontWeight: 500 }}>
        {theme === "dark" ? "Dark" : "Light"}
      </span>
      <span className="btn__ico" aria-hidden>
        {theme === "dark" ? "☾" : "☀"}
      </span>
    </button>
  );
}
