// Office Telegram notice when a partner's own profile edit changes the automatic VAT treatment (plan 3d).
// Pure; HTML parse mode → every value escaped. English (office-facing).
import type { DerivedVatMode } from "./vat";
import { escapeHtml } from "./mail";

export const VAT_MODE_LABEL: Record<DerivedVatMode, string> = { NONE: "No VAT", CY_VAT: "CY VAT 19%", REVERSE_CHARGE: "Reverse charge" };

export function buildVatModeChangedNotice(i: { name: string; vatId: string | null; before: DerivedVatMode; after: DerivedVatMode }): string {
  const what = i.vatId ? `set VAT number ${escapeHtml(i.vatId)}` : "removed the VAT number";
  return `Partner ${escapeHtml(i.name)} ${what} — VAT treatment ${VAT_MODE_LABEL[i.before]} → ${VAT_MODE_LABEL[i.after]}. Check before the next payout.`;
}
