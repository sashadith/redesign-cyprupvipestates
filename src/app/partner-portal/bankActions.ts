"use server";
/**
 * Bank & billing details (phase 3c, decision 8). Active partners only, password re-entry, throttled.
 * Scoped to the session's partner; the IBAN is never logged, returned or echoed back into the form.
 */
import { revalidatePath } from "next/cache";
import { asLocale, inBackground } from "@/lib/partner/accounts";
import { writePartnerAudit } from "@/lib/partner/audit";
import { payoutBlockedUntil, validateBankDetails } from "@/lib/partner/bank";
import { buildBankChangedNotice, ibanChanged, ibanLast4, mergeBankInput, partnerDisplayName } from "@/lib/partner/bankFlow";
import { loadBankDetails, saveBankDetails } from "@/lib/partner/bankStore";
import { partnerLimits as L } from "@/lib/partner/limits";
import { buildBankChangedEmail } from "@/lib/partner/mail";
import { verifyPassword } from "@/lib/partner/password";
import { requirePartner } from "@/lib/partner/session";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/sendEmail";
import { sendTelegramMessage } from "@/lib/telegram";
import type { FormState } from "./formState";

const field = (fd: FormData, k: string): string => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};

export async function saveBankDetailsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requirePartner({ active: true });
  if (!L.bankPartner.hit(me.partner.id)) return { error: "err.rateLimited" };

  const current = field(fd, "currentPassword");
  const pw = await prisma.partnerUser.findUnique({ where: { id: me.user.id }, select: { passwordHash: true } });
  if (!pw || !current || !(await verifyPassword(current.slice(0, 200), pw.passwordHash))) {
    return { error: "err.currentPassword", field: "currentPassword" };
  }

  const stored = await loadBankDetails(me.partner.id);
  if (stored.state === "unavailable") return { error: "bank.unavailable" };
  const prev = stored.state === "ok" ? stored.details : null;

  const v = validateBankDetails(
    mergeBankInput(prev, {
      holder: field(fd, "holder"),
      iban: field(fd, "iban"),
      bic: field(fd, "bic"),
      billingName: field(fd, "billingName"),
      billingAddress: field(fd, "billingAddress"),
      vatId: field(fd, "vatId"),
    }),
  );
  if (!v.ok) return { error: v.code, field: v.field };

  const next = v.data;
  const changed = ibanChanged(prev, next);
  const now = new Date();
  await saveBankDetails(me.partner.id, next, changed, now);

  const last4 = ibanLast4(next.iban);
  // Built inside the background job: partnerBaseUrl() may throw on a misconfigured host, and the save already happened.
  inBackground(
    "bank changed mail",
    (async () => {
      const mail = buildBankChangedEmail(asLocale(me.partner.language), { name: me.partner.firstName, ibanLast4: last4, changedAt: now });
      await sendEmail({ to: me.user.email, subject: mail.subject, text: mail.text, html: mail.html });
    })(),
  );
  inBackground(
    "bank changed notice",
    sendTelegramMessage(
      buildBankChangedNotice({
        name: partnerDisplayName(me.partner),
        ibanLast4: last4,
        blockedUntil: changed ? payoutBlockedUntil(now) : null,
      }),
    ),
  );
  try {
    await writePartnerAudit(me.partner, me.user, "partner.bank_details_changed", { ibanChanged: changed });
  } catch (e) {
    // The save already happened; a failed audit row must not turn it into an error for the partner.
    console.error("[partner] bank audit failed", { partnerId: me.partner.id, error: e instanceof Error ? e.name : "unknown" });
  }

  revalidatePath("/partner-portal", "layout");
  return { ok: true };
}
