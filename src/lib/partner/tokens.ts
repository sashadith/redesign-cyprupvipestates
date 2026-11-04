import { createHash, randomBytes } from "node:crypto";

/** The raw token goes into the e-mail link; only its SHA-256 hex is stored. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 3_600_000);
}
