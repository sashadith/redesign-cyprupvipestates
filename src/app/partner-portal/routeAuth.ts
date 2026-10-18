import { getPartner, type PartnerSessionInfo } from "@/lib/partner/session";

const noStore = { "Cache-Control": "private, no-store" } as const;

/**
 * requirePartner() for route handlers: the session without a thrown redirect. No session → 303 to
 * /login, not yet ACTIVE (with `active`) → 303 to /home (partner-host paths, relative Location — the
 * middleware adds the /partner-portal prefix on the follow-up request).
 */
export async function partnerForRoute(opts: { active?: boolean } = {}): Promise<PartnerSessionInfo | Response> {
  const me = await getPartner();
  if (!me) return new Response(null, { status: 303, headers: { Location: "/login", ...noStore } });
  if (opts.active && me.partner.status !== "ACTIVE") return new Response(null, { status: 303, headers: { Location: "/home", ...noStore } });
  return me;
}

export const notFoundResponse = () => new Response("Not found", { status: 404, headers: { ...noStore, "X-Content-Type-Options": "nosniff" } });
