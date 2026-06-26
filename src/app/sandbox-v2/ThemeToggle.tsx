"use client";

import { useEffect, useState } from "react";

/** V2 dark/light toggle + a quick link back to V1 for comparison. */
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
      localStorage.setItem("cve-redesign-theme-v2", next);
    } catch {}
    setTheme(next);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: "var(--s-5)",
        right: "var(--gutter)",
        zIndex: 50,
        display: "flex",
        gap: "var(--s-3)",
        alignItems: "center",
      }}
    >
      <a className="btn btn--ghost" href="/sandbox" style={{ padding: "11px 18px" }}>
        ← V1
      </a>
      <button
        type="button"
        onClick={flip}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        className="btn btn--primary"
        style={{ paddingLeft: 20 }}
      >
        <span style={{ fontWeight: 500 }}>{theme === "dark" ? "Dark" : "Light"}</span>
        <span className="btn__ico" aria-hidden>
          {theme === "dark" ? "☾" : "☀"}
        </span>
      </button>
    </div>
  );
}
