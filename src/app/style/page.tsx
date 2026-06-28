import React from "react";

/* /style — Cyprus VIP Estates design system / CI reference.
   Lists every design element used on /preview-home with its name + token. */

export const dynamic = "force-static";

const BRAND: Array<{ name: string; role: string; varName: string; hex: string }> = [
  { name: "Sea Deep", role: "Primary dark green (background)", varName: "--sea-deep", hex: "#081512" },
  { name: "Sea", role: "Maison Green (dark surface)", varName: "--sea", hex: "#102826" },
  { name: "Paper", role: "Ivory / light background", varName: "--paper", hex: "#F5F1E8" },
  { name: "Paper 2", role: "Sand / light surface", varName: "--paper-2", hex: "#EDE7D9" },
  { name: "Ink Warm", role: "Warm brown (text on light)", varName: "--ink-warm", hex: "#221C15" },
  { name: "Ivory", role: "Text on dark", varName: "--ivory", hex: "#EFE9DB" },
  { name: "Champagne", role: "Gold accent (dark theme)", varName: "--champagne", hex: "#C29A5E" },
  { name: "Bronze", role: "Gold accent (light theme)", varName: "--bronze", hex: "#8E6B3D" },
];

const ROLE_TOKENS: Array<[string, string]> = [
  ["--bg", "Page background (dark: Sea Deep · light: Paper)"],
  ["--surface / --surface-raised", "Surfaces / slightly raised surfaces"],
  ["--text / --text-soft / --text-faint", "Text: full / muted / faint"],
  ["--accent / --accent-ink / --accent-soft", "Gold accent / text on gold / gold 10–14%"],
  ["--hairline / --hairline-strong", "Divider lines (fine / stronger)"],
  ["--glass-bg / --glass-border / --glass-highlight", "Frosted-glass surfaces (buttons, badges)"],
  ["--glow / --glow-strong", "Gold shimmer / hover glow"],
];

const TYPE_SCALE: Array<{ tag: string; varName: string; size: string; cls: string; sample: string }> = [
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
  [".it", "Gold-shimmer accent — animated gold word in every heading"],
  [".shimmer / *__stripe", "Thin, glowing gold divider under headings"],
  [".btn · --primary · --glass · --ghost", "Buttons: dark/green · frosted glass · outline"],
  [".pcard", "Project card (Featured / New Listings) with price & image"],
  [".ccard", "Location card (Paphos · Limassol · Larnaca)"],
  [".cscard / .cscard__cat", "Case-study card + gold-glass category badge"],
  [".about__medallion", "Round gold medallions (benefits)"],
  [".bstat / .bstat__num", "Number stat with count-up animation"],
  [".formsec__* / .formsec__submit", "Contact form: fields, radios, deep-green Send button"],
  [".pf__*", "Footer grid (brand · columns · newsletter · bottom)"],
  [".faq__* / accordion", "FAQ split with sticky head + accordion"],
];

const EFFECTS: Array<[string, string]> = [
  ["cloudDriftA / cloudDriftB", "Slowly drifting golden clouds in the background (FAQ, Case Studies, Footer)"],
  ["goldShine", "Shimmering gold gradient (accent words & animated arrows)"],
  ["sweep", "Running gold reflection along the divider lines (.shimmer)"],
  ["Lenis + GSAP ScrollTrigger", "Smooth scroll + scroll reveals (hero SplitText, card stagger, image wipe)"],
  ["Parallax video", "Fixed background video (sunset.mp4) on loop"],
];

