import bcrypt from "bcryptjs";

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;

export type PasswordProblem = "too_short" | "digits_only" | "too_long";

export function passwordProblem(pw: string): PasswordProblem | null {
  if (pw.length < PASSWORD_MIN) return "too_short";
  if (pw.length > PASSWORD_MAX) return "too_long";
  if (/^\d+$/.test(pw)) return "digits_only";
  return null;
}

export function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 12);
}

export function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}
