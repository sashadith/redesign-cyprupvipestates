import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adminDateTime } from "@/lib/adminTime";
import { disconnectMcpFamily } from "./actions";

export const dynamic = "force-dynamic";

export default async function ConnectedAppsPage() {
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
  // One row per family: the newest live token represents the connection.
  const families = Array.from(new Map(tokens.map((t) => [t.familyId, t])).values());

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Connected apps</h1>
        <p className="text-sm text-[#6B7280] mt-1">MCP connectors (e.g. the claude.ai “CVE LEADS” chat) that can read the CRM on your behalf. <Link href="/admin/account" className="underline">Back to account</Link></p>
      </div>

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
      </section>
    </div>
  );
}
