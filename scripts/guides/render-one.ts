// Usage: node --import tsx scripts/guides/render-one.ts <id> <lang> <outFile>
// Prints ONE guide to PDF: renders the branded HTML (src/lib/guides/html.ts) and has headless Chrome print it.
// One fresh Chrome process (own temporary profile, so a Chrome you have open is never touched) per file: no
// state is shared between documents, and the server never renders anything (it serves the prebuilt PDFs).
// Chrome path: $CHROME_BIN, else the macOS default location.
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { renderGuideHtml } from "../../src/lib/guides/html";

const CHROME = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function main() {
  const [id, lang, out] = process.argv.slice(2);
  if (!id || !lang || !out) { console.error("usage: render-one.ts <id> <lang> <outFile>"); process.exit(2); }
  if (!fs.existsSync(CHROME)) { console.error(`Chrome not found at ${CHROME}; set CHROME_BIN`); process.exit(1); }
  const root = process.cwd();
  const content = JSON.parse(fs.readFileSync(path.join(root, `src/lib/guides/content/${id}.${lang}.json`), "utf8"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "guide-"));
  try {
    const html = path.join(tmp, "guide.html");
    fs.writeFileSync(html, renderGuideHtml(content, id, root));
    const r = spawnSync(
      CHROME,
      [
        "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
        `--user-data-dir=${path.join(tmp, "profile")}`,
        "--no-pdf-header-footer", "--virtual-time-budget=20000",
        `--print-to-pdf=${path.resolve(out)}`, `file://${html}`,
      ],
      { stdio: ["ignore", "ignore", "pipe"], timeout: 120_000 },
    );
    if (!fs.existsSync(out) || fs.statSync(out).size < 20_000) {
      console.error(`Chrome produced no usable PDF (exit ${r.status})\n${String(r.stderr).slice(-600)}`);
      process.exit(1);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
main();
