import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

/** URL-safe, crypto-random, 12 chars minimum. base64url of 9 raw bytes = 12 chars, no padding. */
function randomToken(): string {
  return crypto.randomBytes(9).toString("base64url");
}

/** Collision-checked against the (small) client_presentations table — matches
 *  the uniqueDevelopmentSlug() precedent in src/lib/developmentSeo.ts. */
export async function uniquePresentationToken(): Promise<string> {
  for (;;) {
    const candidate = randomToken();
    const hit = await prisma.clientPresentation.findUnique({ where: { token: candidate }, select: { id: true } });
    if (!hit) return candidate;
  }
}
