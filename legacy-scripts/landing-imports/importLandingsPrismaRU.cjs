#!/usr/bin/env node
/* Russian landing-page importer — a separate copy of the DE importer (leaves the DE
   pipeline untouched). Reads scripts/ru-landings.csv (one row per NEW Russian page) +
   companion ru-content/*.md, builds the 6-block commercial template, and upserts a
   DRAFT `singlepage` row (language "ru"). Paired to the EN page via translationGroupId.

   Usage (on a host with the prod DB + prisma client):
     node scripts/importLandingsPrismaPL.cjs            # DRY RUN
     node scripts/importLandingsPrismaPL.cjs --write     # upsert DRAFT rows
     node scripts/importLandingsPrismaPL.cjs --write --only=<slug-ru>
   status is set only on create — re-importing content never (un)publishes a page. */
const path = require("path");
const fs = require("fs");
const { PrismaClient } = require(path.resolve(process.cwd(), "node_modules/@prisma/client"));
const prisma = new PrismaClient();
const WRITE = process.argv.includes("--write");
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").split("=")[1] || "";
const k = (p) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

function splitCsvLine(line) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else { if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c; }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}
function parseCSV(txt) {
  const lines = txt.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim());
  const header = splitCsvLine(lines[0]);
  return lines.slice(1).map((l) => { const cells = splitCsvLine(l); const o = {}; header.forEach((h, i) => (o[h] = cells[i] || "")); return o; });
}

