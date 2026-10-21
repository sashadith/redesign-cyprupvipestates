import { decrypt, encrypt } from "@/lib/crypto/secretBox";
import type { BankDetails } from "./bank";

/** Server-only: bank details at rest. Throws on a missing key or a tampered payload. */
export function encryptBankDetails(d: BankDetails): string {
  return encrypt(JSON.stringify(d));
}

export function decryptBankDetails(s: string): BankDetails {
  const o = JSON.parse(decrypt(s)) as BankDetails;
  return {
    holder: o.holder, iban: o.iban, bic: o.bic ?? null,
    billingName: o.billingName, billingAddress: o.billingAddress, vatId: o.vatId ?? null,
  };
}
