import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adminDateTime } from "@/lib/adminTime";
import { disconnectMcpFamily, openPairingWindow } from "./actions";
import { verifyPairingToken, pairingSecret, PAIRING_COOKIE } from "@/lib/mcp/auth/pairing";

export const dynamic = "force-dynamic";

export default async function ConnectedAppsPage({ searchParams }: { searchParams: { pairing?: string } }) {
  const session = await auth();
  const uid = (session?.user as any)?.id as string | undefined;
  if (!session || !uid) redirect("/admin/login");

  const [tokens, calls] = await Promise.all([
    prisma.mcpToken.findMany({
      where: { userId: uid, revokedAt: null, refreshExpiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { familyId: true, issuedHost: true, createdAt: true, lastUsedAt: true, refreshExpiresAt: true, client: { select: { clientName: true } } },
    }),
    prisma.mcpToolCall.findMany({ where: { userId: uid }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, tool: true, leadId: true, ok: true, errorCode: true, durationMs: true, createdAt: true } }),
  ]);
  // One row per family: the newest live token represents the connection
  // (tokens are ordered newest first, so the first occurrence wins).
  const byFamily = new Map<string, (typeof tokens)[number]>();
  for (const t of tokens) if (!byFamily.has(t.familyId)) byFamily.set(t.familyId, t);
  const families = Array.from(byFamily.values());

  let windowOpen = false;
  try { windowOpen = verifyPairingToken(cookies().get(PAIRING_COOKIE)?.value, uid, pairingSecret()); } catch { windowOpen = false; }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Connected apps</h1>
        <p className="text-sm text-[#6B7280] mt-1">MCP connectors (e.g. the claude.ai &quot;CVE LEADS&quot; chat) that can read the CRM, change lead data and send email as you. <Link href="/admin/account" className="underline">Back to account</Link></p>
      </div>

      <section className="rounded-lg border border-[#E5E7EB] bg-white p-4">
        <h2 className="text-lg font-medium mb-1">Connect a new app</h2>
        <p className="text-sm text-[#6B7280] mb-3">
          Connections can only be approved while a pairing window is open in this browser. Open one, then start the connection in claude.ai (Settings → Connectors → Connect) within 10 minutes.
        </p>
        {searchParams?.pairing === "missing" && (
          <p className="text-sm rounded px-3 py-2 mb-3 bg-[#C0392B]/10 text-[#C0392B]">The approval was refused because no pairing window was open. Open one below and click Connect in claude.ai again.</p>
        )}
        <form action={openPairingWindow}>
          <button type="submit" className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-4 py-2 hover:bg-[#142E2D]">
            {windowOpen ? "Extend the pairing window (10 min)" : "Open a pairing window (10 min)"}
          </button>
        </form>
        {windowOpen && <p className="text-xs text-[#6B7280] mt-2">A pairing window is open in this browser.</p>}
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Connections</h2>
        {families.length === 0 ? (
          <p className="text-sm text-[#6B7280]">No connector is connected. Add this app as a custom connector in claude.ai to start.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-[#6B7280]"><tr><th className="py-1">Client</th><th>Host</th><th>Connected</th><th>Last used</th><th>Expires</th><th /></tr></thead>
            <tbody>
              {families.map((t) => (
                <tr key={t.familyId} className="border-t border-[#E5E7EB]">
                  <td className="py-2">{t.client.clientName ?? "MCP client"}</td>
                  <td>{t.issuedHost}</td>
                  <td>{adminDateTime(t.createdAt)}</td>
                  <td>{t.lastUsedAt ? adminDateTime(t.lastUsedAt) : "never"}</td>
                  <td>{adminDateTime(t.refreshExpiresAt)}</td>
                  <td className="text-right">
                    <form action={disconnectMcpFamily}>
                      <input type="hidden" name="familyId" value={t.familyId} />
                      <button type="submit" className="text-[#C0392B] hover:underline">Disconnect</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Recent activity</h2>
        <p className="text-xs text-[#6B7280] mb-2">Last 100 tool calls. Arguments and message text are never stored.</p>
        {calls.length === 0 ? (
          <p className="text-sm text-[#6B7280]">No tool calls yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-[#6B7280]"><tr><th className="py-1">When</th><th>Tool</th><th>Lead</th><th>Result</th><th>ms</th></tr></thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id} className="border-t border-[#E5E7EB]">
                  <td className="py-1">{adminDateTime(c.createdAt)}</td>
                  <td><code>{c.tool}</code></td>
                  <td>{c.leadId ? <Link href={`/admin/crm/${c.leadId}`} className="underline">{c.leadId.slice(0, 8)}…</Link> : "—"}</td>
                  <td>{c.ok ? "ok" : `error: ${c.errorCode}`}</td>
                  <td>{c.durationMs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
