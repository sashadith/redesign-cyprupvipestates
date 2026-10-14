// Usage: node scripts/guides/build-pdfs.mjs [--check]
// Builds src/lib/guides/pdf-files/<id>.<lang>.pdf for every guide, one fresh process per file, and writes
// manifest.json with a hash of (content + layout). `--check` only verifies the manifest is current (used by tests/CI).
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(root, "src/lib/guides/pdf-files");
const IDS = ["cost-of-buying", "buying-process", "rent-or-buy", "residency"];
const LANGS = ["en", "de", "pl", "ru"];
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const layout = fs.readFileSync(path.join(root, "src/lib/guides/pdf.tsx"));
const fonts = ["Regular", "Bold", "Italic", "BoldItalic"].map((f) => fs.readFileSync(path.join(root, `public/fonts/LiberationSans-${f}.ttf`)));
const layoutHash = sha(Buffer.concat([layout, ...fonts]));
const hashFor = (id, lang) => sha(Buffer.concat([fs.readFileSync(path.join(root, `src/lib/guides/content/${id}.${lang}.json`)), Buffer.from(layoutHash)]));
const manifestPath = path.join(outDir, "manifest.json");

const check = process.argv.includes("--check");
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};
let stale = 0;
fs.mkdirSync(outDir, { recursive: true });
for (const id of IDS) for (const lang of LANGS) {
  const key = `${id}.${lang}`, file = path.join(outDir, `${key}.pdf`), want = hashFor(id, lang);
  const current = fs.existsSync(file) && manifest[key] === want;
  if (check) { if (!current) { console.error(`STALE: ${key}`); stale++; } continue; }
  if (current) { console.log(`ok     ${key}`); continue; }
  const r = spawnSync(process.execPath, ["--import", "tsx", "scripts/guides/render-one.tsx", id, lang, file], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) { console.error(`FAILED ${key}`); process.exit(1); }
  manifest[key] = want;
  console.log(`built  ${key} ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
}
if (check) { if (stale) process.exit(1); console.log("all guide PDFs are current"); }
else fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
