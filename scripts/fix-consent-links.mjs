/* Give the consent line under the contact form a link to the terms as well as
   the privacy policy, in en / pl / ru. (German was done separately in
   scripts/fix-de-agreement-copy.mjs.)

   Until now the line linked only the privacy policy, so a visitor ticked a box
   agreeing to terms they had no way to read.

   Every locale links its OWN terms page. The Polish and Russian ones already
   existed and were published — they are named /pl/warunki and
   /ru/uslovija-i-polozhenija, which is why a slug search for "terms/agb/
   bedingungen" did not turn them up.

   Also fixes a homoglyph in the Russian text: it began with a LATIN "C"
   (U+0043) instead of a Cyrillic "С" (U+0421) — identical on screen, but wrong
   for screen readers, search and copy-paste.

   Idempotent: each locale is skipped if the second link is already in place,
   and aborted if the current values are not the known previous ones. */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const PLAN = {
  en: {
    before: { agreementText: "I agree with the terms of the", agreementLinkLabel: "Data Privacy Policy" },
    after: {
      agreementText: "I agree to the",
      agreementLinkLabel: "Terms and Conditions",
      agreementLinkDestination: "/terms-and-conditions",
      agreementText2: "and the",
      agreementLink2Label: "Data Privacy Policy",
      agreementLink2Destination: "/privacy-policy",
      agreementTextEnd: "",
    },
  },
  pl: {
    before: { agreementText: "Zgadzam się z warunkami", agreementLinkLabel: "Polityki Prywatności" },
    after: {
      agreementText: "Zgadzam się z",
      agreementLinkLabel: "Regulaminem",
      agreementLinkDestination: "/pl/warunki",
      agreementText2: "i",
      agreementLink2Label: "Polityką Prywatności",
      agreementLink2Destination: "/pl/polityka-prywatnosci",
      agreementTextEnd: "",
    },
  },
  ru: {
    // NOTE: the stored value starts with a Latin "C", not Cyrillic "С".
    before: { agreementText: "Cогласен с условиями", agreementLinkLabel: "Политики конфиденциальности" },
    after: {
      agreementText: "Согласен с",
      agreementLinkLabel: "Условиями",
      agreementLinkDestination: "/ru/uslovija-i-polozhenija",
      agreementText2: "и",
      agreementLink2Label: "Политикой конфиденциальности",
      agreementLink2Destination: "/ru/politika-privatnosti",
      agreementTextEnd: "",
    },
  },
};

const prisma = new PrismaClient();
const norm = (v) => (typeof v === "string" ? v.replace(/ /g, " ").trim() : v);

for (const [language, { before, after }] of Object.entries(PLAN)) {
  const row = await prisma.siteDocument.findUnique({
    where: { type_language: { type: "formStandardDocument", language } },
  });
  if (!row) {
    console.log(`${language}: no document — skipped.`);
    continue;
  }
  const data = row.data ?? {};
  const form = data.form ?? {};

  if (norm(form.agreementLink2Label) === after.agreementLink2Label) {
    console.log(`${language}: already applied — skipped.`);
    continue;
  }
  if (norm(form.agreementText) !== before.agreementText || norm(form.agreementLinkLabel) !== before.agreementLinkLabel) {
    console.log(`${language}: ABORT — unexpected current values:`);
    console.log(`   text=${JSON.stringify(form.agreementText)} label=${JSON.stringify(form.agreementLinkLabel)}`);
    continue;
  }

  await prisma.siteDocument.update({
    where: { id: row.id },
    data: { data: { ...data, form: { ...form, ...after } } },
  });
  console.log(`${language}: ${after.agreementText} [${after.agreementLinkLabel}] ${after.agreementText2} [${after.agreementLink2Label}]`);
  console.log(`      -> ${after.agreementLinkDestination}  |  ${after.agreementLink2Destination}`);
}

await prisma.$disconnect();
