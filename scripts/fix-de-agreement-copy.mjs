/* One-off copy fix: the German consent line under the contact form.

     originally: "Ich stimme den allgemeinen Geschäftsbedingungen und der
                  Datenschutzrichtlinie zu"   (the WHOLE phrase was one link,
                  pointing only at the privacy policy — the terms it named were
                  not reachable at all)
     now:        "Ich stimme den AGB und der Datenschutzrichtlinie zu"
                  with AGB -> /de/geschaftsbedingungen
                  and Datenschutzrichtlinie -> /de/datenschutzrichtlinie

   Uses the optional second-link fields added to the form type, so a consenting
   user can actually open both documents. en/pl/ru are untouched and keep the
   single-link shape.

   Idempotent: reports and exits if the values are already in place, aborts if
   they are something other than the two known states. Whitespace is normalised
   before comparing because the stored label used a non-breaking space. */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const AFTER = {
  agreementText: "Ich stimme den",
  agreementLinkLabel: "AGB",
  agreementLinkDestination: "/de/geschaftsbedingungen",
  agreementText2: "und der",
  agreementLink2Label: "Datenschutzrichtlinie",
  agreementLink2Destination: "/de/datenschutzrichtlinie",
  agreementTextEnd: "zu",
};

// The two shapes this document is known to be in before the fix.
const KNOWN_BEFORE = [
  { agreementText: "Ich stimme den", agreementLinkLabel: "allgemeinen Geschäftsbedingungen und der Datenschutzrichtlinie zu" },
  { agreementText: "Ich stimme den AGBs und der", agreementLinkLabel: "Datenschutzrichtlinie zu" },
];

const prisma = new PrismaClient();
const norm = (v) => (typeof v === "string" ? v.replace(/ /g, " ").trim() : v);

const row = await prisma.siteDocument.findUnique({
  where: { type_language: { type: "formStandardDocument", language: "de" } },
});
if (!row) {
  console.log("ABORT: no german formStandardDocument.");
  await prisma.$disconnect();
  process.exit(1);
}

const data = row.data ?? {};
const form = data.form ?? {};

const alreadyDone =
  norm(form.agreementLinkLabel) === AFTER.agreementLinkLabel &&
  norm(form.agreementLink2Label) === AFTER.agreementLink2Label;
if (alreadyDone) {
  console.log("already applied — nothing to do.");
  await prisma.$disconnect();
  process.exit(0);
}

const matchesKnown = KNOWN_BEFORE.some(
  (b) => norm(form.agreementText) === b.agreementText && norm(form.agreementLinkLabel) === b.agreementLinkLabel
);
if (!matchesKnown) {
  console.log("ABORT: current values are not a known previous state:");
  console.log(`   agreementText:      ${JSON.stringify(form.agreementText)}`);
  console.log(`   agreementLinkLabel: ${JSON.stringify(form.agreementLinkLabel)}`);
  await prisma.$disconnect();
  process.exit(1);
}

await prisma.siteDocument.update({
  where: { id: row.id },
  data: { data: { ...data, form: { ...form, ...AFTER } } },
});

const after = await prisma.siteDocument.findUnique({
  where: { type_language: { type: "formStandardDocument", language: "de" } },
});
const f = after.data.form;
console.log("updated. rendered line:");
console.log(`   ${f.agreementText} [${f.agreementLinkLabel}] ${f.agreementText2} [${f.agreementLink2Label}] ${f.agreementTextEnd}`);
console.log(`   link 1 -> ${f.agreementLinkDestination}`);
console.log(`   link 2 -> ${f.agreementLink2Destination}`);

await prisma.$disconnect();
