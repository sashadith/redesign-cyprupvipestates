#!/usr/bin/env node
/* One-off fixture capture for the Plus Properties connector. Runs ON THE VPS:
   the Drive OAuth credentials and poppler's pdftotext live there, not on a
   laptop. Read-only against Drive and the developer's website.

     scp scripts/plus-capture-fixtures.mjs root@72.60.89.239:/tmp/
     ssh root@72.60.89.239 'cd /tmp && node plus-capture-fixtures.mjs'
     scp -r root@72.60.89.239:/tmp/plus-fixtures/. scripts/qa/fixtures/plus/
*/
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const OUT = "/tmp/plus-fixtures";
mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(readFileSync("/var/www/cyprusvipestates/.env", "utf8").split("\n")
  .filter((l) => /^GOOGLE_(CLIENT_ID|CLIENT_SECRET|REFRESH_TOKEN)=/.test(l))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")]; }));
const tok = (await (await fetch("https://oauth2.googleapis.com/token", {
  method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: env.GOOGLE_REFRESH_TOKEN, grant_type: "refresh_token" }),
})).json()).access_token;
const H = { Authorization: "Bearer " + tok };
const bytes = async (id) => Buffer.from(await (await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers: H })).arrayBuffer());

// Workbook ids, measured 2026-09-25. Each fixture exists for one trap (spec §"The traps").
const XML = {
  "33": "1cqCUkn9zk9NtU2NYkH1T2Sfa6Y3k1gT-",          // plain; one white price on a sold unit
  "57": "19-TDr8NvtnI_n93BuoG60p8BcR5dpevG",          // four hidden sheets, one a stale price list
  "87": "1nWnw9PQBxhwgQbdMTJVfylqVIQuCr9Xi",          // two stale VISIBLE sheets ("before TD", "after TD")
  "60": "1B_hG3XjSA_lNNUv9JepHeiAu6exOaa1g",          // "Villa No", two-row header
  "75": "1zHKvTgaB5VWyDav6MekoHb7a8p5f75c3",          // two-storey villas, swapped columns, Price €/OLD
  "67-68-69": "18yuec1ncdyRcZmuZ6zPEOLIzhaTHDml1",    // "&" in the sheet name, Project column
  "59": "1ZvFLf6Jpo4LjvBygPU5wyimVojkSIS9r",          // shops (commercial), wrapped PDF rows
  "63": "1dE4NLHOvBM_w7jFB3W8wfaKOwroxZDdL",          // white prices on sold/reserved units
  "house-kiti": "1ZF9OvvQra05oJPe_CmknhqxYTWkigtOF",  // a house, not a table
  "21": "1S0W0-s3H4mgnPp95k9jHMsYw2h8621Kf",          // a hidden "avail" sheet beside the visible one
};
for (const [key, id] of Object.entries(XML)) writeFileSync(`${OUT}/plus-${key}.xml`, await bytes(id));

// PDFs: matched by their project number in the PDF folder's listing.
const q = encodeURIComponent(`'14Kg7ggLA10DIHqY-fQk2L-BGvN27g5JZ' in parents and trashed=false`);
const pdfs = (await (await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`, { headers: H })).json()).files;
const keyOf = (n) => /house\s*-?\s*kiti/i.test(n) ? "house-kiti" : (n.match(/plus\s*(\d+(?:[-_]\d+)*)/i)?.[1] ?? "").replace(/_/g, "-");
for (const f of pdfs) {
  const key = keyOf(f.name);
  if (!(key in XML)) continue;
  writeFileSync(`/tmp/plus-${key}.pdf`, await bytes(f.id));
  writeFileSync(`${OUT}/plus-${key}.pdf.txt`, execFileSync("pdftotext", ["-layout", `/tmp/plus-${key}.pdf`, "-"]));
}

// One website page, for the Project Details reader.
const page = await fetch("https://www.pluspropertiescyprus.com/plus-33---universal/57/plus-33---universal");
writeFileSync(`${OUT}/plus-33-page.html`, Buffer.from(await page.arrayBuffer()));
console.log("captured:", execFileSync("ls", [OUT]).toString().trim().split("\n").length, "files");
