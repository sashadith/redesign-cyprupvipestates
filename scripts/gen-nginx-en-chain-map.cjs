#!/usr/bin/env node
/* Regenerates the `cvp_en_final` map in the nginx config (ops/nginx/cyprusvipestates.conf).

   Why: nginx strips every /en prefix with a generic rule, then the app redirects a second time when the unprefixed
   URL is a retired project slug or a /preview-project/<slug> URL (301 -> /projects/old -> 308 -> /projects/new).
   Google still crawls hundreds of such /en/ URLs. The map sends each known chain start straight to the final page.

   Usage:  node scripts/gen-nginx-en-chain-map.cjs ops/nginx/cyprusvipestates.conf
   It rewrites only the block between "# BEGIN cvp_en_final" and "# END cvp_en_final", keeping every other line.
   Reads the production database (DATABASE_URL, tunnel on 5433) and checks every target against the live site: an
   entry is written only if the unprefixed URL really redirects AND the final page answers 200.

   Applying it is a manual server change (see ops/nginx/README.md): back up, copy, `nginx -t`, `systemctl reload nginx`.
   A slug missing from the map still works, it only costs the extra hop. */
require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

const FILE = process.argv[2];
if (!FILE) { console.error("usage: node scripts/gen-nginx-en-chain-map.cjs <nginx config file>"); process.exit(2); }
const BASE = process.env.CVP_BASE || "https://cyprusvipestates.com";
const REDIRECTS = [301, 302, 307, 308];
const p = new PrismaClient();

async function hop(path) {
  const r = await fetch(BASE + path, { redirect: "manual", headers: { Accept: "text/html" } });
  r.body?.cancel();
  return [r.status, r.headers.get("location")];
}

(async () => {
  const conf = fs.readFileSync(FILE, "utf8");
  const begin = conf.indexOf("# BEGIN cvp_en_final"), end = conf.indexOf("# END cvp_en_final");
  if (begin < 0 || end < begin) throw new Error("markers not found in " + FILE);

  const legacy = await p.$queryRaw`select distinct slug from projects where language = 'en'`;
  const hist = await p.$queryRaw`select slug from development_slug_history`;
  const devs = await p.$queryRaw`select slug from developments where slug is not null and "publishStatus" = 'published'`;
  const slugs = new Set([...legacy, ...hist].map((r) => r.slug).concat(["golf-residences"]));
  const cands = new Set();
  for (const s of slugs) { cands.add("/projects/" + s); cands.add("/preview-project/" + s); }
  for (const d of devs) cands.add("/preview-project/" + d.slug);

  // keys that already have their own exact location stay there
  const exact = new Set([...conf.matchAll(/location = (\/en\/[^\s{]+) \{ return 301/g)].map((m) => m[1]));
  const list = [...cands]; const rows = []; let i = 0;
  async function worker() {
    while (i < list.length) {
      const x = list[i++];
      try {
        const [st, loc] = await hop(x);
        if (!REDIRECTS.includes(st) || !loc) continue; // /en/x -> /x is then already a single hop
        let cur = loc.replace(BASE, ""), ok = false;
        for (let k = 0; k < 4; k++) {
          const [s2, l2] = await hop(cur);
          if (s2 === 200) { ok = true; break; }
          if (!REDIRECTS.includes(s2) || !l2) break;
          cur = l2.replace(BASE, "");
        }
        if (ok && !cur.startsWith("/en/") && !/[\s"';{}]/.test(cur) && !exact.has("/en" + x)) rows.push(["/en" + x, cur]);
      } catch { /* a fetch failure only costs one entry */ }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  rows.sort((a, b) => a[0].localeCompare(b[0]));

  const block = ["# BEGIN cvp_en_final (generated: scripts/gen-nginx-en-chain-map.cjs)", "map $uri $cvp_en_final {", '    default "";', ...rows.map(([k, v]) => `    ${k} ${v};`), "}"].join("\n");
  const endLine = conf.indexOf("\n", end);
  fs.writeFileSync(FILE, conf.slice(0, begin) + block + "\n" + conf.slice(end, endLine < 0 ? undefined : endLine) + (endLine < 0 ? "" : conf.slice(endLine)));
  console.log(`wrote ${rows.length} entries between the markers of ${FILE}`);
  await p.$disconnect();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
