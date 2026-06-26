import ThemeToggle from "./ThemeToggle";

/* Version 4 — Sapphire · Liquid Glass + Gold. Deep blue base, glowing azure
   aurora, transparent refractive glass, elegant gold accents + Cormorant.
   Same content sections as V1/V2 for comparison. Isolated, noindexed, no DB. */

const BRAND = [
  { name: "Navy", hex: "#0A1A38", v: "--navy" },
  { name: "Navy 2", hex: "#0F2350", v: "--navy-2" },
  { name: "Azure", hex: "#4C9BE0", v: "--azure" },
  { name: "Gold", hex: "#E6C063", v: "--gold" },
  { name: "Gold Lum", hex: "#F6DE9C", v: "--gold-lum" },
  { name: "Gold Deep", hex: "#B68A33", v: "--gold-deep" },
  { name: "Ivory", hex: "#EAEEF6", v: "--ivory" },
];

const SEMANTIC = [
  { name: "bg", v: "--bg" },
  { name: "surface", v: "--surface" },
  { name: "text", v: "--text" },
  { name: "accent", v: "--accent" },
  { name: "glass fill", v: "--glass-fill" },
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

export default function SandboxV4Page() {
  return (
    <main>
      <div className="aurora" aria-hidden />
      <ThemeToggle />

      {/* ---- header ---- */}
      <header className="section wrap">
        <p className="eyebrow reveal">Version 4 · Sapphire Liquid Glass</p>
        <h1 className="display reveal" style={{ marginTop: "var(--s-5)", animationDelay: "60ms" }}>
          Cyprus, <span className="it">brilliantly</span> done.
        </h1>
        <hr className="shimmer reveal" style={{ marginTop: "var(--s-6)", animationDelay: "120ms", maxWidth: 280 }} />
        <p className="lead reveal" style={{ marginTop: "var(--s-6)", animationDelay: "160ms" }}>
          Deep sapphire and gold, transparent refractive glass, and a slow azure aurora.
          Cool and jewel-like — the most atmospheric of the set, kept restrained and luxurious.
        </p>
        <div className="row reveal" style={{ marginTop: "var(--s-6)", animationDelay: "220ms" }}>
          <a className="btn btn--primary" href="#type"><span>Explore the system</span><span className="btn__ico"><Arrow /></span></a>
          <a className="btn btn--glass" href="#components">Components</a>
        </div>
      </header>

      {/* ---- color ---- */}
      <section className="section wrap" id="color">
        <p className="eyebrow">01 — Color</p>
        <h2 className="h2" style={{ marginTop: "var(--s-5)" }}>Gold on midnight sapphire</h2>
        <p className="body" style={{ marginTop: "var(--s-4)" }}>
          A warm luminous gold set against deep blue, with azure as a cool secondary glow. Brand
          constants below; semantic tokens swap with the theme.
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
        <h2 className="h2" style={{ marginTop: "var(--s-5)" }}>Cormorant Garamond · Manrope</h2>
        <div className="stack" style={{ marginTop: "var(--s-7)" }}>
          <div><p className="caption">Display · clamp 3.2→6rem</p><p className="display">Aa Brilliantly cool</p></div>
          <div><p className="caption">H1 · clamp 2.7→4.6rem</p><p className="h1">An advisor, not an agent</p></div>
          <div><p className="caption">H2 · clamp 2→3.25rem</p><p className="h2">Buyer-side, on insider terms</p></div>
          <div><p className="caption">Lead · Manrope 300</p><p className="lead">We guide international buyers through Cyprus property — discreetly, securely, and on your side of the table.</p></div>
        </div>

        <hr className="divider-gold" style={{ marginBlock: "var(--s-8)" }} />
        <p className="eyebrow">Multilingual — DE · PL · RU</p>
        <p className="body" style={{ marginTop: "var(--s-4)" }}>
          Cormorant covers Latin-ext (PL); RU resolves to Playfair Display per-glyph.
        </p>
        <div className="grid-2" style={{ marginTop: "var(--s-6)" }}>
          {LANGS.map((l) => (
            <div className="lg" key={l.tag}>
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
        <h2 className="h2" style={{ marginTop: "var(--s-5)" }}>Transparent glass &amp; gold glow</h2>

        <div className="row" style={{ marginTop: "var(--s-7)" }}>
          <a className="btn btn--primary" href="#"><span>Book a buyer consultation</span><span className="btn__ico"><Arrow /></span></a>
          <a className="btn btn--glass" href="#">View the process</a>
        </div>

        <div className="grid-2" style={{ marginTop: "var(--s-8)" }}>
          <div className="lg lg--gold tilt" style={{ minHeight: 300, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <span className="lang-tag">Since 2007</span>
            <div className="stack-sm">
              <p className="display" style={{ fontSize: "3.6rem", lineHeight: 1 }}>12<span className="it">+</span></p>
              <p className="body" style={{ margin: 0 }}>Mandates a year — a transparent sapphire-glass card with a refractive gold-tinted edge and specular sweep. Hover to tilt.</p>
            </div>
          </div>

          <div
            className="lg"
            style={{ minHeight: 300, background: "linear-gradient(135deg, #14315f 0%, #0a1a38 55%, #2a2a18 100%)", display: "grid", placeItems: "center" }}
          >
            <div className="lg" style={{ maxWidth: 340 }}>
              <p className="eyebrow">Frosted</p>
              <p className="h3" style={{ marginTop: "var(--s-4)", color: "var(--ivory)" }}>Glass on sapphire</p>
              <p style={{ marginTop: "var(--s-3)", color: "rgba(234,238,246,.82)", fontSize: "var(--text-sm)" }}>
                blur(28px) + refractive blue→gold edge + specular streak. Solid fallback where unsupported.
              </p>
            </div>
          </div>
        </div>

        <div className="grid-3" style={{ marginTop: "var(--s-6)" }}>
          {[
            ["Independent lawyers", "Every legal step handled by licensed Cypriot lawyers."],
            ["No markup to you", "Remunerated by developers — never a fee on your side."],
            ["Off-market access", "A curated shortlist, not a public listings wall."],
          ].map(([t, d]) => (
            <div className="lg" key={t as string}>
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
          Version 4 · isolated · noindexed · sapphire + gold · transparent liquid glass + aurora.
          Aurora, shimmer and tilt disable under prefers-reduced-motion. V1 → /sandbox · V2 → /sandbox-v2.
        </p>
      </footer>
    </main>
  );
}
