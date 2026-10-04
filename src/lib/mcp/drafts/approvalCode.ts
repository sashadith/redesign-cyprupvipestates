// The code the operator types in the chat to release a draft. Delivered only
// inside the preview email (src/lib/mcp/drafts/previewEmail.ts); the model
// never sees it. No 0/O/1/I so it survives being read off a phone screen.
import { randomInt } from "node:crypto";
import { safeEqual } from "../auth/crypto";

export const APPROVAL_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const APPROVAL_CODE_LENGTH = 6;

export function generateApprovalCode(): string {
  let out = "";
  for (let i = 0; i < APPROVAL_CODE_LENGTH; i++) out += APPROVAL_CODE_ALPHABET[randomInt(APPROVAL_CODE_ALPHABET.length)];
  return out;
}

export function normalizeApprovalCode(s: string): string {
  return s.toUpperCase().replace(/[\s-]/g, "");
}

export function approvalCodesMatch(given: string, stored: string): boolean {
  const g = normalizeApprovalCode(given);
  if (g.length !== APPROVAL_CODE_LENGTH) return false;
  return safeEqual(g, stored);
}
