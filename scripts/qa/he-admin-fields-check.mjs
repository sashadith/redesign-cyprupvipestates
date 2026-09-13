#!/usr/bin/env node
// Source assertions: the Hebrew columns must be wired in every write and read path.
// A missed key here fails silently at runtime (null column), not at compile time.
import { readFileSync } from "node:fs";
const checks = [
  ["src/app/admin/(panel)/developments/[id]/actions.ts", ["descriptionHE", "seoTitleHE", "seoDescHE"]],
  ["src/app/admin/(panel)/developments/areas/actions.ts", ["textHE"]],
  ["src/app/admin/(panel)/developments/[id]/page.tsx", ["descriptionHE"]],
  ["src/app/admin/(panel)/developments/areas/[slug]/page.tsx", ["textHE"]],
  ["src/lib/developmentRender.ts", ["descriptionHE"]],
  ["src/app/preview-project/ProjectPageBody.tsx", ["textHE"]],
  ["src/lib/seo/staleCopyFigures.ts", ["descriptionHE"]],
];
let fail = 0;
for (const [file, needles] of checks) {
  const src = readFileSync(file, "utf8");
  for (const n of needles) if (!src.includes(n)) { console.error(`MISSING ${n} in ${file}`); fail = 1; }
}
console.log(fail ? "he-admin-fields-check: FAIL" : "he-admin-fields-check: OK");
process.exit(fail);
