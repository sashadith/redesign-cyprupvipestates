import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

/** URL-safe, crypto-random, 12 chars minimum — same shape as presentationToken.ts's randomToken(). */
function randomToken(): string {
  return crypto.randomBytes(9).toString("base64url");
}

/** Collision-checked against the (small) booking_requests table — same pattern as uniquePresentationToken(). */
export async function uniqueBookingToken(): Promise<string> {
  for (;;) {
    const candidate = randomToken();
    const hit = await prisma.bookingRequest.findUnique({ where: { token: candidate }, select: { id: true } });
    if (!hit) return candidate;
  }
}
