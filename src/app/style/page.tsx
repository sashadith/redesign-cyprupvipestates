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

      {/* ---------------- SCARCITY BANNER ---------------- */}
      <section className="sg__section">
        <h2 className="sg__h">Scarcity banner</h2>
        <p className="sg__sub">
          Renders on a Development card when few units remain (≥50% sold and ≤5 units left). A continuous,
          slow-spinning champagne glow ring signals urgency; the ring runs at all times, not just on hover.
        </p>
        <hr className="shimmer sg__rule" />
        <div className="sg__cluster">
          <div className="sg__demo sg__demo--card">
            <span className="scarcity-badge">Last unit available</span>
            <p className="sg__demo-label">Tier: last — exactly 1 unit remaining</p>
          </div>
          <div className="sg__demo sg__demo--card">
            <span className="scarcity-badge">Only 3 units left</span>
            <p className="sg__demo-label">Tier: left — 2–5 units remaining</p>
          </div>
        </div>
        <p className="sg__note">
          Usage: <code className="sg__mono">resolveScarcity(available, total)</code>, class <code className="sg__mono">.scarcity-badge</code>.
          Deep green (<code className="sg__mono">--scarcity-green</code>), not carmine — that colour is reserved for the sold-out badge below.
        </p>
      </section>

      {/* ---------------- SOLD-OUT BADGE ---------------- */}
      <section className="sg__section">
        <h2 className="sg__h">Sold-out badge</h2>
        <p className="sg__sub">Replaces the scarcity banner entirely once a development has zero available units. Static — no glow.</p>
        <hr className="shimmer sg__rule" />
        <div className="sg__cluster">
          <div className="sg__demo sg__demo--card">
            <span className="prj__badge prj__badge--sold">Sold out</span>
            <p className="sg__demo-label">.prj__badge .prj__badge--sold — carmine #8C2F2F</p>
          </div>
        </div>
        <p className="sg__note">
          Usage: computed live via <code className="sg__mono">src/lib/developmentAvailability.ts</code>. The card body itself also
          dims (<code className="sg__mono">.prj.is-sold</code> — 55% opacity, desaturated image) so a sold-out listing reads as
          secondary without being hidden.
        </p>
      </section>

      {/* ---------------- GLASS / BLUR BADGES ---------------- */}
      <section className="sg__section">
        <h2 className="sg__h">Glass / blur badges</h2>
        <p className="sg__sub">Frosted, semi-transparent pills over photography — property type tags, the “New” flag, filter controls.</p>
        <hr className="shimmer sg__rule" />
        <div className="sg__cluster">
          <div className="sg__demo sg__demo--card">
            <span className="prj__type">Villa</span>
            <p className="sg__demo-label">.prj__type — backdrop-filter: blur(6px)</p>
          </div>
          <div className="sg__demo sg__demo--card">
            <span className="prj__badge prj__badge--new">New</span>
            <p className="sg__demo-label">.prj__badge .prj__badge--new — solid gold, no blur</p>
          </div>
        </div>
        <p className="sg__note">
          Token source: <code className="sg__mono">--glass-bg / --glass-border / --glass-highlight</code> (tokens.css) — distinct
          values per theme. The same tokens back <code className="sg__mono">.btn--glass</code> shown in Buttons above.
        </p>
      </section>

      {/* ---------------- DISTANCE FOOTER ROW ---------------- */}
      <section className="sg__section">
        <h2 className="sg__h">Distance footer row</h2>
        <p className="sg__sub">Auto-computed distances to key amenities — full 8-category grid on detail pages, a compact variant on client presentations.</p>
        <hr className="shimmer sg__rule" />
        <p className="sg__demo-label" style={{ marginBottom: "var(--s-3)" }}>Full — .dist-strip</p>
        <div className="dist-strip">
          <div className="dist-strip__item">
            <span className="dist-strip__ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 16c1.5 0 1.5-1.2 3-1.2S6.5 16 8 16s1.5-1.2 3-1.2S12.5 16 14 16s1.5-1.2 3-1.2S18.5 16 20 16" /><circle cx="17" cy="7" r="3" /></svg></span>
            <span className="dist-strip__text"><span className="dist-strip__label">Beach</span><span className="dist-strip__value">4 min</span></span>
          </div>
          <div className="dist-strip__item">
            <span className="dist-strip__ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16l-1 12H5L4 7Z" /><path d="M9 7V5a3 3 0 0 1 6 0v2" /></svg></span>
            <span className="dist-strip__text"><span className="dist-strip__label">Shops</span><span className="dist-strip__value">6 min</span></span>
          </div>
          <div className="dist-strip__item">
            <span className="dist-strip__ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7Z" /></svg></span>
            <span className="dist-strip__text"><span className="dist-strip__label">Airport</span><span className="dist-strip__value">28 min</span></span>
          </div>
          <div className="dist-strip__item">
            <span className="dist-strip__ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 21V4M6 4l8 3-8 3" /><ellipse cx="6" cy="21" rx="4" ry="1.2" /></svg></span>
            <span className="dist-strip__text"><span className="dist-strip__label">Golf court</span><span className="dist-strip__value">12 min</span></span>
          </div>
        </div>
        <p className="sg__demo-label" style={{ margin: "var(--s-6) 0 var(--s-3)" }}>Compact — .dist-strip.dist-strip--compact</p>
        <div className="dist-strip dist-strip--compact">
          <div className="dist-strip__item">
            <span className="dist-strip__ic"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 16c1.5 0 1.5-1.2 3-1.2S6.5 16 8 16s1.5-1.2 3-1.2S12.5 16 14 16s1.5-1.2 3-1.2S18.5 16 20 16" /><circle cx="17" cy="7" r="3" /></svg></span>
            <span className="dist-strip__text"><span className="dist-strip__label">Beach</span><span className="dist-strip__value">4 min</span></span>
          </div>
          <div className="dist-strip__item">
            <span className="dist-strip__ic"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7Z" /></svg></span>
            <span className="dist-strip__text"><span className="dist-strip__label">Airport</span><span className="dist-strip__value">28 min</span></span>
          </div>
        </div>
        <p className="sg__note">
          Usage: <code className="sg__mono">DistancesStrip</code> component, values from{" "}
          <code className="sg__mono">Development.distances</code> (<code className="sg__mono">src/lib/developmentDistances.ts</code>) — never recomputed at render time.
        </p>
      </section>

      {/* ---------------- PRICE TYPOGRAPHY ---------------- */}
      <section className="sg__section">
        <h2 className="sg__h">Price typography</h2>
        <p className="sg__sub">Fraunces display serif in champagne gold — the recurring “price” treatment across cards and detail pages.</p>
        <hr className="shimmer sg__rule" />
        <div className="sg__demo sg__demo--card" style={{ display: "inline-block" }}>
          <div className="sg__price-row">
            <span className="prj__price-from">from</span>
            <span className="prj__price">€450,000</span>
          </div>
          <p className="sg__demo-label">.prj__price + .prj__price-from</p>
        </div>
        <p className="sg__note">
          Font: <code className="sg__mono">var(--font-display)</code> (Fraunces), colour: <code className="sg__mono">--champagne</code>.
          Same treatment repeats as <code className="sg__mono">.pp-uc__price</code> (unit card) and <code className="sg__mono">.px-pop__price</code> (map
          popup) — sizes vary by context, colour and font never do. One exception:{" "}
          <code className="sg__mono">.pcard__price</code> (legacy Sanity project card) intentionally uses the body font and{" "}
          <code className="sg__mono">--accent</code> instead, predating this token system.
        </p>
      </section>

      {/* ---------------- ADMIN / INTERNAL TOOLS ---------------- */}
      <section className="sg__section">
        <h2 className="sg__h">Admin / Internal Tools</h2>
        <p className="sg__sub">
          The admin panel (<code className="sg__mono">/admin/*</code>) is built with Tailwind utility classes on its own,
          deliberately separate light-theme palette — it does not share <code className="sg__mono">--champagne</code>,{" "}
          <code className="sg__mono">--scarcity-green</code> or any other token above. Reproduced here as a static visual
          reference only.
        </p>
        <hr className="shimmer sg__rule" />

        <p className="sg__admin-label" style={{ color: "var(--champagne)" }}>Action Center severity dots</p>
        <div className="sg__admin-panel">
          <div className="sg__admin-label">Dashboard · Action Center</div>
          <div className="sg__cluster" style={{ gap: "var(--s-6)" }}>
            <div className="sg__ac-row"><span className="sg__ac-dot sg__ac-dot--urgent" /><span className="sg__ac-label">Urgent — bg-red-600</span></div>
            <div className="sg__ac-row"><span className="sg__ac-dot sg__ac-dot--action" /><span className="sg__ac-label">Action — bg-amber-500</span></div>
            <div className="sg__ac-row"><span className="sg__ac-dot sg__ac-dot--info" /><span className="sg__ac-label">Info — bg-[#9CA3AF]</span></div>
          </div>
        </div>
        <p className="sg__note">Usage: <code className="sg__mono">ActionCenterPanel.tsx</code>, one dot per item indicating severity, grouped by category (Developers / CRM / SEO / System).</p>

        <p className="sg__admin-label" style={{ color: "var(--champagne)", marginTop: "var(--s-7)" }}>Suggestion card states</p>
        <div className="sg__admin-panel">
          <div className="sg__admin-label">SEO Advisor · Suggestion Card</div>

          <p className="sg__demo-label" style={{ color: "#6B7280", marginBottom: 8 }}>Collapsed (closed suggestion — click to expand)</p>
          <div className="sg__sc-row">
            <span className="sg__sc-icon sg__sc-icon--done">✓</span>
            <span className="sg__sc-title">Fix homepage LCP</span>
            <span className="sg__sc-outcome">Deferred hero video, LCP down from 4.1s to 1.8s</span>
            <span style={{ color: "#9CA3AF", fontSize: "0.78rem" }}>2026-07-08</span>
          </div>

          <p className="sg__demo-label" style={{ color: "#6B7280", margin: "16px 0 8px" }}>Expanded (open suggestion)</p>
          <div className="sg__sc-card">
            <div className="sg__sc-card-head">
              <h3>Striking-distance keyword links</h3>
              <span className="sg__sc-chip sg__sc-chip--high">high impact</span>
            </div>
            <p style={{ margin: "0 0 8px", fontSize: "0.82rem", color: "#374151" }}>
              3 blog posts rank #11–15 for commercial-intent queries with no internal links pointing at them.
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              <span className="sg__sc-chip sg__sc-chip--med">small task</span>
              <span className="sg__sc-chip sg__sc-chip--low">seo</span>
            </div>
          </div>
        </div>
        <p className="sg__note">
          Usage: <code className="sg__mono">SuggestionCard.tsx</code> — collapsed rows keep the run history scannable; impact chips
          use <code className="sg__mono">IMPACT_COLOR</code> (high/med/low), unrelated to the severity dots above.
        </p>
      </section>

      <p className="sg__foot">
        Source: <code className="sg__mono">src/app/preview-home/tokens.css</code> · Live preview:{" "}
        <code className="sg__mono">/preview-home</code>. This page is noindex (internal CI reference).
      </p>
    </main>
  );
}
