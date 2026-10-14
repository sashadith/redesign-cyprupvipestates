import fs from "fs";
import path from "path";
import type { GuideId } from "./registry";
import type { GuideLang } from "./types";

/** The guide PDFs are built ahead of time (scripts/guides/build-pdfs.mjs) and read from disk here.
 *  They are never rendered inside the server process: see render-one.tsx for why. */
const DIR = path.join(process.cwd(), "src", "lib", "guides", "pdf-files");
const cache = new Map<string, Buffer>();

export function readGuidePdf(id: GuideId, lang: GuideLang): Buffer {
  const key = `${id}.${lang}`;
  let buf = cache.get(key);
  if (!buf) {
    buf = fs.readFileSync(path.join(DIR, `${key}.pdf`));
    cache.set(key, buf);
  }
  return buf;
}
