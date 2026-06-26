import ThemeToggle from "./ThemeToggle";

/* Version 3 — Modern Luxury · Liquid Glass + 3D metallic gold.
   Cool slate base, transparent refractive glass, polished gold seal + CTA.
   Same content sections as V1/V2 for comparison. Isolated, noindexed, no DB. */

const BRAND = [
  { name: "Gold Hi", hex: "#F7E6AE", v: "--gold-hi" },
  { name: "Gold", hex: "#E3B84E", v: "--gold" },
  { name: "Gold Mid", hex: "#C79A3A", v: "--gold-mid" },
  { name: "Gold Deep", hex: "#8E6A24", v: "--gold-deep" },
  { name: "Slate", hex: "#0E1116", v: "--slate" },
  { name: "Slate 2", hex: "#161A21", v: "--slate-2" },
  { name: "Ivory", hex: "#ECEBE7", v: "--ivory" },
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
    <path d="M3 11L11 3M11 3H5M11 3V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function SandboxV3Page() {
  return (
    <main>
      <ThemeToggle />

      {/* ---- header ---- */}
      <header className="section wrap">
        <div className="row" style={{ gap: "var(--s-6)", alignItems: "center" }}>
          <div className="seal seal--ring reveal" aria-hidden>CVE</div>
          <p className="eyebrow reveal" style={{ animationDelay: "40ms" }}>Version 3 · Liquid Glass</p>
        </div>
        <h1 className="display reveal" style={{ marginTop: "var(--s-5)", animationDelay: "80ms" }}>
          Cyprus, <span className="it">exquisitely</span> done.
        </h1>
        <p className="lead reveal" style={{ marginTop: "var(--s-5)", animationDelay: "140ms" }}>
          Transparent Gaussian glass with light-catching edges, a polished 3D gold seal, and a modern
          Didone display. The most contemporary of the three — crisp, refractive, jewel-like.
        </p>
        <div className="row reveal" style={{ marginTop: "var(--s-6)", animationDelay: "200ms" }}>
          <a className="btn btn--gold" href="#type">
            <span>Explore the system</span>
            <span className="btn__ico"><Arrow /></span>
          </a>
          <a className="btn btn--glass" href="#components">Components</a>
        </div>
      </header>

      {/* ---- color ---- */}
      <section className="section wrap" id="color">
        <p className="eyebrow">01 — Color</p>
        <h2 className="h2" style={{ marginTop: "var(--s-5)" }}>3D gold on cool slate</h2>
        <p className="body" style={{ marginTop: "var(--s-4)" }}>
          A metallic gold ramp (highlight → deep) drives the 3D seal, the embossed CTA and the glass
          edges. The cool slate base keeps the glass crisp and refractive.
        </p>

        <p className="lang-tag" style={{ marginTop: "var(--s-7)" }}>Brand constants</p>
        <div className="swatch-grid" style={{ marginTop: "var(--s-4)" }}>
          <div className="swatch swatch--gold3d">
            <div className="swatch__chip" />
            <div className="swatch__meta"><b>3D Gold</b><span>ramp</span></div>
          </div>
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
        <h2 className="h2" style={{ marginTop: "var(--s-5)" }}>Bodoni Moda · Manrope</h2>
        <div className="stack" style={{ marginTop: "var(--s-7)" }}>
          <div><p className="caption">Display · clamp 3.2→6rem</p><p className="display">Aa Exquisitely modern</p></div>
          <div><p className="caption">H1 · clamp 2.7→4.6rem</p><p className="h1">An advisor, not an agent</p></div>
          <div><p className="caption">H2 · clamp 2→3.25rem</p><p className="h2">Buyer-side, on insider terms</p></div>
          <div><p className="caption">Lead · Manrope 300</p><p className="lead">We guide international buyers through Cyprus property — discreetly, securely, and on your side of the table.</p></div>
        </div>

        <hr className="divider-gold" style={{ marginBlock: "var(--s-8)" }} />
        <p className="eyebrow">Multilingual — DE · PL · RU</p>
        <p className="body" style={{ marginTop: "var(--s-4)" }}>
          Bodoni Moda covers Latin-ext (PL). RU resolves to Playfair Display per-glyph.
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
        <h2 className="h2" style={{ marginTop: "var(--s-5)" }}>Liquid glass &amp; 3D gold</h2>

        <div className="row" style={{ marginTop: "var(--s-7)" }}>
          <a className="btn btn--gold" href="#"><span>Book a buyer consultation</span><span className="btn__ico"><Arrow /></span></a>
          <a className="btn btn--glass" href="#">View the process</a>
        </div>

        <div className="grid-2" style={{ marginTop: "var(--s-8)" }}>
          <div className="lg lg--gold tilt" style={{ minHeight: 300, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="seal" aria-hidden>07</div>
              <span className="lang-tag">Since 2007</span>
            </div>
            <div className="stack-sm" style={{ marginTop: "var(--s-6)" }}>
              <p className="display" style={{ fontSize: "3.4rem", lineHeight: 1 }}>12<span className="it">+</span></p>
              <p className="body" style={{ margin: 0 }}>Mandates a year — a transparent liquid-glass card with a refractive gold edge, specular sweep and a 3D gold seal. Hover to tilt.</p>
            </div>
          </div>

          <div
            className="lg"
            style={{
              minHeight: 300,
              background: "linear-gradient(135deg, #1b2330 0%, #0e1116 55%, #2a2113 100%)",
              display: "grid", placeItems: "center",
            }}
          >
            <div className="lg" style={{ maxWidth: 340 }}>
              <p className="eyebrow">Frosted</p>
              <p className="h3" style={{ marginTop: "var(--s-4)", color: "var(--ivory)" }}>Glass on glass</p>
              <p style={{ marginTop: "var(--s-3)", color: "rgba(236,235,231,.82)", fontSize: "var(--text-sm)" }}>
                blur(26px) + refractive gradient edge + specular streak. Solid fallback where unsupported.
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
          Version 3 · isolated · noindexed · liquid glass + 3D gold on cool slate.
          Atmosphere and tilt disable under prefers-reduced-motion. V1 → /sandbox · V2 → /sandbox-v2.
        </p>
      </footer>
    </main>
  );
}
