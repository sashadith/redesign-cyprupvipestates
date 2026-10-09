import { Prisma } from "@prisma/client";
import { listBridgeDevelopers, type BridgeDeveloper } from "@/lib/bridge/config";
import BridgeSwitch from "./BridgeSwitch";

export const dynamic = "force-dynamic";

const CYPRUS_TZ = "Europe/Nicosia";
const stamp = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: CYPRUS_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);

// `bridgeEnabled` / `bridgeChangedAt` reach production only when the branch is
// deployed with CVP_RUN_MIGRATE=1 (plan constraint 4 — the 2026-09-17 outage).
// Until then every query here raises Prisma P2022 "column does not exist", which
// is exactly what happens on a local dev server too, because .env.local tunnels
// to the production database. A 500 at that point would mean nobody can open
// this screen before shipping it, so the missing column is rendered as a state.
// Narrowed to P2022 on purpose: any other Prisma failure is a real fault and
// must keep crashing loudly instead of being disguised as "awaiting deploy".
async function loadDevelopers(): Promise<{ rows: BridgeDeveloper[]; awaitingDeploy: boolean }> {
  try {
    return { rows: await listBridgeDevelopers(), awaitingDeploy: false };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022") {
      return { rows: [], awaitingDeploy: true };
    }
    throw e;
  }
}

export default async function XellexBridgePage() {
  const { rows, awaitingDeploy } = await loadDevelopers();

  // Enabled first, then alphabetical, so "what is currently on a second public
  // website" is the top of the table rather than something to hunt for.
  const developers = [...rows].sort(
    (a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name),
  );
  const enabledCount = developers.filter((d) => d.enabled).length;
  const deliveredProjects = developers.reduce((n, d) => n + (d.enabled ? d.publishedProjects : 0), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[#111827]">Xellex Bridge</h1>
        <p className="text-sm text-[#6B7280] mt-1">
          {awaitingDeploy ? (
            <>Per-developer delivery to the Xellex portal.</>
          ) : (
            <>
              <span className="font-medium text-[#111827]">{enabledCount}</span> of {developers.length} developer
              accounts delivered ·{" "}
              <span className="font-medium text-[#111827]">{deliveredProjects}</span> published projects currently
              reaching Xellex
            </>
          )}
        </p>
      </div>

      {/* The one thing an admin must understand before clicking anything here.
          A row of switches looks like a filter or a report setting; this one
          publishes and unpublishes a developer's whole catalogue on a different
          public domain. Stated on the screen so nobody has to find the spec. */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">This is not a filter — it publishes to a public website.</p>
        <p className="mt-1">
          Turning a developer <strong>on</strong> delivers every one of its published projects — names, all five
          language descriptions, prices, units and photos — to <strong>Xellex</strong>, a second public website with
          its own domain and audience. Turning it <strong>off</strong> removes those projects from Xellex at its next
          sync. Nothing on this screen changes what cyprusvipestates.com shows, and nothing here is a draft: a
          project is delivered the moment the developer is on.
        </p>
      </div>

      {awaitingDeploy ? (
        <div className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-8 text-center">
          <p className="text-sm font-medium text-[#111827]">Awaiting deploy</p>
          <p className="mt-1 text-sm text-[#6B7280]">
            The <code className="text-xs">bridgeEnabled</code> / <code className="text-xs">bridgeChangedAt</code>{" "}
            columns do not exist in this database yet, so there is nothing to switch. They are created by deploying
            this branch with <code className="text-xs">CVP_RUN_MIGRATE=1</code>; this screen starts working the moment
            that deploy lands, with every developer off.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#F8F9FA] text-[#6B7280]">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Developer</th>
                <th className="text-left font-medium px-4 py-2.5">Slug</th>
                <th className="text-left font-medium px-4 py-2.5">Published projects</th>
                <th className="text-left font-medium px-4 py-2.5">Delivered to Xellex</th>
                <th className="text-left font-medium px-4 py-2.5">Switch last changed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {developers.map((d) => {
                // A developer with nothing published cannot be switched on —
                // enabling it would deliver zero projects and only confuse the
                // next person reading this table. The row stays visible so
                // nobody wonders where that developer went (25 accounts, all 25
                // with published work as of 2026-10-09 — so this is currently a
                // guard against a state that does not exist, kept because a new
                // account starts with none).
                //
                // The guard is one-directional: if a developer is already ON and
                // its last published project later goes away, the switch must
                // still be clickable, or the only way to stop delivering it
                // would be a SQL update.
                const lockedOff = d.publishedProjects === 0 && !d.enabled;
                return (
                  <tr key={d.id} className="hover:bg-[#F8F9FA]">
                    <td className="px-4 py-2.5 font-medium text-[#111827]">{d.name}</td>
                    <td className="px-4 py-2.5 text-[#6B7280]">{d.slug}</td>
                    <td className="px-4 py-2.5 tabular-nums text-[#6B7280]">
                      {d.publishedProjects > 0 ? (
                        d.publishedProjects
                      ) : (
                        <span className="text-[#9CA3AF]">none</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <BridgeSwitch
                        slug={d.slug}
                        name={d.name}
                        enabled={d.enabled}
                        publishedProjects={d.publishedProjects}
                        lockedOff={lockedOff}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-[#6B7280]">
                      {d.changedAt ? (
                        stamp(d.changedAt)
                      ) : (
                        <span className="text-[#9CA3AF]">never touched</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {developers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#9CA3AF]">
                    No developer accounts.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
