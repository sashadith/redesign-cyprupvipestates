#!/usr/bin/env node
// `pretest` guard — keep the generated Prisma client in step with prisma/schema.prisma
// before `npm test` reads enums out of it.
//
// WHY THIS EXISTS (2026-11-08)
// `node_modules/.prisma/client` is written by `prisma generate` and by nothing
// else: this package has no `postinstall`, and `git pull` never regenerates.
// So after any schema enum change the generated client silently lags behind the
// committed schema, and the drift-guard tests in src/lib/__tests__ — which
// compare a hand-maintained `as const` list against `Object.values(SomeEnum)`
// from "@prisma/client" — fail in a way that looks exactly like the *constant*
// having drifted:
//
//   • LEAD_STATUSES vs LeadStatus        → diff, "RESERVED" missing on the enum side
//   • NOTIFICATION_KINDS vs the enum     → TypeError: Cannot convert undefined or
//                                          null to object (the enum is absent entirely)
//
// Adding the "missing" member to the constant makes neither test pass and puts
// the edit in the wrong file. Regenerating is the fix, so do it automatically.
//
// SAFETY
// `prisma generate` reads only the schema and opens NO database connection, so
// this is safe even though .env.local points at the production database. It DOES
// write into node_modules/.prisma and node_modules/@prisma — see DEPLOYMENT.md,
// where a node_modules symlinked from a live release turned Prisma codegen into a
// write straight into that release. Hence the symlink refusal below: `npm test`
// must never become a write into someone else's node_modules.
//
// Escape hatch: CVP_SKIP_PRISMA_GENERATE=1 npm test

import { spawnSync } from "node:child_process";
import { lstatSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

if (process.env.CVP_SKIP_PRISMA_GENERATE === "1") {
  console.log("· pretest: skipping prisma generate (CVP_SKIP_PRISMA_GENERATE=1)");
  process.exit(0);
}

// Refuse to write through a symlink into a directory we do not own.
for (const rel of ["node_modules", "node_modules/.prisma", "node_modules/@prisma"]) {
  let st;
  try {
    st = lstatSync(join(repoRoot, rel));
  } catch {
    continue; // not there yet — `prisma generate` will create it
  }
  if (st.isSymbolicLink()) {
    console.error(
      `\npretest: ${rel} is a symlink, and \`prisma generate\` writes into it.\n` +
        "Refusing, so this test run cannot write into whatever it points at\n" +
        "(see DEPLOYMENT.md — a symlinked node_modules once turned Prisma codegen\n" +
        "into a write into the live release).\n\n" +
        "Use a real node_modules (npm ci), or skip codegen with:\n" +
        "  CVP_SKIP_PRISMA_GENERATE=1 npm test\n",
    );
    process.exit(1);
  }
}

// `prisma generate` validates datasource url = env("DATABASE_URL") and needs it to
// resolve, though it never connects. Supply the repo's dummy URL only when nothing
// else set one, so a fresh clone with no .env.local still works.
const env = { ...process.env };
if (!env.DATABASE_URL) env.DATABASE_URL = "postgresql://x:x@localhost:1/x";

const res = spawnSync(join(repoRoot, "node_modules/.bin/prisma"), ["generate"], {
  cwd: repoRoot,
  env,
  encoding: "utf8",
});

if (res.error || res.status !== 0) {
  console.error(res.stdout || "");
  console.error(res.stderr || String(res.error));
  console.error("\npretest: prisma generate failed — see above. The enum drift-guard tests cannot be trusted until it succeeds.\n");
  process.exit(1);
}

console.log("· pretest: prisma client generated from prisma/schema.prisma");
