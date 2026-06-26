import ThemeToggle from "./ThemeToggle";

/* Version 2 — Ethereal-Glass direction. Obsidian base, saturated gold,
   layered glass + glow + grain. Same content sections as V1 for comparison.
   Isolated route, noindexed, no DB. V1 stays untouched at /sandbox. */

const BRAND = [
  { name: "Gold", hex: "#D8A23C", v: "--gold" },
  { name: "Gold Lum", hex: "#F4CE76", v: "--gold-lum" },
  { name: "Gold Deep", hex: "#9C6F27", v: "--gold-deep" },
  { name: "Obsidian", hex: "#0D0B12", v: "--obsidian" },
  { name: "Surface", hex: "#15121C", v: "--surface" },
  { name: "Ivory", hex: "#F3EEE6", v: "--ivory" },
  { name: "Bone", hex: "#F3EEE4", v: "--bone" },
];

const SEMANTIC = [
  { name: "bg", v: "--bg" },
  { name: "surface", v: "--surface" },
  { name: "text", v: "--text" },
  { name: "accent", v: "--accent" },
  { name: "hairline", v: "--hairline-gold" },
];

const LANGS = [
  { tag: "EN", head: "Luxury property in Cyprus", glyph: "A a — & 1234" },
  { tag: "DE", head: "Exklusive Immobilien auf Zypern", glyph: "ä ö ü ß Ä Ö Ü" },
  { tag: "PL", head: "Ekskluzywne nieruchomości na Cyprze", glyph: "ł ą ę ż ź ć ń ó ś" },
  { tag: "RU", head: "Эксклюзивная недвижимость на Кипре", glyph: "Д Л У Ж щ ъ ё" },
];

