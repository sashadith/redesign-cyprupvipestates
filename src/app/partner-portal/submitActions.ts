"use server";
/**
 * Submit-client action (partner portal phase 3b). Active partners only; throttled per partner
 * and per IP; strict validation; the answer never reveals whether the contact was already known.
 */
import { headers } from "next/headers";
import { partnerClientIp } from "@/lib/partner/clientIp";
import { ipKey, partnerLimits as L } from "@/lib/partner/limits";
import { requirePartner } from "@/lib/partner/session";
import { validateSubmission } from "@/lib/partner/submission";
import { submitClient } from "@/lib/partner/submitClient";
import { clientDisplayName, rawFromForm } from "@/lib/partner/submitFlow";
import type { SubmitState } from "./formState";

export async function submitClientAction(_prev: SubmitState, fd: FormData): Promise<SubmitState> {
  // Redirects (not logged in / not active) must stay outside any try/catch.
  const me = await requirePartner({ active: true });
  if (!L.submitPartner.hit(me.partner.id) || !L.submitIp.hit(ipKey(partnerClientIp(headers())))) return { error: "err.rateLimited" };

  const parsed = rawFromForm(fd);
  if (!parsed.ok) return { error: parsed.code, field: parsed.field };
  const v = validateSubmission(parsed.raw);
  if (!v.ok) return { error: v.code, field: v.field };
  const name = clientDisplayName(v.data);

  try {
    const out = await submitClient(me, v.data);
    if (out.kind === "PROJECT_UNAVAILABLE") return { error: "err.projectUnavailable", field: "projectIds" };
    if (out.kind === "ALREADY_YOURS") return { ok: true, name, alreadyYours: true };
    return { ok: true, name };
  } catch (e) {
    console.error("[partner] client submission failed", e);
    return { error: "err.generic" };
  }
}
