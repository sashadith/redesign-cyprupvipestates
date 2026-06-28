import React from "react";

/* /style — Cyprus VIP Estates design system / CI reference.
   Lists every design element used on /preview-home with its name + token. */

export const dynamic = "force-static";

const BRAND: Array<{ name: string; role: string; varName: string; hex: string; dark?: boolean }> = [
  { name: "Sea Deep", role: "Primär-Dunkelgrün (Hintergrund)", varName: "--sea-deep", hex: "#081512", dark: true },
  { name: "Sea", role: "Maison Green (Surface dunkel)", varName: "--sea", hex: "#102826", dark: true },
  { name: "Paper", role: "Ivory / heller Hintergrund", varName: "--paper", hex: "#F5F1E8" },
  { name: "Paper 2", role: "Sand / heller Surface", varName: "--paper-2", hex: "#EDE7D9" },
  { name: "Ink Warm", role: "Warmes Braun (Text auf hell)", varName: "--ink-warm", hex: "#221C15", dark: true },
  { name: "Ivory", role: "Text auf dunkel", varName: "--ivory", hex: "#EFE9DB" },
  { name: "Champagne", role: "Gold-Akzent (Dark-Theme)", varName: "--champagne", hex: "#C29A5E" },
  { name: "Bronze", role: "Gold-Akzent (Light-Theme)", varName: "--bronze", hex: "#8E6B3D" },
];

const ROLE_TOKENS: Array<[string, string]> = [
  ["--bg", "Seiten-Hintergrund (Dark: Sea Deep · Light: Paper)"],
  ["--surface / --surface-raised", "Flächen / leicht erhöhte Flächen"],
  ["--text / --text-soft / --text-faint", "Text: voll / gedämpft / sehr leise"],
  ["--accent / --accent-ink / --accent-soft", "Gold-Akzent / Text auf Gold / Gold 10–14 %"],
  ["--hairline / --hairline-strong", "Trennlinien (fein / stärker)"],
  ["--glass-bg / --glass-border / --glass-highlight", "Frosted-Glass-Flächen (Buttons, Badges)"],
  ["--glow / --glow-strong", "Gold-Schimmer / Hover-Glow"],
];

const TYPE_SCALE: Array<{ tag: string; varName: string; size: string; cls: string; sample: string; italic?: boolean }> = [
  { tag: "Display", varName: "--text-display", size: "clamp(3 → 5.5rem)", cls: "sg__display", sample: "Cyprus VIP Estates" },
  { tag: "Hero / H1", varName: "--text-h1", size: "clamp(2.6 → 4.25rem)", cls: "sg__display", sample: "Cyprus Property Experts" },
  { tag: "Heading 2", varName: "--text-h2", size: "clamp(1.95 → 3rem)", cls: "sg__display", sample: "There is Only One Cyprus" },
  { tag: "Heading 3", varName: "--text-h3", size: "clamp(1.45 → 1.95rem)", cls: "sg__display", sample: "Frequently Asked Questions" },
  { tag: "Lead", varName: "--text-lead", size: "clamp(1.125 → 1.375rem)", cls: "sg__bodyfont", sample: "Each Cypriot city offers a different way to live by the sea." },
  { tag: "Body", varName: "--text-body", size: "1.0625rem", cls: "sg__bodyfont", sample: "The Republic of Cyprus is located in the eastern Mediterranean and is known for its rich history." },
  { tag: "Small", varName: "--text-sm", size: "0.875rem", cls: "sg__bodyfont", sample: "Read case study · Show all projects" },
  { tag: "Caption / Eyebrow", varName: "--text-caption", size: "0.78rem", cls: "sg__bodyfont", sample: "CYPRUS VIP ESTATES" },
];

const SPACING: Array<[string, string]> = [
  ["--s-1", "4px"], ["--s-2", "8px"], ["--s-3", "12px"], ["--s-4", "16px"], ["--s-5", "24px"],
  ["--s-6", "32px"], ["--s-7", "48px"], ["--s-8", "64px"], ["--s-9", "96px"], ["--s-10", "128px"], ["--s-11", "160px"],
];