const Arrow = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
    <path d="M3 11L11 3M11 3H5M11 3V9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function SandboxV2Page() {
  return (
    <main>
      <div className="grain" aria-hidden />
      <ThemeToggle />

      {/* ---- header ---- */}
      <header className="section wrap">
        <p className="eyebrow reveal">Version 2 · Ethereal Glass</p>
        <h1 className="display reveal" style={{ marginTop: "var(--s-5)", animationDelay: "60ms" }}>
          Cyprus, <span className="it">brilliantly</span> done.
        </h1>
        <p className="lead reveal" style={{ marginTop: "var(--s-5)", animationDelay: "120ms" }}>
          A richer direction — obsidian and saturated gold, layered glass with depth and glow,
          mesh-gradient atmosphere and a high-contrast serif. The same brand spirit, turned up.
        </p>
        <div className="row reveal" style={{ marginTop: "var(--s-6)", animationDelay: "180ms" }}>
          <a className="btn btn--primary" href="#type">
            <span>Explore the system</span>
            <span className="btn__ico"><Arrow /></span>
          </a>
          <a className="btn btn--ghost" href="#components">Components</a>
        </div>
      </header>

      {/* ---- color ---- */}
      <section className="section wrap" id="color">
        <p className="eyebrow">01 — Color</p>
        <h2 className="h2" style={{ marginTop: "var(--s-5)" }}>Saturated gold on obsidian</h2>
        <p className="body" style={{ marginTop: "var(--s-4)" }}>
          A warmer, brighter gold than V1, set on a deep plum-obsidian so it reads as light, not paint.
          Brand constants below; semantic tokens swap with the theme.
        </p>

        <p className="lang-tag" style={{ marginTop: "var(--s-7)" }}>Brand constants</p>
        <div className="swatch-grid" style={{ marginTop: "var(--s-4)" }}>
          {BRAND.map((c) => (
            <div className="swatch" key={c.v}>
              <div className="swatch__chip" style={{ background: c.hex }} />
              <div className="swatch__meta"><b>{c.name}</b><span>{c.hex}</span></div>
            </div>
          ))}
        </div>

        <p className="lang-tag" style={{ marginTop: "var(--s-7)" }}>Semantic (theme-aware)</p>
        <div className="swatch-grid" style={{ marginTop: "var(--s-4)" }}>
          {SEMANTIC.map((c) => (
            <div className="swatch" key={c.v}>
              <div className="swatch__chip" style={{ background: `var(${c.v})` }} />
              <div className="swatch__meta"><b>{c.name}</b><span>{c.v}</span></div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- typography ---- */}
      <section className="section wrap" id="type">
        <p className="eyebrow">02 — Typography</p>
        <h2 className="h2" style={{ marginTop: "var(--s-5)" }}>Fraunces · Manrope</h2>

        <div className="stack" style={{ marginTop: "var(--s-7)" }}>
          <div><p className="caption">Display · clamp 3.2→6rem</p><p className="display">Aa Brilliantly precise</p></div>
          <div><p className="caption">H1 · clamp 2.7→4.6rem</p><p className="h1">An advisor, not an agent</p></div>
          <div><p className="caption">H2 · clamp 2→3.25rem</p><p className="h2">Buyer-side, on insider terms</p></div>
          <div><p className="caption">H3 · clamp 1.5→2.05rem</p><p className="h3">The private briefing</p></div>
          <div><p className="caption">Lead · Manrope 300</p><p className="lead">We guide international buyers through Cyprus property — discreetly, securely, and on your side of the table.</p></div>
        </div>

        <hr className="divider-gold" style={{ marginBlock: "var(--s-8)" }} />

        <p className="eyebrow">Multilingual — DE · PL · RU</p>
        <p className="body" style={{ marginTop: "var(--s-4)" }}>
          Fraunces covers Latin-ext (PL). RU has no Cyrillic in Fraunces, so it resolves to Playfair Display per-glyph.
        </p>
        <div className="grid-2" style={{ marginTop: "var(--s-6)" }}>
          {LANGS.map((l) => (
            <div className="muted-panel" key={l.tag}>
              <span className="lang-tag">{l.tag}</span>
              <p className="h3" style={{ marginTop: "var(--s-3)" }}>{l.head}</p>
              <p className="display" style={{ fontSize: "2.5rem", marginTop: "var(--s-4)" }}>{l.glyph}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- components ---- */}
      <section className="section wrap" id="components">
        <p className="eyebrow">03 — Components</p>
        <h2 className="h2" style={{ marginTop: "var(--s-5)" }}>Glass, glow &amp; depth</h2>

        <div className="row" style={{ marginTop: "var(--s-7)" }}>
          <a className="btn btn--primary" href="#">
            <span>Book a buyer consultation</span>
            <span className="btn__ico"><Arrow /></span>
          </a>
          <a className="btn btn--ghost" href="#">View the process</a>
        </div>

        <div className="grid-2" style={{ marginTop: "var(--s-8)" }}>
          <div
            className="glass-stage"
            style={{ backgroundImage: "linear-gradient(135deg, #2a2030 0%, #0d0b12 50%, #3a2a18 100%)" }}
          >
            <div className="glass glass--gold" style={{ maxWidth: 380 }}>
              <p className="eyebrow">Frosted</p>
              <p className="h3" style={{ marginTop: "var(--s-4)", color: "var(--ivory)" }}>Legible on glass</p>
              <p style={{ marginTop: "var(--s-3)", color: "rgba(243,238,230,.82)", fontSize: "var(--text-sm)" }}>
                blur(20px) + scrim + gold glow ring. Solid fallback where backdrop-filter is unsupported.
              </p>
            </div>
          </div>

          <div className="bezel">
            <div className="bezel__core stack-sm">
              <p className="eyebrow">Since 2007</p>
              <p className="display" style={{ fontSize: "3.2rem", lineHeight: 1 }}>12<span className="it">+</span></p>
              <p className="body" style={{ margin: 0 }}>
                Mandates a year. Nested double-bezel glass with concentric radii, inner highlight and a glowing gold rule.
              </p>
              <hr className="divider-gold" />
              <p className="caption" style={{ margin: 0 }}>Outer shell · inner core · gold glow</p>
            </div>
          </div>
        </div>

        <div className="grid-3" style={{ marginTop: "var(--s-6)" }}>
          {[
            ["Independent lawyers", "Every legal step handled by licensed Cypriot lawyers."],
            ["No markup to you", "Remunerated by developers — never a fee on your side."],
            ["Off-market access", "A curated shortlist, not a public listings wall."],
          ].map(([t, d]) => (
            <div className="glass" key={t as string}>
              <p className="h3" style={{ fontSize: "1.3rem" }}>{t}</p>
              <p className="body" style={{ marginTop: "var(--s-3)", marginBottom: 0, fontSize: "var(--text-sm)" }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- spacing ---- */}
      <section className="section wrap" id="spacing">
        <p className="eyebrow">04 — Spacing &amp; rhythm</p>
        <h2 className="h2" style={{ marginTop: "var(--s-5)" }}>Strict 8px system</h2>
        <div className="ruler" style={{ marginTop: "var(--s-6)" }}>
          {[["--s-2", 8], ["--s-4", 16], ["--s-5", 24], ["--s-6", 32], ["--s-7", 48], ["--s-8", 64], ["--s-9", 96]].map(
            ([v, px]) => (
              <div className="ruler__row" key={v as string}>
                <span style={{ width: 56 }}>{px}px</span>
                <span className="ruler__bar" style={{ width: `var(${v as string})` }} />
                <span>{v as string}</span>
              </div>
            )
          )}
        </div>
      </section>

      <footer className="section wrap">
        <p className="caption">
          Version 2 · isolated · noindexed · obsidian + saturated gold · glass &amp; glow.
          Grain and atmosphere disable under prefers-reduced-motion. V1 lives at /sandbox.
        </p>
      </footer>
    </main>
  );
}
