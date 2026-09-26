#!/usr/bin/env node
/* Guard for the no-figures rule in the project-description generator
   (src/lib/ai/projectDescription.ts, descriptionHasFigures).

   Reported 2026-09-26 on Plus 38: "Description generation failed after retry:
   contains figures". The rule rejected EVERY digit, including the one in the
   project's own name, so no description could ever be generated for a
   numbered project (all 35 Plus Properties projects, plus Glow 2, Abiete 2 …).
   A digit inside the project's or developer's name is allowed; every other
   digit is still a figure.

     node scripts/qa/description-figures-check.mjs */
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

let build;
try { ({ build } = await import("esbuild")); }
catch { console.error("esbuild is not installed (it is only a transitive dependency)."); process.exit(2); }
process.env.DATABASE_URL = "postgresql://unused:unused@127.0.0.1:1/unused";
const scratch = join(process.cwd(), "node_modules", ".description-figures-check");
mkdirSync(scratch, { recursive: true });
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
const out = await build({
  entryPoints: ["src/lib/ai/projectDescription.ts"], bundle: true, platform: "node", format: "esm", write: false,
  external: ["@prisma/client", ".prisma/client/default", "@anthropic-ai/sdk", "canvas", "sharp"],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
writeFileSync(join(scratch, "d.mjs"), out.outputFiles[0].text);
const { descriptionHasFigures } = await import(join(scratch, "d.mjs"));

let failures = 0;
const check = (name, actual, expected) => {
  if (actual === expected) { console.log(`  ok   ${name}`); return; }
  failures++; console.log(`  FAIL ${name}\n       expected ${expected}\n       actual   ${actual}`);
};
const all = (t) => ({ en: t, de: t, pl: t, ru: t, he: "פרויקט " + t });
const names = ["Plus 38", "Plus Properties"];

check("the project's own number is not a figure", descriptionHasFigures(all("Plus 38 sits near Mackenzie beach."), names), false);
check("…in any case", descriptionHasFigures(all("PLUS 38 by the sea."), names), false);
check("a joined name", descriptionHasFigures(all("Plus 67-68-69 in Parekklisia."), ["Plus 67-68-69"]), false);
check("a price is still a figure", descriptionHasFigures(all("Plus 38 from €350,000."), names), true);
check("a distance is still a figure", descriptionHasFigures(all("Plus 38 is 2 minutes from the beach."), names), true);
check("a bedroom count in digits is still a figure", descriptionHasFigures(all("Plus 38 offers 3-bedroom homes."), names), true);
check("the name's digits elsewhere are still figures", descriptionHasFigures(all("Plus 38 has 38 flats."), names), true);
check("one locale with a figure is enough", descriptionHasFigures({ ...all("Plus 38."), de: "Plus 38 mit 5 Etagen." }, names), true);
check("no name given: any digit is a figure", descriptionHasFigures(all("Plus 38."), []), true);
check("a clean text passes", descriptionHasFigures(all("Two-bedroom homes close to the sea."), names), false);
check("a numbered developer name", descriptionHasFigures(all("Built by Studio 7 near the marina."), ["Seaside", "Studio 7"]), false);

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
