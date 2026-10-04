/* Content Offensive Plan — uploads the facts infographic + illustration
   for "Pros and Cons of Living in Cyprus" (same pipeline-replication
   approach as upload-banking-article-images.mjs) and inserts them into
   all 4 language versions: illustration after the opening paragraph,
   infographic right before the Pros section. */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import crypto from "node:crypto";

const prisma = new PrismaClient();
const MAX_EDGE = 2560;
const QUALITY = 82;
const VPS = "root@72.60.89.239";
const SSH_KEY = `${process.env.HOME}/.ssh/cvp_vps`;
const REMOTE_DIR = "/var/www/shared-uploads/images";
const key = () => `pci${Math.random().toString(36).slice(2, 10)}`;

async function processImage(input) {
  const img = sharp(input, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  const tooBig = (meta.width ?? 0) > MAX_EDGE || (meta.height ?? 0) > MAX_EDGE;
  let pipe = tooBig ? img.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true }) : img;
  let ext, mime;
  if (meta.hasAlpha) { pipe = pipe.png({ compressionLevel: 9, palette: true }); ext = "png"; mime = "image/png"; }
  else { pipe = pipe.jpeg({ quality: QUALITY, mozjpeg: true }); ext = "jpg"; mime = "image/jpeg"; }
  const out = await pipe.toBuffer({ resolveWithObject: true });
  return { buf: out.data, ext, mime, width: out.info.width, height: out.info.height };
}

const FILES = [
  { path: "scratchpad/infographic-cyprus-facts.png", alt: "Cyprus quick facts: GDP growth, safety index, summer heat, Schengen status" },
  { path: "scratchpad/pros-cons-illustration.png", alt: "Living in Cyprus" },
];

async function upload() {
  const results = [];
  for (const f of FILES) {
    const raw = fs.readFileSync(f.path);
    const p = await processImage(raw);
    const hash = crypto.createHash("sha1").update(p.buf).digest("hex");
    const base = `${hash}-${p.width}x${p.height}.${p.ext}`;
    const ref = `image-${hash}-${p.width}x${p.height}-${p.ext}`;
    const url = `/uploads/images/${base}`;
    const localTmp = `/tmp/${base}`;
    fs.writeFileSync(localTmp, p.buf);
    execFileSync("ssh", ["-i", SSH_KEY, VPS, "mkdir", "-p", REMOTE_DIR], { stdio: "inherit" });
    execFileSync("scp", ["-i", SSH_KEY, localTmp, `${VPS}:${REMOTE_DIR}/${base}`], { stdio: "inherit" });
    await prisma.media.upsert({
      where: { sanityAssetId: ref },
      update: { url, path: url },
      create: { sanityAssetId: ref, filename: base, originalFilename: f.path.split("/").pop(), path: url, url, mimeType: p.mime, fileSize: p.buf.length, width: p.width, height: p.height, folder: "blog" },
    });
    console.log(`Uploaded ${f.path} -> ${ref}`);
    results.push({ ...f, ref });
    fs.unlinkSync(localTmp);
  }
  return results;
}

function imageFullBlock(ref, alt) {
  return { _key: key(), _type: "imageFullBlock", title: "", imageMain: { picture: { alt, _type: "image", asset: { _ref: ref, _type: "reference" } }, aspectRatio: "16:9" }, hasDescription: false };
}

const ROWS = [
  { lang: "en", id: "d5c86c41-75c3-4814-a7ef-1a1ebcce1106", prosMarker: "Pros of Living in Cyprus" },
  { lang: "de", id: "b2af9167-fc0c-4c37-9e7f-4260e636c5c6", prosMarker: "Vorteile des Lebens auf Zypern" },
  { lang: "pl", id: "94fc2cdd-40cf-4143-b555-4b3b7a8f1ae6", prosMarker: "Zalety życia na Cyprze" },
  { lang: "ru", id: "2d53d399-d2aa-4352-9785-58ed2b9f90c2", prosMarker: "Плюсы жизни на Кипре" },
];

function blockText(b) {
  if (b._type !== "textContent" || !Array.isArray(b.content)) return "";
  return b.content.map((c) => (c.children || []).map((ch) => ch.text).join("")).join(" ");
}

async function insert(refs) {
  const infographic = refs.find((r) => r.path.includes("facts"));
  const illustration = refs.find((r) => r.path.includes("illustration"));

  for (const row of ROWS) {
    const rec = await prisma.blog.findUnique({ where: { id: row.id } });
    if (!rec) throw new Error(`ABORT: ${row.lang} row not found`);
    if (rec.status !== "SCHEDULED") throw new Error(`ABORT: ${row.lang} status is ${rec.status}, expected SCHEDULED`);
    const blocks = rec.contentBlocks;
    if (blocks.some((b) => b._type === "imageFullBlock")) { console.log(`SKIPPED ${row.lang}: already has images`); continue; }

    const prosIdx = blocks.findIndex((b) => blockText(b).includes(row.prosMarker));
    if (prosIdx === -1) throw new Error(`ABORT: ${row.lang} couldn't find pros marker`);

    const out = [...blocks];
    out.splice(prosIdx, 0, imageFullBlock(infographic.ref, infographic.alt)); // before Pros section
    out.splice(1, 0, imageFullBlock(illustration.ref, illustration.alt)); // after intro
    await prisma.blog.update({ where: { id: row.id }, data: { contentBlocks: out } });
    console.log(`${row.lang}: inserted illustration + facts infographic`);
  }
}

async function main() {
  const refs = await upload();
  await insert(refs);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
