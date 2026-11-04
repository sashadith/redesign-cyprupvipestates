#!/usr/bin/env node
/* File a developer contract that was signed on paper, and its commission rate.
 *
 *   node --import tsx --env-file=.env.local scripts/developer-contract-import.mjs <file.json>          # dry run
 *   node --import tsx --env-file=.env.local scripts/developer-contract-import.mjs <file.json> --apply  # write
 *
 * The admin's Contract card is the normal way in. This exists for a contract
 * that arrives by e-mail rather than through a browser, and it writes the same
 * rows that card writes — with one difference it cannot avoid: the PDF.
 *
 * saveContractFile() writes into CONTRACTS_DIR (/var/www/shared-contracts),
 * which only the server can reach — contractStorage.ts says so explicitly, and
 * a laptop run would create a row pointing at a file the server does not have.
 * So the PDF is placed on the server FIRST (scp, 0600, inside a 0700 dir, the
 * same modes saveContractFile uses) and its uuid key passed in here. The
 * script re-checks that the key has the exact shape readContractFile demands,
 * because a key that fails that test makes the download throw for every
 * manager, forever, with the row looking perfectly healthy.
 *
 * It also writes the developer-default CommissionRate (developmentId null) and
 * stamps DeveloperAccount.commissionChangedAt — the Xellex bridge's
 * `changedSince` ORs on that column, and without the stamp no project of this
 * developer is ever re-sent with its new rate.
 *
 * What it does NOT write is an audit row: writeAudit needs a real CRM actor and
 * a script has none. A contract filed this way carries createdById = null. */
import fs from "node:fs";
import { prisma } from "../src/lib/prisma.ts";
import { Prisma } from "@prisma/client";
import { parseContractFields, firstTermEnd, currentTermEnd, dateToIso } from "../src/lib/developerContract.ts";

const FILE_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

const file = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!file) {
  console.error("usage: developer-contract-import.mjs <file.json> [--apply]");
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const problems = [];

const account = await prisma.developerAccount.findUnique({
  where: { slug: data.accountSlug },
  select: { id: true, name: true, commissionChangedAt: true },
});
if (!account) {
  console.error(`✗ no developer account with slug "${data.accountSlug}"`);
  process.exit(1);
}

// Same validation the admin action runs, so a script-filed contract can never
// hold a shape the form would have rejected.
const parsed = parseContractFields(data.contract);
if (!parsed.ok) problems.push(`contract fields: ${parsed.error}`);
if (!FILE_KEY.test(data.fileKey ?? "")) problems.push(`fileKey "${data.fileKey}" is not <uuid>.pdf — readContractFile would throw on every download`);
if (!Number.isInteger(data.fileSize) || data.fileSize <= 0) problems.push("fileSize must be the byte count of the file on the server");
if (data.commissionRatePercent != null) {
  const r = Number(data.commissionRatePercent);
  if (!(r > 0 && r <= 100)) problems.push(`commissionRatePercent ${data.commissionRatePercent} is out of range`);
}

const existing = await prisma.developerContract.findMany({
  where: { developerAccountId: account.id },
  select: { id: true, signedAt: true, fileName: true },
  orderBy: { signedAt: "desc" },
});

console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${file}`);
console.log(`developer: ${account.name} (${data.accountSlug})`);
console.log(`contracts already on file: ${existing.length}${existing.length ? " — " + existing.map((e) => dateToIso(e.signedAt)).join(", ") : ""}`);

if (parsed.ok) {
  const f = parsed.value;
  const today = new Date().toISOString().slice(0, 10);
  console.log(`\nsigned        ${f.signedAt}`);
  console.log(`term          ${f.termMonths} month(s)${f.autoRenew ? ", auto-renewing" : ""}`);
  console.log(`first term to ${firstTermEnd(f.signedAt, f.termMonths)}`);
  console.log(`current term  ${currentTermEnd({ signedAt: f.signedAt, termMonths: f.termMonths, autoRenew: f.autoRenew }, today)}`);
  console.log(`reminders     ${f.autoRenew ? "none — auto-renewing contracts get no renewal reminder (operator spec 2026-10-29)" : "14 days and 1 day before the end"}`);
  console.log(`commission    contract says ${f.commissionPercent ?? "—"}%`);
  console.log(`file          ${data.fileName}  ${data.fileSize} bytes  key ${data.fileKey}`);
  if (f.note) console.log(`note          ${f.note}`);
}

if (data.commissionRatePercent != null) {
  const rows = await prisma.commissionRate.findMany({
    where: { developerAccountId: account.id },
    select: { developmentId: true, ratePercent: true },
  });
  const devDefault = rows.find((r) => r.developmentId === null);
  console.log(`\ncommission rate (developer default): ${devDefault ? `${devDefault.ratePercent}%` : "none"} → ${data.commissionRatePercent}%`);
  console.log(`project overrides untouched: ${rows.filter((r) => r.developmentId).length}`);
  console.log(`commissionChangedAt: ${account.commissionChangedAt ? account.commissionChangedAt.toISOString() : "null"} → now (makes the Xellex bridge re-send this developer's projects)`);
}

if (problems.length) {
  console.error("\nREFUSING — fix these first:");
  for (const p of problems) console.error(`  ✗ ${p}`);
  await prisma.$disconnect();
  process.exit(1);
}

if (APPLY) {
  const f = parsed.value;
  await prisma.$transaction(async (tx) => {
    const row = await tx.developerContract.create({
      data: {
        developerAccountId: account.id,
        signedAt: new Date(`${f.signedAt}T00:00:00Z`),
        termMonths: f.termMonths,
        autoRenew: f.autoRenew,
        commissionPercent: f.commissionPercent,
        note: f.note,
        fileName: data.fileName,
        fileKey: data.fileKey,
        fileSize: data.fileSize,
        createdById: null,
      },
    });
    console.log(`\ncontract written → ${row.id}`);

    if (data.commissionRatePercent != null) {
      const rate = new Prisma.Decimal(String(data.commissionRatePercent));
      const current = await tx.commissionRate.findFirst({ where: { developerAccountId: account.id, developmentId: null }, select: { id: true } });
      if (current) await tx.commissionRate.update({ where: { id: current.id }, data: { ratePercent: rate, note: data.commissionRateNote ?? null } });
      else await tx.commissionRate.create({ data: { developerAccountId: account.id, developmentId: null, ratePercent: rate, note: data.commissionRateNote ?? null } });
      await tx.developerAccount.update({ where: { id: account.id }, data: { commissionChangedAt: new Date() } });
      console.log(`rate written    ${data.commissionRatePercent}% (developer default), commissionChangedAt stamped`);
    }
  });
  console.log(`\nadmin: /admin/developments/developers/${account.id}`);
  console.log("NOTE: no audit row — a script has no CRM actor; createdById is null.");
} else {
  console.log("\ndry run clean — re-run with --apply");
}
await prisma.$disconnect();
