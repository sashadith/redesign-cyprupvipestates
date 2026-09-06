/* Rewrite the submit feedback copy on the shared form document.

   Before, every locale's success message ended in a winking smiley and asked
   the visitor to "wait a bit" — after a luxury-property enquiry, that reads as
   flippant and says nothing useful. The error message was one long run-on
   sentence telling people to try again, and if that failed, to write "in
   messenger" or call — without giving either address.

   After: the confirmation states what happened and what to expect. The error
   says what went wrong, what to do, and names the two ways to reach the
   company, so it is actionable without further hunting.

   Both are deliberately short: they render inside a toast.

   Idempotent: each locale is skipped if the new text is already stored, and
   aborted if the current value is neither the known old one nor the new one. */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const PLAN = {
  en: {
    oldSuccess: "We have received your message and will contact you soon. Wait a bit :)",
    success: "Thank you — your enquiry has reached us. An adviser will be in touch, usually the same day.",
    error:
      "Your enquiry could not be sent. Please try again, or reach us at office@cyprusvipestates.com or +357 99 278 285.",
  },
  de: {
    oldSuccess: "Wir haben Ihre Nachricht erhalten und werden uns in Kürze bei Ihnen melden. Warten Sie noch ein wenig :)",
    success: "Vielen Dank — Ihre Anfrage ist bei uns eingegangen. Ein Berater meldet sich, meist noch am selben Tag.",
    error:
      "Ihre Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es erneut oder erreichen Sie uns unter office@cyprusvipestates.com oder +357 99 278 285.",
  },
  pl: {
    oldSuccess: "Otrzymaliśmy Twoją wiadomość i wkrótce się z Tobą skontaktujemy. Poczekaj chwilę :)",
    success: "Dziękujemy — Twoje zapytanie do nas dotarło. Doradca odezwie się, zwykle jeszcze tego samego dnia.",
    error:
      "Nie udało się wysłać zapytania. Spróbuj ponownie lub skontaktuj się z nami: office@cyprusvipestates.com albo +357 99 278 285.",
  },
  ru: {
    oldSuccess: "Мы получили ваше сообщение и скоро свяжемся с вами. Подождите немного :)",
    success: "Спасибо — ваша заявка получена. Консультант свяжется с вами, обычно в тот же день.",
    error:
      "Не удалось отправить заявку. Попробуйте ещё раз или напишите на office@cyprusvipestates.com либо позвоните: +357 99 278 285.",
  },
};

const prisma = new PrismaClient();
const norm = (v) => (typeof v === "string" ? v.replace(/ /g, " ").trim() : v);

for (const [language, plan] of Object.entries(PLAN)) {
  const row = await prisma.siteDocument.findUnique({
    where: { type_language: { type: "formStandardDocument", language } },
  });
  if (!row) {
    console.log(`${language}: no document — skipped.`);
    continue;
  }
  const data = row.data ?? {};
  const form = data.form ?? {};

  if (norm(form.successMessage) === plan.success) {
    console.log(`${language}: already applied — skipped.`);
    continue;
  }
  if (norm(form.successMessage) !== plan.oldSuccess) {
    console.log(`${language}: ABORT — successMessage is not the known previous value:`);
    console.log(`   ${JSON.stringify(form.successMessage)}`);
    continue;
  }

  await prisma.siteDocument.update({
    where: { id: row.id },
    data: { data: { ...data, form: { ...form, successMessage: plan.success, errorMessage: plan.error } } },
  });
  console.log(`${language}:`);
  console.log(`   success: ${plan.success}`);
  console.log(`   error:   ${plan.error}`);
}

await prisma.$disconnect();
