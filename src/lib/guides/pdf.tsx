import React from "react";
import path from "path";
import { Document, Page, Text, View, Link, Font, StyleSheet } from "@react-pdf/renderer";
import type { GuideBlock, GuideContent, GuideLang } from "./types";
import { corporatePath } from "@/lib/corporatePageSlugs";

/* Lead-magnet guide layout. Used ONLY by scripts/guides/render-one.tsx (build time, one process per file):
   rendering several documents in one process corrupts glyphs, so the server never renders, it serves the
   PDFs from src/lib/guides/pdf-files/.

   Layout rules Rules from the project's react-pdf notes (react-pdf-gotchas):
   solid colours only (an alpha border renders green), no flex `gap` (breaks rows), no SVG,
   static TTF only (no variable fonts), every block that must not split gets wrap={false}. */

const FONT_DIR = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "Liberation",
  fonts: [
    { src: path.join(FONT_DIR, "LiberationSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "LiberationSans-Bold.ttf"), fontWeight: 700 },
    { src: path.join(FONT_DIR, "LiberationSans-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
    { src: path.join(FONT_DIR, "LiberationSans-BoldItalic.ttf"), fontWeight: 700, fontStyle: "italic" },
  ],
});
// Words are never hyphenated: the default hyphenator breaks German and Russian compounds badly.
Font.registerHyphenationCallback((word) => [word]);

const C = {
  navy: "#0b1620",
  navyText: "#e8edf2",
  navyMuted: "#9fb0bf",
  gold: "#b07d3a",
  goldLight: "#d9b36f",
  ink: "#1d242c",
  muted: "#5a6672",
  line: "#d9d2c5",
  sand: "#f6f1e8",
  white: "#ffffff",
};

const s = StyleSheet.create({
  cover: { backgroundColor: C.navy, padding: 56, fontFamily: "Liberation", color: C.navyText },
  brand: { fontSize: 10, letterSpacing: 3, color: C.goldLight, textTransform: "uppercase", marginBottom: 150 },
  coverEdition: { fontSize: 10, letterSpacing: 1.5, color: C.goldLight, textTransform: "uppercase", marginBottom: 14 },
  coverTitle: { fontSize: 30, lineHeight: 1.18, fontWeight: 700, color: C.white, marginBottom: 16 },
  coverRule: { width: 56, height: 3, backgroundColor: C.gold, marginBottom: 16 },
  coverSub: { fontSize: 13, lineHeight: 1.45, color: C.navyMuted, marginBottom: 70 },
  figures: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#2a3a48", paddingTop: 18 },
  figure: { flex: 1, paddingRight: 12 },
  figureValue: { fontSize: 19, fontWeight: 700, color: C.goldLight, marginBottom: 4 },
  figureLabel: { fontSize: 8.5, lineHeight: 1.35, color: C.navyMuted },
  coverFoot: { position: "absolute", left: 56, right: 56, bottom: 40, fontSize: 9, color: C.navyMuted },

  page: { backgroundColor: C.white, paddingTop: 54, paddingBottom: 64, paddingHorizontal: 52, fontFamily: "Liberation", fontSize: 10, color: C.ink },
  intro: { fontSize: 11, lineHeight: 1.5, color: C.ink, marginBottom: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  h2: { fontSize: 15, fontWeight: 700, color: C.navy, marginTop: 14, marginBottom: 8, paddingLeft: 9, borderLeftWidth: 3, borderLeftColor: C.gold },
  p: { fontSize: 10, lineHeight: 1.5, marginBottom: 7 },
  bulletRow: { flexDirection: "row", marginBottom: 4 },
  bulletDot: { width: 12, color: C.gold, fontWeight: 700 },
  bulletText: { flex: 1, fontSize: 10, lineHeight: 1.45 },
  list: { marginBottom: 7 },
  stepRow: { flexDirection: "row", marginBottom: 7 },
  stepNum: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.gold, color: C.white, fontSize: 9.5, fontWeight: 700, textAlign: "center", paddingTop: 5, marginRight: 9 },
  stepBody: { flex: 1 },
  stepTitle: { fontSize: 10, fontWeight: 700, marginBottom: 2 },
  stepText: { fontSize: 9.5, lineHeight: 1.45, color: C.ink },
  table: { marginBottom: 8, borderWidth: 1, borderColor: C.line },
  tHead: { flexDirection: "row", backgroundColor: C.navy },
  tHeadCell: { fontSize: 8.5, fontWeight: 700, color: C.white, paddingVertical: 5, paddingHorizontal: 6 },
  tRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: C.line },
  tCell: { fontSize: 9, lineHeight: 1.35, paddingVertical: 5, paddingHorizontal: 6 },
  tNote: { fontSize: 8.5, fontStyle: "italic", color: C.muted, marginBottom: 8 },
  callout: { backgroundColor: C.sand, borderLeftWidth: 3, borderLeftColor: C.gold, paddingVertical: 8, paddingHorizontal: 11, marginBottom: 9 },
  calloutTitle: { fontSize: 10, fontWeight: 700, marginBottom: 3, color: C.navy },
  calloutText: { fontSize: 9.5, lineHeight: 1.45 },
  example: { borderWidth: 1, borderColor: C.line, marginBottom: 9 },
  exampleTitle: { backgroundColor: C.sand, fontSize: 10, fontWeight: 700, color: C.navy, paddingVertical: 6, paddingHorizontal: 9 },
  exampleRow: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 9, borderTopWidth: 1, borderTopColor: C.line },
  exampleLabel: { flex: 1, fontSize: 9.5, paddingRight: 8 },
  exampleValue: { fontSize: 9.5, textAlign: "right" },
  exampleTotal: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 9, borderTopWidth: 1.5, borderTopColor: C.navy, backgroundColor: C.sand },
  exampleTotalText: { fontSize: 10, fontWeight: 700 },
  exampleNote: { fontSize: 8.5, fontStyle: "italic", color: C.muted, paddingVertical: 5, paddingHorizontal: 9, borderTopWidth: 1, borderTopColor: C.line },
  checkTitle: { fontSize: 10, fontWeight: 700, color: C.navy, marginBottom: 5 },
  checkRow: { flexDirection: "row", marginBottom: 4 },
  checkBox: { width: 9, height: 9, borderWidth: 1, borderColor: C.gold, marginRight: 8, marginTop: 1.5 },
  next: { backgroundColor: C.navy, padding: 16, marginTop: 14, marginBottom: 10 },
  nextHead: { fontSize: 13, fontWeight: 700, color: C.goldLight, marginBottom: 5 },
  nextText: { fontSize: 10, lineHeight: 1.5, color: C.navyText, marginBottom: 8 },
  nextLink: { fontSize: 10, fontWeight: 700, color: C.white },
  disclaimer: { fontSize: 8, lineHeight: 1.4, color: C.muted },
  footer: { position: "absolute", left: 52, right: 52, bottom: 28, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: C.muted, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 7 },
});

