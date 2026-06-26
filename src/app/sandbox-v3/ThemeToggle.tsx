"use client";

import { useEffect, useState } from "react";

/** V3 dark/light toggle + quick links to V1 and V2 for comparison. */
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
      localStorage.setItem("cve-redesign-theme-v3", next);
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
      <a className="btn btn--glass" href="/sandbox" style={{ padding: "11px 16px" }}>V1</a>
      <a className="btn btn--glass" href="/sandbox-v2" style={{ padding: "11px 16px" }}>V2</a>
      <button
        type="button"
        onClick={flip}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        className="btn btn--gold"
        style={{ paddingLeft: 20 }}
      >
        <span style={{ fontWeight: 600 }}>{theme === "dark" ? "Dark" : "Light"}</span>
        <span className="btn__ico" aria-hidden>
          {theme === "dark" ? "☾" : "☀"}
        </span>
      </button>
    </div>
  );
}
