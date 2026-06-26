"use client";

import { useEffect, useState } from "react";

/* V5 control cluster: theme (dark/light), palette (gold/green ↔ gold/blue),
   and a 5-way font-set switch for comparison. All persist to localStorage. */

const FONT_SETS = [
  { id: "1", name: "Cormorant · Manrope" },
  { id: "2", name: "Fraunces · Mulish" },
  { id: "3", name: "EB Garamond · Onest" },
  { id: "4", name: "Forum · Commissioner" },
  { id: "5", name: "Tenor Sans · Spectral" },
];

export default function Controls() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [palette, setPalette] = useState<"green" | "blue">("green");
  const [font, setFont] = useState(0);

  useEffect(() => {
    const d = document.documentElement;
    setTheme((d.getAttribute("data-theme") as "dark" | "light") || "dark");
    setPalette((d.getAttribute("data-palette") as "green" | "blue") || "green");
    const idx = FONT_SETS.findIndex((f) => f.id === d.getAttribute("data-font"));
    setFont(idx < 0 ? 0 : idx);
  }, []);

  const set = (attr: string, val: string, key: string) => {
    document.documentElement.setAttribute(attr, val);
    try {
      localStorage.setItem(key, val);
    } catch {}
  };

  const flipTheme = () => {
    const n = theme === "dark" ? "light" : "dark";
    set("data-theme", n, "cve-v5-theme");
    setTheme(n);
  };
  const flipPalette = () => {
    const n = palette === "green" ? "blue" : "green";
    set("data-palette", n, "cve-v5-palette");
    setPalette(n);
  };
  const nextFont = () => {
    const n = (font + 1) % FONT_SETS.length;
    set("data-font", FONT_SETS[n].id, "cve-v5-font");
    setFont(n);
  };

  const wrap: React.CSSProperties = {
    position: "fixed",
    top: "var(--s-5)",
    right: "var(--gutter)",
    zIndex: 50,
    display: "flex",
    gap: "var(--s-3)",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    maxWidth: "min(92vw, 760px)",
  };
  const mini: React.CSSProperties = { padding: "11px 16px" };

  return (
    <div style={wrap}>
      <a className="btn btn--ghost" href="/sandbox" style={mini}>← V1</a>

      <button type="button" onClick={nextFont} className="btn btn--ghost" style={mini}
        aria-label="Switch font set" title="Cycle font pairings">
        <span style={{ color: "var(--text-faint)", marginRight: 8 }}>Aa {font + 1}/5</span>
        <span>{FONT_SETS[font].name}</span>
      </button>

      <button type="button" onClick={flipPalette} className="btn btn--ghost" style={mini}
        aria-label="Switch colour palette">
        <span className="btn__ico" aria-hidden
          style={{ width: 18, height: 18, borderRadius: 5, background: palette === "green" ? "#081512" : "#060F22", boxShadow: "inset 0 0 0 1px var(--accent)" }} />
        <span>{palette === "green" ? "Green" : "Blue"}</span>
      </button>

      <button type="button" onClick={flipTheme} className="btn btn--primary" style={{ paddingLeft: 20 }}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
        <span style={{ fontWeight: 500 }}>{theme === "dark" ? "Dark" : "Light"}</span>
        <span className="btn__ico" aria-hidden>{theme === "dark" ? "☾" : "☀"}</span>
      </button>
    </div>
  );
}
