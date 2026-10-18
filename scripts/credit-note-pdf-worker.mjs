#!/usr/bin/env node
// Credit-note (Gutschrift) PDF renderer, run as a short-lived child process
// (partner portal phase 3c). One JSON model (src/lib/partner/creditNote.ts
// CreditNoteModel) on stdin → PDF bytes on stdout, exit 0. Any error → stderr,
// exit 1. A fresh process per document keeps react-pdf's font-subset state from
// leaking between documents (memory: react-pdf-gotchas).
//
// Plain ESM + React.createElement on purpose: no JSX/TS build step for a script.
// Layout rules from the gotchas: opaque border colours only, no flex `gap`,
// no full-height SVG, a static TTF font (DejaVuSans covers Latin, Polish, Cyrillic).
import path from "node:path";
import React from "react";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

const MAX_INPUT = 64 * 1024;
// Fixed asset path (never from the model): the gold wordmark used across the portal and CRM.
const LOGO = path.join(process.cwd(), "public", "crm", "brand", "logo-full.png");

const STRING_FIELDS = [
  "title", "numberLabel", "number", "dateLabel", "date", "issuerLabel", "recipientLabel",
  "referenceLabel", "reference", "paymentNote", "selfBillingNote",
];

// Minimal duplicate of isCreditNoteModel (src/lib/partner/creditNotePdf.ts).
function validModel(m) {
  if (!m || typeof m !== "object" || Array.isArray(m)) return "model is not an object";
  for (const k of STRING_FIELDS) if (typeof m[k] !== "string") return `missing string field ${k}`;
  for (const k of ["issuerLines", "recipientLines"]) {
    if (!Array.isArray(m[k]) || !m[k].every((s) => typeof s === "string")) return `bad ${k}`;
  }
  if (!Array.isArray(m.rows) || m.rows.length === 0) return "bad rows";
  for (const r of m.rows) if (!r || typeof r.label !== "string" || typeof r.amount !== "string") return "bad row";
  if (m.vatNote !== null && typeof m.vatNote !== "string") return "bad vatNote";
  if (m.draftFooter !== null && typeof m.draftFooter !== "string") return "bad draftFooter";
  return null;
}

async function readStdin() {
  const chunks = [];
  let size = 0;
  for await (const c of process.stdin) {
    size += c.length;
    if (size > MAX_INPUT) throw new Error("input too large");
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const BRONZE = "#8E6B3D";
const INK = "#221C15";
const MUTED = "#6B6255";
const HAIR = "#D9D2C3";
const DRAFT = "#9A3B2E";

const s = StyleSheet.create({
  page: { fontFamily: "DejaVu", fontSize: 9.5, color: INK, paddingTop: 48, paddingBottom: 64, paddingHorizontal: 52, lineHeight: 1.4 },
  head: { flexDirection: "row", justifyContent: "space-between", marginBottom: 28 },
  issuer: { width: "58%" },
  // Gold wordmark (public/crm/brand/logo-full.png, 500×70) top right.
  logo: { width: 170, height: 23.8 },
  issuerName: { fontSize: 11, color: INK, marginBottom: 2 },
  small: { fontSize: 8, color: MUTED },
  label: { fontSize: 7.5, color: MUTED, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.6 },
  title: { fontSize: 20, color: BRONZE, marginBottom: 18 },
  hair: { borderBottomWidth: 0.75, borderBottomColor: HAIR, borderBottomStyle: "solid" },
  recipient: { marginBottom: 22 },
  meta: { marginBottom: 22, borderTopWidth: 0.75, borderTopColor: HAIR, borderTopStyle: "solid" },
  metaRow: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 0.75, borderBottomColor: HAIR, borderBottomStyle: "solid" },
  metaKey: { width: "34%", color: MUTED, paddingRight: 8 },
  metaVal: { width: "66%" },
  amounts: { marginBottom: 14, borderTopWidth: 0.75, borderTopColor: HAIR, borderTopStyle: "solid" },
  amtRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 0.75, borderBottomColor: HAIR, borderBottomStyle: "solid" },
  amtStrong: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1.5, borderBottomColor: BRONZE, borderBottomStyle: "solid" },
  amtLabel: { width: "70%", paddingRight: 8 },
  amtVal: { width: "30%", textAlign: "right" },
  strongText: { fontSize: 11.5, color: BRONZE },
  note: { marginBottom: 8, color: INK },
  muted: { color: MUTED, marginBottom: 8 },
  footer: { position: "absolute", left: 52, right: 52, bottom: 30, paddingTop: 6, borderTopWidth: 0.75, borderTopColor: HAIR, borderTopStyle: "solid" },
  draft: { fontSize: 8.5, color: DRAFT, textAlign: "center" },
});

