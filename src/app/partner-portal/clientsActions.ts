"use server";
/** My clients: remember the chosen filter (cookie writes only happen in actions, never in render). */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CLIENTS_FILTER_COOKIE, DEFAULT_CLIENT_FILTER, cleanQuery, parseClientFilter } from "@/lib/partner/clientDto";
import { requirePartner } from "@/lib/partner/session";

export async function setClientsFilterAction(fd: FormData): Promise<void> {
  await requirePartner({ active: true });
  const filter = parseClientFilter(fd.get("filter")) ?? DEFAULT_CLIENT_FILTER;
  const q = cleanQuery(fd.get("q"));
  cookies().set(CLIENTS_FILTER_COOKIE, filter, {
    maxAge: 60 * 60 * 24 * 365, sameSite: "lax", path: "/", httpOnly: true, secure: process.env.NODE_ENV === "production",
  });
  const params = new URLSearchParams({ filter });
  if (q) params.set("q", q);
  redirect(`/clients?${params.toString()}`);
}