export default function StylePage() {
  return (
    <main className="sg">
      <p className="sg__eyebrow">Cyprus VIP Estates · Corporate Identity</p>
      <h1 className="sg__title">
        Design <span className="it">System</span>
      </h1>
      <p className="sg__intro">
        Every colour, font, spacing value and building block developed for the new homepage
        (<code className="sg__mono">/preview-home</code>) — with their official names. Dark theme is the default;
        individual sections use the light (ivory) theme via <code className="sg__mono">.is-light</code>.
      </p>

      {/* ---------------- COLOURS ---------------- */}
      <section className="sg__section">
        <h2 className="sg__h">Colours</h2>
        <p className="sg__sub">Brand colours (fixed values). The semantic role tokens derive from these per theme.</p>
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
          <p className="sg__panel-label" style={{ color: "var(--ink-warm)" }}>Light (ivory) theme · .is-light</p>
          <p style={{ color: "var(--ink-warm)", margin: 0, fontFamily: "var(--font-display), serif", fontSize: "var(--text-h3)" }}>
            Discover Properties <span className="it">for Sale</span>
          </p>
          <p style={{ color: "var(--text-soft)", margin: "12px 0 0" }}>
            Light background (Paper), warm brown for text, bronze as the gold accent.
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
        <h2 className="sg__h">Typography</h2>
        <p className="sg__sub">
          <strong style={{ color: "var(--ivory)" }}>Fraunces</strong> — display / headings (serif, also italic for accents). · {" "}
          <strong style={{ color: "var(--ivory)" }}>Mulish</strong> — body / UI (sans). · {" "}
          <strong style={{ color: "var(--ivory)" }}>Playfair Display</strong> — Cyrillic display fallback.
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
        <h2 className="sg__h">Accents</h2>
        <hr className="shimmer sg__rule" />
        <div className="sg__cluster">
          <div className="sg__demo">
            <p style={{ margin: 0, fontFamily: "var(--font-display), serif", fontSize: "var(--text-h3)", color: "var(--ivory)" }}>
              Real Estate <span className="it">Success</span> Stories
            </p>
            <p className="sg__demo-label">.it — animated gold word</p>
          </div>
          <div className="sg__demo">
            <hr className="shimmer sg__stripe" />
            <p className="sg__demo-label">.shimmer / *__stripe — gold divider</p>
          </div>
          <div className="sg__demo">
            <span className="sg__arrow" aria-hidden />
            <p className="sg__demo-label">How-We-Work — animated gold arrow</p>
          </div>
          <div className="sg__demo">
            <span className="sg__badge">Investment Property</span>
            <p className="sg__demo-label">.cscard__cat — gold-glass badge</p>
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
            <p className="sg__demo-label">.btn .btn--primary — dark / green</p>
          </div>
          <div className="sg__demo">
            <a className="btn btn--glass" href="#"><span>View All Projects</span></a>
            <p className="sg__demo-label">.btn .btn--glass — frosted glass</p>
          </div>
          <div className="sg__demo">
            <a className="btn btn--ghost" href="#"><span>Show all projects</span></a>
            <p className="sg__demo-label">.btn .btn--ghost — outline</p>
          </div>
        </div>
      </section>

      {/* ---------------- SPACING / RADIUS / MOTION ---------------- */}
      <section className="sg__section">
        <h2 className="sg__h">Spacing &amp; Sizing</h2>
        <p className="sg__sub">8-px grid. Plus container sizing, radius and motion tokens.</p>
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
          <li><code>--maxw</code><span>Container max width — 1360px</span></li>
          <li><code>--gutter</code><span>Side padding — clamp(20px → 64px)</span></li>
          <li><code>--section-y</code><span>Vertical section padding — clamp(2.8 → 6.25rem)</span></li>
          <li><code>--r-ui</code><span>Corner radius (buttons, cards, badges) — 16px</span></li>
          <li><code>--ease / --ease-soft</code><span>Motion curves (cubic-bezier)</span></li>
          <li><code>--dur / --dur-sm</code><span>Transition duration — 0.6s / 0.4s</span></li>
        </ul>
      </section>

      {/* ---------------- COMPONENTS ---------------- */}
      <section className="sg__section">
        <h2 className="sg__h">Components</h2>
        <p className="sg__sub">Recurring components and their class names.</p>
        <hr className="shimmer sg__rule" />
        <ul className="sg__list">
          {COMPONENTS.map(([k, v]) => (
            <li key={k}><code>{k}</code><span>{v}</span></li>
          ))}
        </ul>
      </section>

      {/* ---------------- EFFECTS ---------------- */}
      <section className="sg__section">
        <h2 className="sg__h">Effects &amp; Animation</h2>
        <hr className="shimmer sg__rule" />
        <ul className="sg__list">
          {EFFECTS.map(([k, v]) => (
            <li key={k}><code>{k}</code><span>{v}</span></li>
          ))}
        </ul>
      </section>

      <p className="sg__foot">
        Source: <code className="sg__mono">src/app/preview-home/tokens.css</code> · Live preview:{" "}
        <code className="sg__mono">/preview-home</code>. This page is noindex (internal CI reference).
      </p>
    </main>
  );
}