const COMPONENTS: Array<[string, string]> = [
  [".it", "Gold-Shimmer-Akzent — animiertes Gold-Wort in jeder Überschrift"],
  [".shimmer / *__stripe", "Dünne, glühende Gold-Trennlinie unter Überschriften"],
  [".btn · --primary · --glass · --ghost", "Buttons: dunkel/grün · Frosted-Glass · Outline"],
  [".pcard", "Projekt-Karte (Featured / New Listings) mit Preis & Bild"],
  [".ccard", "Standort-Karte (Paphos · Limassol · Larnaca)"],
  [".cscard / .cscard__cat", "Case-Study-Karte + Gold-Glas-Kategorie-Badge"],
  [".about__medallion", "Runde Gold-Medaillons (Vorteile)"],
  [".bstat / .bstat__num", "Zahlen-Statistik mit Count-Up-Animation"],
  [".formsec__* / .btn--primary", "Kontaktformular: Felder, Radios, Send-Button (Deep Green)"],
  [".pf__*", "Footer-Raster (Marke · Spalten · Newsletter · Bottom)"],
  [".faq__* / .accordion", "FAQ-Split mit Sticky-Kopf + Akkordeon"],
];

const EFFECTS: Array<[string, string]> = [
  ["cloudDriftA / cloudDriftB", "Langsam treibende goldene Gold-Wolken im Hintergrund (FAQ, Case Studies, Footer)"],
  ["goldShine", "Schimmernder Gold-Verlauf (Akzent-Wörter & animierte Pfeile)"],
  ["Lenis + GSAP ScrollTrigger", "Smooth-Scroll + Scroll-Reveals (Hero SplitText, Karten-Stagger, Bild-Wipe)"],
  ["Parallax-Video", "Fixiertes Hintergrund-Video (sunset.mp4), läuft im Loop"],
];

