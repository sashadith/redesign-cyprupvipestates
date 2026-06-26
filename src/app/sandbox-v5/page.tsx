import ThemeToggle from "./ThemeToggle";

/* Phase-0 design-system sandbox. Demonstrates the redesign language
   (color, type, spacing, buttons, glass, motion) in dark + light.
   Isolated route — no DB, no brand globals, noindexed. */

const BRAND = [
  { name: "Sea Deep", hex: "#081512", v: "--sea-deep" },
  { name: "Sea", hex: "#102826", v: "--sea" },
  { name: "Paper", hex: "#F5F1E8", v: "--paper" },
  { name: "Paper 2", hex: "#EDE7D9", v: "--paper-2" },
  { name: "Ink", hex: "#221C15", v: "--ink-warm" },
  { name: "Ivory", hex: "#EFE9DB", v: "--ivory" },
  { name: "Champagne", hex: "#C29A5E", v: "--champagne" },
  { name: "Bronze", hex: "#8E6B3D", v: "--bronze" },
];

const SEMANTIC = [
  { name: "bg", v: "--bg" },
  { name: "surface", v: "--surface" },
  { name: "text", v: "--text" },
  { name: "accent", v: "--accent" },
  { name: "hairline", v: "--hairline-strong" },
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

export default function SandboxPage() {
  return (
    <main>
      <ThemeToggle />

      {/* ---- header ---- */}
      <header className="section wrap">
        <p className="eyebrow reveal">Version 5 · Quiet glow · rounder</p>
        <h1 className="display reveal" style={{ marginTop: "var(--s-5)", animationDelay: "60ms" }}>
          Cyprus, <span className="it">quietly</span> done.
        </h1>
        <hr className="shimmer reveal" style={{ marginTop: "var(--s-5)", animationDelay: "100ms", maxWidth: 260 }} />
        <p className="lead reveal" style={{ marginTop: "var(--s-5)", animationDelay: "140ms" }}>
          The redesign foundation: one token system, two themes. Editorial serif display,
          calm space, and gold used only as an accent — never a surface. Toggle dark/light, top-right.
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
        <h2 className="h2" style={{ marginTop: "var(--s-4)" }}>Palette &amp; semantic roles</h2>
        <p className="body" style={{ marginTop: "var(--s-4)" }}>
          Brand constants never change. Semantic tokens below swap with the theme — that is the
          entire light/dark mechanism (no second design).
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
        <h2 className="h2" style={{ marginTop: "var(--s-4)" }}>Cormorant Garamond · Manrope</h2>

        <div className="stack" style={{ marginTop: "var(--s-7)" }}>
          <div><p className="caption">Display · clamp 3→5.5rem</p><p className="display">Aa Quietly precise</p></div>
          <div><p className="caption">H1 · clamp 2.6→4.25rem</p><p className="h1">An advisor, not an agent</p></div>
          <div><p className="caption">H2 · clamp 1.95→3rem</p><p className="h2">Buyer-side, on insider terms</p></div>
          <div><p className="caption">H3 · clamp 1.45→1.95rem</p><p className="h3">The private briefing</p></div>
          <div><p className="caption">Lead · Manrope 300</p><p className="lead">We guide international buyers through Cyprus property — discreetly, securely, and on your side of the table.</p></div>
          <div><p className="caption">Body · Manrope 300</p><p className="body">Independent licensed lawyers handle every legal step. We are remunerated by the developers, at no markup to you.</p></div>
        </div>

        <hr className="divider-gold" style={{ marginBlock: "var(--s-8)" }} />

        {/* mandatory multilingual glyph verification */}
        <p className="eyebrow">Multilingual verification — DE · PL · RU diacritics &amp; Cyrillic</p>
        <p className="body" style={{ marginTop: "var(--s-4)" }}>
          Cormorant covers Latin-ext (PL). RU has no Cyrillic in Cormorant, so it resolves
          per-glyph to Playfair Display. Judge the RU display treatment here.
        </p>
        <div className="grid-2" style={{ marginTop: "var(--s-6)" }}>
          {LANGS.map((l) => (
            <div className="muted-panel" key={l.tag}>
              <span className="lang-tag">{l.tag}</span>
              <p className="h3" style={{ marginTop: "var(--s-3)" }}>{l.head}</p>
              <p className="display" style={{ fontSize: "2.4rem", marginTop: "var(--s-4)" }}>{l.glyph}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- components ---- */}
      <section className="section wrap" id="components">
        <p className="eyebrow">03 — Components</p>
        <h2 className="h2" style={{ marginTop: "var(--s-4)" }}>Buttons, glass &amp; nested architecture</h2>

        <div className="row" style={{ marginTop: "var(--s-7)" }}>
          <a className="btn btn--primary" href="#">
            <span>Book a buyer consultation</span>
            <span className="btn__ico"><Arrow /></span>
          </a>
          <a className="btn btn--ghost" href="#">View the process</a>
        </div>

        <div className="grid-2" style={{ marginTop: "var(--s-8)" }}>
          {/* glass over imagery */}
          <div
            className="glass-stage"
            style={{ backgroundImage: "linear-gradient(135deg, #1d3b39 0%, #0d2221 45%, #3a2f22 100%)" }}
          >
            <div className="glass" style={{ maxWidth: 360 }}>
              <p className="eyebrow on-dark" style={{ color: "var(--accent)" }}>Frosted</p>
              <p className="h3" style={{ marginTop: "var(--s-3)", color: "var(--ivory)" }}>Legible on glass</p>
              <p style={{ marginTop: "var(--s-3)", color: "rgba(239,233,219,.82)", fontSize: "var(--text-sm)" }}>
                backdrop-blur(16px) + scrim. Falls back to a solid panel where unsupported.
              </p>
            </div>
          </div>

          {/* double-bezel card */}
          <div className="bezel">
            <div className="bezel__core stack-sm">
              <p className="eyebrow">Since 2007</p>
              <p className="h3">A dozen mandates a year</p>
              <p className="body" style={{ margin: 0 }}>
                Nested &ldquo;double-bezel&rdquo; enclosure with concentric radii and an inner highlight —
                used sparingly, for a single hero stat or feature.
              </p>
              <hr className="divider-gold" />
              <p className="caption" style={{ margin: 0 }}>Outer shell · inner core · 1px hairline</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---- spacing ---- */}
      <section className="section wrap" id="spacing">
        <p className="eyebrow">04 — Spacing &amp; rhythm</p>
        <h2 className="h2" style={{ marginTop: "var(--s-4)" }}>Strict 8px system</h2>
        <p className="body" style={{ marginTop: "var(--s-4)" }}>4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128 · 160</p>
        <div className="ruler" style={{ marginTop: "var(--s-6)" }}>
          {[
            ["--s-2", 8], ["--s-3", 12], ["--s-4", 16], ["--s-5", 24],
            ["--s-6", 32], ["--s-7", 48], ["--s-8", 64], ["--s-9", 96],
          ].map(([v, px]) => (
            <div className="ruler__row" key={v as string}>
              <span style={{ width: 56 }}>{px}px</span>
              <span className="ruler__bar" style={{ width: `var(${v as string})` }} />
              <span>{v as string}</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="section wrap">
        <p className="caption">
          Sandbox · isolated route · noindexed · dark + light from one token layer.
          Gold ≤ ~10%, accent only. Motion respects prefers-reduced-motion.
        </p>
      </footer>
    </main>
  );
}
