/**
 * Server-only: a partner's stored bank details. Every read and write is scoped by the caller to the
 * session's own partner id. Plaintext never leaves this module except to that partner's own page/action.
 */
import { prisma } from "@/lib/prisma";
import { payoutBlockedUntil, type BankDetails } from "./bank";
import { decryptBankDetails, encryptBankDetails } from "./bankCrypto";
import { ibanLast4 } from "./bankFlow";

export type StoredBank =
  | { state: "none" }
  | { state: "unavailable" }
  | {
      state: "ok";
      details: BankDetails;
      ibanLast4: string | null;
      updatedAt: Date | null;
      blockedUntil: Date | null;
    };

/** Loads and decrypts. A failed decryption (wrong key, tampered blob) is logged without any payload. */
export async function loadBankDetails(partnerId: string): Promise<StoredBank> {
  const row = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { bankDetailsEnc: true, ibanLast4: true, bankDetailsUpdatedAt: true, ibanChangedAt: true },
  });
  if (!row?.bankDetailsEnc) return { state: "none" };
  try {
    const details = decryptBankDetails(row.bankDetailsEnc);
    return {
      state: "ok",
      details,
      ibanLast4: row.ibanLast4,
      updatedAt: row.bankDetailsUpdatedAt,
      blockedUntil: payoutBlockedUntil(row.ibanChangedAt),
    };
  } catch (e) {
    console.error("[partner] bank details could not be decrypted", { partnerId, error: e instanceof Error ? e.name : "unknown" });
    return { state: "unavailable" };
  }
}

/** One update: encrypted blob + last 4 + timestamps. ibanChangedAt moves only on a real IBAN change. */
export async function saveBankDetails(partnerId: string, next: BankDetails, changed: boolean, now: Date): Promise<void> {
  await prisma.partner.update({
    where: { id: partnerId },
    data: {
      bankDetailsEnc: encryptBankDetails(next),
      ibanLast4: ibanLast4(next.iban),
      bankDetailsUpdatedAt: now,
      ...(changed ? { ibanChangedAt: now } : {}),
    },
  });
}
