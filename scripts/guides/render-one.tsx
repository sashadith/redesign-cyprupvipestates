// Usage: node --import tsx scripts/guides/render-one.tsx <id> <lang> <outFile>
// Renders ONE guide in a fresh process. Do not render several guides in one process: react-pdf shares font
// subset state between documents and later documents lose or swap glyphs (a missing "H", "H" -> ","). That is
// why the PDFs are built ahead of time by build-pdfs.mjs, one process per file, and served as static files.
import React from "react";
import fs from "fs";
import { renderToBuffer } from "@react-pdf/renderer";
import { GuideDocument } from "../../src/lib/guides/pdf";

async function main() {
  const [id, lang, out] = process.argv.slice(2);
  if (!id || !lang || !out) { console.error("usage: render-one.tsx <id> <lang> <outFile>"); process.exit(2); }
  const content = JSON.parse(fs.readFileSync(`src/lib/guides/content/${id}.${lang}.json`, "utf8"));
  const buf = await renderToBuffer(<GuideDocument content={content} id={id} />);
  fs.writeFileSync(out, buf);
}
main().catch((e) => { console.error(e); process.exit(1); });
