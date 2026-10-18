import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canAssignLeads } from "./access";
import { writeAudit } from "./audit";
import { parseStageDate, payoutActions, stageOrderError } from "./commissionActions";
import type { CommissionStatusValue } from "./commission";
import type { SessionCrmUser } from "./session";
import {
  bankDetailsComplete, creditNoteFinal, creditNoteYear, isTransactionBusyError, issuerFromEnv, nextCreditNoteSeq, payoutDecision, payoutKind,
  PAYOUT_BUSY_ERROR, PAYOUT_PAUSED_CODE,
} from "./payoutRules";
import { payoutBlockedUntil, type BankDetails } from "@/lib/partner/bank";
import { decryptBankDetails } from "@/lib/partner/bankCrypto";
import { effectiveStateOf } from "@/lib/partner/claimFacts";
import { activeSince } from "@/lib/partner/claimState";
import { submissionView } from "@/lib/partner/clientDto";
import { clientInitials, creditNoteModel, creditNoteNumber, vatFor, type VatMode } from "@/lib/partner/creditNote";
import { renderCreditNotePdf } from "@/lib/partner/creditNotePdf";

// "Paid out" (partner portal phase 3c, Decisions 2, 3, 10). One interactive
// transaction: the deal row lock, the gap-free counter, the PDF render, the
// immutable CreditNote row, the stage change, audit and the PAYOUT outbox row
// all commit together — or nothing does (a failed render consumes no number).
//
// A deal with a positive partnerCommission is a partner deal: it needs the
// effectively ACTIVE claim of lead.partnerId and a deal created at/after the
// claim's activeSince, or the payout is blocked (payoutKind). The credit note's
// issuer block comes from env: CVE_LEGAL_NAME, CVE_LEGAL_ADDRESS (literal "\n"
// allowed), CVE_LEGAL_VAT_ID and CVE_LEGAL_REG_NO (CVE_VAT_ID / CVE_REG_NO are
// accepted as fallbacks); CREDIT_NOTE_FINAL=1 drops the draft footer. Year and
// document date are Cyprus time (Asia/Nicosia).

export type PayoutResult =
  | { ok: true; leadId: string; creditNote: { id: string; number: string } | null }
  | { error: string; code?: typeof PAYOUT_PAUSED_CODE };

class Abort extends Error {
  constructor(message: string, readonly code?: typeof PAYOUT_PAUSED_CODE) { super(message); }
}

const RENDER_FAILED = "The credit note PDF could not be generated — nothing was saved. Try again.";