export default function StylePage() {
  return (
    <main className="sg">
      <p className="sg__eyebrow">Cyprus VIP Estates · Corporate Identity</p>
      <h1 className="sg__title">
        Design <span className="it">System</span>
      </h1>
      <p className="sg__intro">
        Alle Farben, Schriften, Abstände und Bausteine, die für die neue Homepage
        (<code className="sg__mono">/preview-home</code>) entwickelt wurden — mit ihren offiziellen Bezeichnungen.
        Dark-Theme ist Standard; einzelne Sektionen nutzen das Light-(Ivory-)Theme über <code className="sg__mono">.is-light</code>.
      </p>

      {/* ---------------- COLOURS ---------------- */}
      <section className="sg__section">
        <h2 className="sg__h">Farben</h2>
        <p className="sg__sub">Markenfarben (feste Werte). Die semantischen Rollen-Tokens leiten sich daraus pro Theme ab.</p>
        <hr className="shimmer sg__rule" />

        <div className="sg__swatches">
          {BRAND.map((c) => (
            <div className="sg__swatch" key={c.varName}>
              <div className="sg__chip" style={{ background: c.hex }} />
              <div className="sg__swatch-meta">
                <div className="sg__name">{c.name}</div>
                <div className="sg__mono sg__var">{c.varName}</div>
                <div className="sg__mono sg__val">{c.hex} · {c.role}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="sg__panel sg__panel--light" data-theme="light">
          <p className="sg__panel-label" style={{ color: "var(--ink-warm)" }}>Light-(Ivory-)Theme · .is-light</p>
          <p style={{ color: "var(--ink-warm)", margin: 0, fontFamily: "var(--font-display), serif", fontSize: "var(--text-h3)" }}>
            Discover Properties <span className="it">for Sale</span>
          </p>
          <p style={{ color: "var(--text-soft)", margin: "12px 0 0" }}>
            Heller Hintergrund (Paper), warmes Braun für Text, Bronze als Gold-Akzent.
          </p>
        </div>

        <ul className="sg__list" style={{ marginTop: "var(--s-7)" }}>
          {ROLE_TOKENS.map(([k, v]) => (
            <li key={k}><code>{k}</code><span>{v}</span></li>
          ))}
        </ul>
      </section>

      {/* ---------------- TYPOGRAPHY ---------------- */}
      <section className="sg__section">
        <h2 className="sg__h">Typografie</h2>
        <p className="sg__sub">
          <strong style={{ color: "var(--ivory)" }}>Fraunces</strong> — Display / Überschriften (Serif, auch kursiv für Akzente). · {" "}
          <strong style={{ color: "var(--ivory)" }}>Mulish</strong> — Body / UI (Sans). · {" "}
          <strong style={{ color: "var(--ivory)" }}>Playfair Display</strong> — kyrillischer Display-Fallback.
        </p>
        <hr className="shimmer sg__rule" />
        <div className="sg__type">
          {TYPE_SCALE.map((t) => (
            <div className="sg__type-row" key={t.varName}>
              <div className="sg__type-tag">{t.tag} · <span>font-size: {t.varName} ({t.size})</span></div>
              <p className={`sg__type-sample ${t.cls}`} style={{ fontSize: `var(${t.varName})` }}>{t.sample}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- ACCENTS ---------------- */}
      <section className="sg__section">
        <h2 className="sg__h">Akzente</h2>
        <hr className="shimmer sg__rule" />
        <div className="sg__cluster">
          <div className="sg__demo">
            <p style={{ margin: 0, fontFamily: "var(--font-display), serif", fontSize: "var(--text-h3)", color: "var(--ivory)" }}>
              Real Estate <span className="it">Success</span> Stories
            </p>
            <p className="sg__demo-label">.it — animiertes Gold-Wort</p>
          </div>
          <div className="sg__demo">
            <hr className="shimmer sg__stripe" />
            <p className="sg__demo-label">.shimmer / *__stripe — Gold-Trennlinie</p>
          </div>
          <div className="sg__demo">
            <span className="sg__badge">Investment Property</span>
            <p className="sg__demo-label">.cscard__cat — Gold-Glas-Badge</p>
          </div>
        </div>
      </section>

      {/* ---------------- BUTTONS ---------------- */}
      <section className="sg__section">
        <h2 className="sg__h">Buttons</h2>
        <hr className="shimmer sg__rule" />
        <div className="sg__cluster">
          <div className="sg__demo">
            <a className="btn btn--primary" href="#"><span>Get Consultation</span></a>
            <p className="sg__demo-label">.btn .btn--primary — dunkel/grün</p>
          </div>
          <div className="sg__demo">
            <a className="btn btn--glass" href="#"><span>View All Projects</span></a>
            <p className="sg__demo-label">.btn .btn--glass — Frosted Glass</p>
          </div>
          <div className="sg__demo">
            <a className="btn btn--ghost" href="#"><span>Show all projects</span></a>
            <p className="sg__demo-label">.btn .btn--ghost — Outline</p>
          </div>
        </div>
      </section>

      {/* ---------------- SPACING / RADIUS / MOTION ---------------- */}
      <section className="sg__section">
        <h2 className="sg__h">Abstände &amp; Maße</h2>
        <p className="sg__sub">8-px-Raster. Plus Container-Maße, Radius und Bewegungs-Tokens.</p>
        <hr className="shimmer sg__rule" />
        <div className="sg__tokens">
          {SPACING.map(([k, v]) => (
            <div className="sg__token" key={k}>
              <code>{k}</code>
              <p className="sg__val sg__mono">{v}</p>
              <div className="sg__bar" style={{ width: v }} />
            </div>
          ))}
        </div>
        <ul className="sg__list" style={{ marginTop: "var(--s-7)" }}>
          <li><code>--maxw</code><span>Container-Maximalbreite — 1360px</span></li>
          <li><code>--gutter</code><span>Seitenrand — clamp(20px → 64px)</span></li>
          <li><code>--section-y</code><span>Vertikaler Sektions-Abstand — clamp(2.8 → 6.25rem)</span></li>
          <li><code>--r-ui</code><span>Eck-Radius (Buttons, Karten, Badges) — 16px</span></li>
          <li><code>--ease / --ease-soft</code><span>Bewegungskurven (cubic-bezier)</span></li>
          <li><code>--dur / --dur-sm</code><span>Übergangsdauer — 0.6s / 0.4s</span></li>
        </ul>
      </section>

      {/* ---------------- COMPONENTS ---------------- */}
      <section className="sg__section">
        <h2 className="sg__h">Bausteine</h2>
        <p className="sg__sub">Wiederkehrende Komponenten und ihre Klassen-Bezeichnungen.</p>
        <hr className="shimmer sg__rule" />
        <ul className="sg__list">
          {COMPONENTS.map(([k, v]) => (
            <li key={k}><code>{k}</code><span>{v}</span></li>
          ))}
        </ul>
      </section>

      {/* ---------------- EFFECTS ---------------- */}
      <section className="sg__section">
        <h2 className="sg__h">Effekte &amp; Animation</h2>
        <hr className="shimmer sg__rule" />
        <ul className="sg__list">
          {EFFECTS.map(([k, v]) => (
            <li key={k}><code>{k}</code><span>{v}</span></li>
          ))}
        </ul>
      </section>

      <p className="sg__foot">
        Quelle: <code className="sg__mono">src/app/preview-home/tokens.css</code> · Live-Vorschau:{" "}
        <code className="sg__mono">/preview-home</code>. Diese Seite ist noindex (interne CI-Referenz).
      </p>
    </main>
  );
}
