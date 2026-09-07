"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClient } from "@/lib/mcp/auth/clients";
import { validateAuthorizeRequest } from "@/lib/mcp/auth/authorizeValidate";
import { issueAuthCode } from "@/lib/mcp/auth/authorize";

// Self-contained session gate (same reasoning as the other admin action
// files: never export requireSession from a "use server" module).
async function requireUserId(): Promise<string> {
  const session = await auth();
  const uid = (session?.user as any)?.id as string | undefined;
  if (!session || !uid) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { isActive: true } });
  if (!user || !user.isActive) throw new Error("Unauthorized");
  return uid;
}

function paramsFromForm(formData: FormData): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const k of ["client_id", "redirect_uri", "response_type", "code_challenge", "code_challenge_method", "state"]) {
    const v = formData.get(k);
    out[k] = typeof v === "string" ? v : undefined;
  }
  return out;
}

function redirectWith(redirectUri: string, params: Record<string, string>): never {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  redirect(url.toString());
}

// Both actions re-validate from the posted fields — the page's render-time
// validation is not trusted across the round trip.
export async function approveAuthorization(formData: FormData) {
  const userId = await requireUserId();
  const p = paramsFromForm(formData);
  const client = await getClient(p.client_id ?? "");
  const v = validateAuthorizeRequest(p, client);
  if (!v.ok) {
    if (v.redirectable) redirectWith(p.redirect_uri!, { error: v.error, error_description: v.description, state: p.state ?? "" });
    throw new Error(v.description);
  }
  const code = await issueAuthCode({ clientId: v.clientId, userId, redirectUri: v.redirectUri, codeChallenge: v.codeChallenge });
  redirectWith(v.redirectUri, { code, state: v.state });
}

export async function denyAuthorization(formData: FormData) {
  await requireUserId();
  const p = paramsFromForm(formData);
  const client = await getClient(p.client_id ?? "");
  const v = validateAuthorizeRequest(p, client);
  if (!v.ok && !v.redirectable) throw new Error(v.description);
  redirectWith(p.redirect_uri!, { error: "access_denied", error_description: "The user denied the request.", state: p.state ?? "" });
}
