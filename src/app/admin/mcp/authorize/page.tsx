import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClient } from "@/lib/mcp/auth/clients";
import { validateAuthorizeRequest } from "@/lib/mcp/auth/authorizeValidate";
import { getMcpPublicOrigin } from "@/lib/mcp/publicOrigin";
import { relative } from "@/lib/mcp/format";
import { approveAuthorization, denyAuthorization } from "./actions";
import { READ_TOOL_NAMES, WRITE_TOOL_NAMES } from "@/lib/mcp/toolNames";
import { verifyPairingToken, pairingSecret, PAIRING_COOKIE } from "@/lib/mcp/auth/pairing";

export const dynamic = "force-dynamic";

// OAuth consent screen for the claude.ai connector. Lives under /admin (so
// the intl middleware ignores it) but OUTSIDE the (panel) group: the panel
// layout redirects to /admin/login without a callbackUrl, which would drop
// the OAuth query string. This page does its own session check and sends the
// user through login with a callbackUrl back to itself.

export default async function McpAuthorizePage({ searchParams: raw }: { searchParams: Record<string, string | string[] | undefined> }) {
  // Next hands repeated query keys as arrays; OAuth params are single-valued.
  const searchParams: Record<string, string | undefined> = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const session = await auth();
  const uid = (session?.user as any)?.id as string | undefined;
  if (!session || !uid) {
    const qs = new URLSearchParams(Object.entries(searchParams).filter((e): e is [string, string] => typeof e[1] === "string")).toString();
    redirect(`/admin/login?callbackUrl=${encodeURIComponent(`/admin/mcp/authorize?${qs}`)}`);
  }
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { isActive: true, name: true, email: true } });
  if (!user || !user.isActive) redirect("/admin/login");

  const client = await getClient(searchParams.client_id ?? "");
  const v = validateAuthorizeRequest(searchParams, client);

  if (!v.ok && !v.redirectable) {
    return (
      <Shell>
        <h1 className="text-lg font-semibold mb-2">Connection request rejected</h1>
        <p className="text-sm text-[#6B7280]">{v.description}</p>
      </Shell>
    );
  }
  if (!v.ok) {
    // Redirectable error — hand it back to the client immediately.
    const url = new URL(searchParams.redirect_uri!);
    url.searchParams.set("error", v.error);
    url.searchParams.set("error_description", v.description);
    if (searchParams.state) url.searchParams.set("state", searchParams.state);
    redirect(url.toString());
  }

  const hidden = ["client_id", "redirect_uri", "response_type", "code_challenge", "code_challenge_method", "state"] as const;
  const origin = safeOrigin();

  let windowOpen = false;
  try { windowOpen = verifyPairingToken(cookies().get(PAIRING_COOKIE)?.value, uid, pairingSecret()); } catch { windowOpen = false; }

  return (
    <Shell>
      <h1 className="text-lg font-semibold mb-1">Connect {client?.clientName || "an MCP client"} to the CRM?</h1>
      <p className="text-sm text-[#6B7280] mb-4">
        Signed in as {user.name} ({user.email}). Host: {origin ?? "unknown"}. After approval, the browser is sent to {new URL(v.redirectUri).host}. The connection can be disconnected at any time under Account → Connected apps.
      </p>
      <p className="text-sm rounded px-3 py-2 mb-4 bg-[#C0392B]/10 text-[#C0392B]">
        Only approve this if you clicked Connect in claude.ai yourself, just now. Client id: {client?.clientId} · registered {client ? relative(client.createdAt) : "unknown"}.
      </p>
      <p className="text-sm font-medium mb-1">It will be able to read:</p>
      <ul className="text-sm mb-3 list-disc pl-5 space-y-0.5">{READ_TOOL_NAMES.map((t) => <li key={t}><code>{t}</code></li>)}</ul>
      <p className="text-sm font-medium mb-1">…and change or send, always as you:</p>
      <ul className="text-sm mb-6 list-disc pl-5 space-y-0.5">{WRITE_TOOL_NAMES.map((t) => <li key={t}><code>{t}</code></li>)}</ul>
      {!windowOpen && (
        <p className="text-sm rounded px-3 py-2 mb-4 bg-[#C0392B]/10 text-[#C0392B]">
          This connection request cannot be approved: connections must be started from Account → Connected apps in this browser.
        </p>
      )}
      <div className="flex gap-3">
        {windowOpen && (
          <form action={approveAuthorization}>
            {hidden.map((k) => <input key={k} type="hidden" name={k} value={searchParams[k] ?? ""} />)}
            <button type="submit" className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-4 py-2 hover:bg-[#142E2D]">Allow</button>
          </form>
        )}
        <form action={denyAuthorization}>
          {hidden.map((k) => <input key={k} type="hidden" name={k} value={searchParams[k] ?? ""} />)}
          <button type="submit" className="rounded-md border border-[#E5E7EB] text-sm font-medium px-4 py-2 hover:bg-[#F8F9FA]">Deny</button>
        </form>
      </div>
    </Shell>
  );
}

function safeOrigin(): string | null {
  try { return getMcpPublicOrigin(); } catch { return null; }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] font-sans">
      <div className="w-full max-w-md bg-white rounded-lg border border-[#E5E7EB] p-8 shadow-sm">{children}</div>
    </div>
  );
}
