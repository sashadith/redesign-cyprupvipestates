import bcrypt from "bcryptjs";

export const PASSWORD_MIN = 10;
/** bcrypt only uses the first 72 bytes, so longer passwords are refused instead of silently truncated. */
export const PASSWORD_MAX_BYTES = 72;

export type PasswordProblem = "too_short" | "digits_only" | "too_long";

export function passwordProblem(pw: string): PasswordProblem | null {
  if (pw.length < PASSWORD_MIN || pw.trim().length < PASSWORD_MIN) return "too_short";
  if (Buffer.byteLength(pw, "utf8") > PASSWORD_MAX_BYTES) return "too_long";
  if (/^\d+$/.test(pw)) return "digits_only";
  return null;
}

export function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 12);
}

export function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}