export async function markPaidOut(
  actor: SessionCrmUser,
  dealId: string,
  opts: { onDate: string; override?: boolean },
): Promise<PayoutResult> {
  const date = parseStageDate(String(opts.onDate ?? ""));
  if (!date.ok) return { error: date.error };
  const override = opts.override === true;
  try {
    return await prisma.$transaction(async (tx): Promise<PayoutResult> => {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM deals WHERE id = ${dealId} FOR UPDATE`;
      if (locked.length === 0) throw new Abort("Deal not found — reload.");
      const deal = await tx.deal.findUniqueOrThrow({
        where: { id: dealId },
        select: {
          leadId: true, createdAt: true, commissionStatus: true, earnedAt: true, developerPaidAt: true, partnerCommission: true, unitLabel: true,
          development: { select: { publicName: true, override: { select: { alias: true } } } },
          lead: { select: { partnerId: true } },
        },
      });
      const from = deal.commissionStatus as CommissionStatusValue;
      if (!payoutActions(from).includes("PAID_OUT")) throw new Abort(`This deal is now ${from.toLowerCase().replace("_", " ")} — reload.`);
      const orderError = stageOrderError("PAID_OUT", opts.onDate, deal);
      if (orderError) throw new Abort(orderError);

      const now = new Date();
      const partnerId = deal.lead.partnerId;
      const claim = partnerId && (deal.partnerCommission ?? 0) > 0
        ? await tx.partnerClaim.findFirst({
            where: { leadId: deal.leadId, partnerId, state: "ACTIVE" },
            select: { id: true, state: true, createdAt: true, reviewedAt: true, leadId: true, submission: true },
          })
        : null;
      const claimEffectivelyActive = !!claim && (await effectiveStateOf(tx, claim, now)) === "ACTIVE";
      const kind = payoutKind({
        partnerCommission: deal.partnerCommission,
        partnerId,
        claimEffectivelyActive,
        claimActiveSince: claim ? activeSince(claim) : null,
        dealCreatedAt: deal.createdAt,
      });
      if (kind.kind === "blocked") throw new Abort(kind.error);
      if (kind.kind === "plain" || !partnerId || !claim) {
        // No partner commission on the deal: the plain stage change, no credit note.
        await tx.deal.update({ where: { id: dealId }, data: { commissionStatus: "PAID_OUT", paidOutAt: date.value } });
        await writeAudit(actor, "crm_deal_stage", "Deal", dealId, { leadId: deal.leadId, from, to: "PAID_OUT", date: opts.onDate }, tx);
        return { ok: true, leadId: deal.leadId, creditNote: null };
      }

      // Serialise with a concurrent bank-details change: the IBAN on the document is the one in force now.
      await tx.$queryRaw`SELECT id FROM partners WHERE id = ${partnerId} FOR SHARE`;
      const partner = await tx.partner.findUniqueOrThrow({
        where: { id: partnerId },
        select: { bankDetailsEnc: true, ibanLast4: true, ibanChangedAt: true, vatMode: true },
      });
      let bank: BankDetails | null = null;
      if (partner.bankDetailsEnc) {
        try {
          bank = decryptBankDetails(partner.bankDetailsEnc);
        } catch {
          throw new Abort("Partner bank details could not be read — check the encryption key configuration.");
        }
      }
      const issuer = issuerFromEnv(process.env);
      const blockedUntil = payoutBlockedUntil(partner.ibanChangedAt);
      const decision = payoutDecision({
        hasPartnerShare: true,
        bankComplete: bankDetailsComplete(bank) && !!partner.ibanLast4,
        issuerComplete: issuer.ok,
        blockedUntil,
        now,
        override,
        canOverride: canAssignLeads(actor),
      });
      if (!decision.ok) throw new Abort(decision.error, decision.code);
      if (!bank || !issuer.ok) throw new Abort(RENDER_FAILED); // narrowed above; keeps the types honest

      const year = creditNoteYear(now);
      await tx.$executeRaw`INSERT INTO credit_note_counters ("year", "lastSeq") VALUES (${year}, 0) ON CONFLICT ("year") DO NOTHING`;
      const counter = await tx.$queryRaw<{ lastSeq: number }[]>`SELECT "lastSeq" FROM credit_note_counters WHERE "year" = ${year} FOR UPDATE`;
      if (counter.length !== 1) throw new Error("Credit note counter row missing after upsert.");
      const seq = nextCreditNoteSeq(Number(counter[0].lastSeq));
      const number = creditNoteNumber(year, seq);

      const net = deal.partnerCommission as number;
      const vatMode = partner.vatMode as VatMode;
      const sub = submissionView(claim.submission);
      const model = creditNoteModel({
        issuer: issuer.issuer,
        partner: { billingName: bank.billingName, billingAddress: bank.billingAddress, vatId: bank.vatId },
        number,
        issuedAt: now,
        deal: {
          // Same project name as the portal, the CSV and the PAYOUT mail: override alias, else the public name.
          projectName: (deal.development ? deal.development.override?.alias?.trim() || deal.development.publicName : null) ?? "Property",
          unitLabel: deal.unitLabel ?? "",
        },
        clientInitials: clientInitials(sub.firstName, sub.lastName ?? ""),
        net,
        vatMode,
        ibanLast4: partner.ibanLast4 as string,
        final: creditNoteFinal(process.env),
      });
      let pdf: Buffer;
      try {
        pdf = await renderCreditNotePdf(model);
      } catch (e) {
        console.error("[payout] credit note render failed", e instanceof Error ? e.message : e);
        throw new Abort(RENDER_FAILED);
      }
      const v = vatFor(vatMode, net);
      const note = await tx.creditNote.create({
        data: {
          number, year, seq, partnerId, dealId, netAmount: net, vatMode,
          vatRate: v.rate != null ? v.rate.toFixed(2) : null, vatAmount: v.vat, totalAmount: v.total,
          issuedAt: now, issuedById: actor.id, pdf, pdfSha256: createHash("sha256").update(pdf).digest("hex"),
        },
        select: { id: true },
      });
      await tx.$executeRaw`UPDATE credit_note_counters SET "lastSeq" = ${seq} WHERE "year" = ${year}`;
      await tx.deal.update({ where: { id: dealId }, data: { commissionStatus: "PAID_OUT", paidOutAt: date.value } });
      await writeAudit(actor, "crm_deal_stage", "Deal", dealId, {
        leadId: deal.leadId, from, to: "PAID_OUT", date: opts.onDate, creditNoteId: note.id, creditNoteNumber: number,
      }, tx);
      if (decision.overridden) {
        await writeAudit(actor, "partner.payout_override", "partner", partnerId, {
          dealId, creditNoteId: note.id, blockedUntil: blockedUntil?.toISOString() ?? null,
        }, tx);
      }
      await tx.partnerNotification.create({
        data: { kind: "PAYOUT", refKey: `paid:${dealId}`, partnerId, leadId: deal.leadId, claimId: claim.id, payload: { creditNoteId: note.id } },
      });
      return { ok: true, leadId: deal.leadId, creditNote: { id: note.id, number } };
    }, { timeout: 60_000, maxWait: 10_000 });
  } catch (e) {
    if (e instanceof Abort) return e.code ? { error: e.message, code: e.code } : { error: e.message };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "A credit note for this deal was just issued by someone else — reload." };
    }
    if (isTransactionBusyError(e)) return { error: PAYOUT_BUSY_ERROR };
    throw e;
  }
}
