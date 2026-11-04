import { test } from "node:test";
import assert from "node:assert/strict";
import { CLASSIC } from "@/lib/design/theme";
import { canChooseSet, type ThemeRow } from "@/lib/design/store";
import { staffThemeCore, partnerThemeCore } from "@/lib/design/switchCore";
import { PARTNER_LOCALES, dict } from "@/lib/partner/i18n";

const row = (id: string, s: boolean, p: boolean): ThemeRow => ({ id, key: null, name: id, values: { ...CLASSIC }, offeredToStaff: s, offeredToPartners: p, isDefault: false, sort: 1 });
const rows = [row("both", true, true), row("staffOnly", true, false), row("partnerOnly", false, true)];

// Fake store: mirrors setStaffChoice/setPartnerChoice (canChooseSet gate, then write).
function fakeStore() {
  const state = { user: null as string | null, partner: null as string | null };
  return {
    state,
    setStaff: async (_id: string, t: string | null) => { if (t !== null && !canChooseSet(t, rows, "staff")) return false; state.user = t; return true; },
    setPartner: async (_id: string, t: string | null) => { if (t !== null && !canChooseSet(t, rows, "partner")) return false; state.partner = t; return true; },
  };
}

test("staff: partners-only id is rejected and the row is unchanged", async () => {
  const s = fakeStore(); let revalidated = 0;
  const r = await staffThemeCore({ id: "u1" }, "partnerOnly", { setChoice: s.setStaff, revalidate: () => { revalidated++; } });
  assert.deepEqual(r, { ok: false });
  assert.equal(s.state.user, null);
  assert.equal(revalidated, 0);
});
test("staff: offered id writes, null clears, revalidates", async () => {
  const s = fakeStore(); let revalidated = 0;
  const deps = { setChoice: s.setStaff, revalidate: () => { revalidated++; } };
  assert.deepEqual(await staffThemeCore({ id: "u1" }, "staffOnly", deps), { ok: true });
  assert.equal(s.state.user, "staffOnly");
  assert.deepEqual(await staffThemeCore({ id: "u1" }, null, deps), { ok: true });
  assert.equal(s.state.user, null);
  assert.equal(revalidated, 2);
});
test("staff: logged out, or a non-string id, is rejected", async () => {
  const s = fakeStore();
  const deps = { setChoice: s.setStaff, revalidate: () => {} };
  assert.deepEqual(await staffThemeCore(null, "both", deps), { ok: false });
  assert.deepEqual(await staffThemeCore({ id: "u1" }, 42 as unknown as string, deps), { ok: false });
  assert.equal(s.state.user, null);
});
test("partner: logged out and suspended are rejected", async () => {
  const s = fakeStore();
  assert.deepEqual(await partnerThemeCore(null, "both", { setChoice: s.setPartner }), { ok: false });
  assert.deepEqual(await partnerThemeCore({ partner: { id: "p1", status: "SUSPENDED" } }, "both", { setChoice: s.setPartner }), { ok: false });
  assert.deepEqual(await partnerThemeCore({ partner: { id: "p1", status: "PENDING" } }, null, { setChoice: s.setPartner }), { ok: false });
  assert.equal(s.state.partner, null);
});
test("partner: staff-only id rejected; offered writes; null clears", async () => {
  const s = fakeStore();
  const me = { partner: { id: "p1", status: "ACTIVE" } };
  assert.deepEqual(await partnerThemeCore(me, "staffOnly", { setChoice: s.setPartner }), { ok: false });
  assert.equal(s.state.partner, null);
  assert.deepEqual(await partnerThemeCore(me, "partnerOnly", { setChoice: s.setPartner }), { ok: true });
  assert.equal(s.state.partner, "partnerOnly");
  assert.deepEqual(await partnerThemeCore(me, null, { setChoice: s.setPartner }), { ok: true });
  assert.equal(s.state.partner, null);
});
test("portal dictionary has theme keys in every locale", () => {
  for (const l of PARTNER_LOCALES) {
    const th = dict(l).theme;
    for (const k of ["label", "title", "hint", "saved", "default"] as const) assert.ok(th[k].trim().length > 0, `${l}.${k}`);
  }
});