const SITE = "https://cyprusvipestates.com";
const PAGE_WORD: Record<GuideLang, string> = {
  en: "Page",
  de: "Seite",
  pl: "Strona",
  ru: "Стр.",
};

/** A short paragraph that introduces a table, example or callout stays on the same page as it
 *  (otherwise "...taxed on these bands:" is stranded at the bottom of one page and its table starts the next). */
function groupBlocks(blocks: GuideBlock[]): GuideBlock[][] {
  const out: GuideBlock[][] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const next = blocks[i + 1];
    if (b.type === "p" && b.text.length < 520 && next && (next.type === "table" || next.type === "example" || next.type === "callout")) {
      out.push([b, next]);
      i++;
    } else out.push([b]);
  }
  return out;
}

function Block({ b }: { b: GuideBlock }) {
  switch (b.type) {
    case "p":
      return <Text style={s.p}>{b.text}</Text>;
    case "bullets":
      return (
        <View style={s.list}>
          {b.items.map((t, i) => (
            <View key={i} style={s.bulletRow} wrap={false}>
              <Text style={s.bulletDot}>•</Text>
              <Text style={s.bulletText}>{t}</Text>
            </View>
          ))}
        </View>
      );
    case "steps":
      return (
        <View style={s.list}>
          {b.items.map((it, i) => (
            <View key={i} style={s.stepRow} wrap={false}>
              <Text style={s.stepNum}>{i + 1}</Text>
              <View style={s.stepBody}>
                <Text style={s.stepTitle}>{it.title}</Text>
                <Text style={s.stepText}>{it.text}</Text>
              </View>
            </View>
          ))}
        </View>
      );
    case "table": {
      // Column weight follows the longest cell, so wide text columns get room and number columns stay narrow.
      const weights = b.head.map((h, ci) => Math.min(40, Math.max(7, ...[h, ...b.rows.map((r) => r[ci])].map((t) => t.length * 0.6))));
      return (
        <View wrap={false}>
          <View style={s.table}>
            <View style={s.tHead}>
              {b.head.map((h, ci) => (
                <Text key={ci} style={[s.tHeadCell, { flex: weights[ci] }]}>{h}</Text>
              ))}
            </View>
            {b.rows.map((r, ri) => (
              <View key={ri} style={[s.tRow, ri % 2 === 1 ? { backgroundColor: "#faf7f1" } : {}]}>
                {r.map((cell, ci) => (
                  <Text key={ci} style={[s.tCell, { flex: weights[ci] }]}>{cell}</Text>
                ))}
              </View>
            ))}
          </View>
          {b.note ? <Text style={s.tNote}>{b.note}</Text> : null}
        </View>
      );
    }
    case "callout":
      return (
        <View style={s.callout} wrap={false}>
          {b.title ? <Text style={s.calloutTitle}>{b.title}</Text> : null}
          <Text style={s.calloutText}>{b.text}</Text>
        </View>
      );
    case "example":
      return (
        <View style={s.example} wrap={false}>
          <Text style={s.exampleTitle}>{b.title}</Text>
          {b.rows.map(([l, v], i) => (
            <View key={i} style={s.exampleRow}>
              <Text style={s.exampleLabel}>{l}</Text>
              <Text style={s.exampleValue}>{v}</Text>
            </View>
          ))}
          {b.total ? (
            <View style={s.exampleTotal}>
              <Text style={[s.exampleLabel, s.exampleTotalText]}>{b.total[0]}</Text>
              <Text style={[s.exampleValue, s.exampleTotalText]}>{b.total[1]}</Text>
            </View>
          ) : null}
          {b.note ? <Text style={s.exampleNote}>{b.note}</Text> : null}
        </View>
      );
    case "checklist":
      return (
        <View style={s.list} wrap={b.items.length > 9}>
          {b.title ? <Text style={s.checkTitle}>{b.title}</Text> : null}
          {b.items.map((t, i) => (
            <View key={i} style={s.checkRow} wrap={false}>
              <View style={s.checkBox} />
              <Text style={s.bulletText}>{t}</Text>
            </View>
          ))}
        </View>
      );
  }
}

