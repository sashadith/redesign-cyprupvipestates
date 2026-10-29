// The contract writes and the PDF download check the user themselves
// (2026-10-29). Server Actions and /api/admin routes are reachable without the
// panel layout's login check — see adminActionsAuth.test.ts for the incident
// that made this a test. Reads the source; no DB, no Next runtime.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

test("every contract action checks for an admin before doing anything", () => {
  const src = read("src/app/admin/(panel)/developments/developers/[id]/contractActions.ts");
  assert.match(src, /async function manager\(\)[\s\S]*?getCrmUser\(\)[\s\S]*?canAssignLeads\(u\)/);
  assert.doesNotMatch(src, /^export const \w+ = async/m);
  const starts = Array.from(src.matchAll(/^export async function (\w+)\(/gm));
  assert.equal(starts.length, 2);
  starts.forEach((m, i) => {
    const body = src.slice(m.index!, i + 1 < starts.length ? starts[i + 1].index! : src.length);
    const guard = body.indexOf("await manager()");
    assert.notEqual(guard, -1, `${m[1]} has no admin check`);
    const before = body.slice(body.indexOf("{"), guard);
    assert.doesNotMatch(before, /prisma\.|formData\.|saveContractFile|trashContractFile/, `${m[1]} does work before the check`);
    assert.match(body.slice(guard, guard + 80), /if \(!actor\) return DENIED/);
  });
});

test("the PDF route serves only admins, from outside public/", () => {
  const src = read("src/app/api/admin/developer-contracts/[id]/route.ts");
  const guard = src.indexOf("await getCrmUser()");
  assert.ok(guard > -1 && guard < src.indexOf("prisma."), "no session check before the DB read");
  assert.match(src, /if \(!canAssignLeads\(user\)\) return new NextResponse\(null, \{ status: 403 \}\)/);
  assert.match(src, /private, no-store/);
  const storage = read("src/lib/contractStorage.ts");
  const dir = /CONTRACTS_DIR \|\| "([^"]+)"/.exec(storage)?.[1];
  assert.ok(dir && !dir.includes("public") && !dir.includes("uploads"), `default contract dir ${dir} would be web-served`);
});

test("the digest leaves contract items to their own reminders", () => {
  const src = read("src/app/api/cron/action-digest/route.ts");
  assert.match(src, /!i\.id\.startsWith\(CONTRACT_ITEM_PREFIX\)/);
  // Reminders run before the digest and are caught, so a failing digest cannot swallow them.
  const r = src.indexOf('withCronLog("contract-reminders"');
  const d = src.indexOf('withCronLog("action-digest"');
  assert.ok(r > -1 && d > -1 && r < d);
});