const h = React.createElement;

function CreditNote({ m }) {
  return h(Document, { title: `${m.title} ${m.number}`, author: m.issuerLines[0] ?? "", creator: "Cyprus VIP Estates CRM", producer: "Cyprus VIP Estates CRM" },
    h(Page, { size: "A4", style: s.page },
      h(View, { style: s.head },
        h(View, { style: s.issuer },
          h(Text, { style: s.label }, m.issuerLabel),
          typeof m.issuerIntro === "string" && m.issuerIntro ? h(Text, { style: s.small }, m.issuerIntro) : null,
          ...m.issuerLines.map((l, i) => h(Text, { key: `i${i}`, style: i === 0 ? s.issuerName : s.small }, l)),
        ),
        h(Image, { style: s.logo, src: LOGO }),
      ),
      h(Text, { style: s.title }, m.title),
      h(View, { style: s.recipient },
        h(Text, { style: s.label }, m.recipientLabel),
        ...m.recipientLines.map((l, i) => h(Text, { key: `r${i}` }, l)),
      ),
      h(View, { style: s.meta },
        ...[[m.numberLabel, m.number], [m.dateLabel, m.date], [m.referenceLabel, m.reference]].map(([k, v], i) =>
          h(View, { key: `m${i}`, style: s.metaRow, wrap: false }, h(Text, { style: s.metaKey }, k), h(Text, { style: s.metaVal }, v)),
        ),
      ),
      h(View, { style: s.amounts },
        ...m.rows.map((r, i) =>
          h(View, { key: `a${i}`, style: r.strong ? s.amtStrong : s.amtRow, wrap: false },
            h(Text, { style: r.strong ? [s.amtLabel, s.strongText] : s.amtLabel }, r.label),
            h(Text, { style: r.strong ? [s.amtVal, s.strongText] : s.amtVal }, r.amount),
          ),
        ),
      ),
      m.vatNote ? h(Text, { style: s.muted }, m.vatNote) : null,
      h(Text, { style: s.note }, m.paymentNote),
      h(Text, { style: s.muted }, m.selfBillingNote),
      m.draftFooter ? h(View, { style: s.footer, fixed: true }, h(Text, { style: s.draft }, m.draftFooter)) : null,
    ),
  );
}

async function main() {
  const raw = await readStdin();
  const model = JSON.parse(raw);
  const bad = validModel(model);
  if (bad) throw new Error(`invalid model: ${bad}`);
  const font = path.join(process.cwd(), "public", "fonts", "DejaVuSans.ttf");
  Font.register({ family: "DejaVu", fonts: [{ src: font }, { src: font, fontWeight: "bold" }] });
  // Never split words with hyphens (IBAN fragments, numbers, names).
  Font.registerHyphenationCallback((w) => [w]);
  const buf = await renderToBuffer(h(CreditNote, { m: model }));
  await new Promise((resolve, reject) => process.stdout.write(buf, (e) => (e ? reject(e) : resolve())));
}

main().then(
  () => process.exit(0),
  (e) => {
    process.stderr.write(`credit-note-pdf-worker: ${e && e.message ? e.message : String(e)}\n`);
    process.exit(1);
  },
);
