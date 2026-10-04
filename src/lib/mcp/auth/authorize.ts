import { prisma } from "@/lib/prisma";
import { randomToken, sha256Hex } from "./crypto";

export const AUTH_CODE_TTL_MS = 60_000;

// Returns the plaintext code exactly once (it goes into the redirect URL);
// only its hash is stored.
export async function issueAuthCode(input: { clientId: string; userId: string; redirectUri: string; codeChallenge: string }): Promise<string> {
  const code = randomToken(32);
  await prisma.mcpAuthCode.create({
    data: {
      codeHash: sha256Hex(code),
      clientId: input.clientId,
      userId: input.userId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
    },
  });
  return code;
}