function mdToPT(text = "") {
  const lines = String(text).replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  const parseInline = (str, i) => {
    const children = []; const markDefs = [];
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g;
    let last = 0, m;
    const pushText = (t) => { if (t) children.push({ _key: k(`span-${i}`), _type: "span", text: t, marks: [] }); };
    while ((m = linkRegex.exec(str)) !== null) {
      const before = str.slice(last, m.index); if (before) pushText(before);
      const key = k(`link-${i}`);
      markDefs.push({ _key: key, _type: "link", href: m[2] });
      children.push({ _key: k(`span-${i}`), _type: "span", text: m[1], marks: [key] });
      last = m.index + m[0].length;
    }
    const tail = str.slice(last); if (tail) pushText(tail);
    const applyMarks = (node, mark) => {
      const isBold = mark === "strong";
      const re = isBold ? /\*\*([^*]+)\*\*/g : /\*([^*]+)\*/g;
      const src = node.text; let lastIdx = 0, mm; const out = [];
      while ((mm = re.exec(src)) !== null) {
        if (mm.index > lastIdx) out.push({ ...node, _key: node._key + `-t${out.length}`, text: src.slice(lastIdx, mm.index), marks: node.marks || [] });
        out.push({ ...node, _key: node._key + `-m${out.length}`, text: mm[1], marks: [...(node.marks || []), mark] });
        lastIdx = mm.index + mm[0].length;
      }
      if (lastIdx < src.length) out.push({ ...node, _key: node._key + `-t${out.length}`, text: src.slice(lastIdx), marks: node.marks || [] });
      return out;
    };
    let flat = [];
    children.forEach((n) => applyMarks(n, "strong").forEach((b) => flat.push(...applyMarks(b, "em"))));
    if (!flat.length) flat = [{ _key: k(`span-${i}`), _type: "span", text: "", marks: [] }];
    return { children: flat, markDefs };
  };
  lines.forEach((raw, i) => {
    const line = raw.replace(/\t/g, "    ");
    if (!line.trim()) return;
    let m;
    if ((m = line.match(/^###\s+(.*)$/))) { const { children, markDefs } = parseInline(m[1], i); return void blocks.push({ _key: k(`pt-${i}`), _type: "block", style: "h3", markDefs, children }); }
    if ((m = line.match(/^##\s+(.*)$/))) { const { children, markDefs } = parseInline(m[1], i); return void blocks.push({ _key: k(`pt-${i}`), _type: "block", style: "h2", markDefs, children }); }
    if ((m = line.match(/^(?:-|\*)\s+(.*)$/))) { const { children, markDefs } = parseInline(m[1], i); return void blocks.push({ _key: k(`pt-${i}`), _type: "block", style: "normal", listItem: "bullet", level: 1, markDefs, children }); }
    if ((m = line.match(/^\d+\.\s+(.*)$/))) { const { children, markDefs } = parseInline(m[1], i); return void blocks.push({ _key: k(`pt-${i}`), _type: "block", style: "normal", listItem: "number", level: 1, markDefs, children }); }
    const { children, markDefs } = parseInline(line, i);
    blocks.push({ _key: k(`pt-${i}`), _type: "block", style: "normal", markDefs, children });
  });
  return blocks;
}

const img = (ref, alt) => ({ alt, _type: "image", asset: { _ref: ref, _type: "reference" } });

function parseContentFile(rel) {
  const txt = fs.readFileSync(path.resolve(__dirname, rel), "utf8").replace(/\r\n/g, "\n");
  const sec = (name) => { const m = txt.match(new RegExp("===\\s*" + name + "\\s*===\\n([\\s\\S]*?)(?=\\n===\\s*[A-Z0-9]+\\s*===|$)")); return m ? m[1].trim() : ""; };
  const faqRaw = sec("FAQ");
  const faqItems = []; let cur = null;
  faqRaw.split("\n").forEach((line) => {
    const q = line.match(/^Q:\s*(.*)/); const a = line.match(/^A:\s*(.*)/);
    if (q) { if (cur) faqItems.push(cur); cur = { question: q[1].trim(), answerLines: [] }; }
    else if (a && cur) { cur.answerLines.push(a[1]); }
    else if (cur) { cur.answerLines.push(line); }
  });
  if (cur) faqItems.push(cur);
  return { bodyFirst: sec("BODY1"), bodySecond: sec("BODY2"), faqItems: faqItems.map((it) => ({ question: it.question, answerMd: it.answerLines.join("\n").trim() })) };
}

function buildBlocks(row, c) {
  const blocks = [];
  blocks.push({ _key: k("b-intro-ru"), _type: "landingIntroBlock", image: img(row.image_ref, row.intro_title_ru), title: row.intro_title_ru, subtitle: row.intro_subtitle_ru, buttonLabel: row.intro_button_ru || "Смотреть проекты", description: row.intro_desc_ru });
  const proj = { _key: k("b-proj-ru"), _type: "landingProjectsBlock", title: row.projects_title_ru };
  if (row.projects_city) proj.filterCity = row.projects_city;
  if (row.projects_type) proj.filterPropertyType = row.projects_type;
  blocks.push(proj);
  blocks.push({ _key: k("b-tf-ru"), _type: "landingTextFirst", content: mdToPT(c.bodyFirst) });
  const items = c.faqItems.map((it, i) => ({ _key: k(`faq-ru-${i}`), question: it.question, answer: mdToPT(it.answerMd) }));
  blocks.push({ _key: k("b-faq-ru"), _type: "landingFaqBlock", title: row.faq_title_ru || "Часто задаваемые вопросы", faq: { _type: "accordionBlock", items } });
  blocks.push({ _key: k("b-ts-ru"), _type: "landingTextSecond", content: mdToPT(c.bodySecond) });
  return blocks;
}

async function run() {
  const rows = parseCSV(fs.readFileSync(path.resolve(__dirname, "ru-landings.csv"), "utf8"));
  console.log(`${rows.length} row(s) in ru-landings.csv | mode: ${WRITE ? "WRITE" : "DRY RUN"}${ONLY ? ` | only=${ONLY}` : ""}\n`);
  for (const row of rows) {
    if (!row.slug_ru) continue;
    if (ONLY && row.slug_ru !== ONLY) continue;
    let tgid = null;
    if (row.en_slug) {
      const en = await prisma.singlepage.findFirst({ where: { language: "en", slug: row.en_slug } });
      if (!en) { console.log(`⚠ ${row.slug_ru}: EN page "${row.en_slug}" not found — skipping`); continue; }
      tgid = en.translationGroupId || `single-${row.en_slug}.i18n`;
      if (!en.translationGroupId && WRITE) await prisma.singlepage.update({ where: { id: en.id }, data: { translationGroupId: tgid } });
    }
    const relSlugs = String(row.related_slugs_ru || "").split(",").map((s) => s.trim()).filter(Boolean);
    const related = [];
    for (const rs of relSlugs) {
      const r = await prisma.singlepage.findFirst({ where: { language: "ru", slug: rs }, select: { sanityId: true } });
      if (r) related.push({ _key: k("rel"), _ref: r.sanityId, _type: "singlepageRef" });
    }
    const content = parseContentFile(row.content_file);
    const sanityId = `local-ru-${row.slug_ru}`;
    const data = {
      sanityId, translationGroupId: tgid, language: "ru", slug: row.slug_ru,
      title: row.intro_title_ru, excerpt: row.excerpt_ru || row.meta_desc_ru,
      allowIntroBlock: false, previewImage: img(row.image_ref, row.meta_title_ru),
      seo: { metaTitle: row.meta_title_ru, metaDescription: row.meta_desc_ru },
      contentBlocks: buildBlocks(row, content), relatedLandingPages: related,
    };
    const blocks = data.contentBlocks;
    console.log(`• ${row.slug_ru}  [EN:${row.en_slug || "-"}]  faq:${blocks.find((b) => b._type === "landingFaqBlock").faq.items.length}  bodyFirst:${blocks.find((b) => b._type === "landingTextFirst").content.length}pt  related:${related.length}  filter:${row.projects_city || "-"}/${row.projects_type || "-"}`);
    if (WRITE) {
      const before = await prisma.singlepage.findUnique({ where: { sanityId }, select: { status: true } });
      await prisma.singlepage.upsert({ where: { sanityId }, update: data, create: { ...data, status: "DRAFT" } });
      console.log(`  ✓ upserted ${sanityId} (status: ${before?.status ?? "DRAFT (new)"})`);
    }
  }
  await prisma.$disconnect();
}
run().catch((e) => { console.error("ERR", e.message); process.exit(1); });