export function GuideDocument({ content, id }: { content: GuideContent; id: string }) {
  const lang = content.lang;
  const contactUrl = `${SITE}${corporatePath("contacts", lang)}?utm_source=guide&utm_medium=pdf&utm_campaign=${id}`;
  return (
    <Document title={content.title} author="Cyprus VIP Estates" subject={content.subtitle} language={lang}>
      <Page size="A4" style={s.cover}>
        <Text style={s.brand}>Cyprus VIP Estates</Text>
        <Text style={s.coverEdition}>{content.edition}</Text>
        <Text style={s.coverTitle}>{content.title}</Text>
        <View style={s.coverRule} />
        <Text style={s.coverSub}>{content.subtitle}</Text>
        <View style={s.figures}>
          {content.keyNumbers.map((k, i) => (
            <View key={i} style={s.figure}>
              <Text style={s.figureValue}>{k.value}</Text>
              <Text style={s.figureLabel}>{k.label}</Text>
            </View>
          ))}
        </View>
        <Text style={s.coverFoot}>cyprusvipestates.com</Text>
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={s.intro}>{content.intro}</Text>
        {content.sections.map((sec, si) => {
          const groups = groupBlocks(sec.blocks);
          const [first, ...rest] = groups;
          const render = (g: GuideBlock[], gi: number) =>
            g.length > 1 ? (
              <View key={gi} wrap={false}>
                {g.map((b, bi) => <Block key={bi} b={b} />)}
              </View>
            ) : (
              <Block key={gi} b={g[0]} />
            );
          // The heading travels with the first block when that block cannot split (table, example, callout, a
          // paragraph + its table) or is a short paragraph; before, headings were stranded at the foot of a page.
          const head = first[0];
          const keepWithHeading = first.length > 1 || head.type === "table" || head.type === "example" || head.type === "callout" || (head.type === "checklist" && head.items.length <= 9) || (head.type === "p" && head.text.length <= 700);
          return (
            <View key={si}>
              {keepWithHeading ? (
                <View wrap={false}>
                  <Text style={s.h2}>{sec.heading}</Text>
                  {first.map((b, bi) => <Block key={bi} b={b} />)}
                </View>
              ) : (
                <>
                  <Text style={s.h2} minPresenceAhead={120}>{sec.heading}</Text>
                  {render(first, -1)}
                </>
              )}
              {rest.map((g, gi) => render(g, gi))}
            </View>
          );
        })}
        <View style={s.next} wrap={false}>
          <Text style={s.nextHead}>{content.nextSteps.heading}</Text>
          <Text style={s.nextText}>{content.nextSteps.text}</Text>
          <Link src={contactUrl} style={s.nextLink}>cyprusvipestates.com</Link>
        </View>
        <Text style={s.disclaimer}>{content.disclaimer}</Text>
        <View style={s.footer} fixed>
          <Text>Cyprus VIP Estates · cyprusvipestates.com</Text>
          <Text render={({ pageNumber, totalPages }) => `${PAGE_WORD[lang]} ${pageNumber - 1} / ${totalPages - 1}`} />
        </View>
      </Page>
    </Document>
  );
}
