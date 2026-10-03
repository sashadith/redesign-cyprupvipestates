#!/usr/bin/env node
/* Guard: CC recipients on MCP email drafts (crm_draft_email → crm_send_email).

   2026-10-02: leads that come through a partner need the partner in copy. The
   CC list is validated and stored when the draft is created, shown in the
   operator's preview, and sent EXACTLY as stored once the approval code
   matches; the EMAIL_OUT timeline row records it. Recipient, operator BCC and
   the approval code behave as before.

   Runs the real createEmailDraft / sendEmailDraft / sendLeadEmail against an
   in-memory Prisma stand-in and a captured SMTP — no database, no email.
     node scripts/qa/draft-email-cc-check.mjs */
import { writeFileSync, mkdtempSync, rmSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let build;
try { ({ build } = await import("esbuild")); }
catch { console.error("esbuild is not installed (it is only a transitive dependency)."); process.exit(2); }

const tmp = realpathSync(mkdtempSync(join(tmpdir(), "qa-draft-cc-")));
process.on("exit", () => rmSync(tmp, { recursive: true, force: true }));
const w = (name, src) => { const p = join(tmp, name); writeFileSync(p, src); return p; };

const prismaStub = w("prisma.cjs", `
const db = globalThis.__db = globalThis.__db || { leads: [], drafts: [], interactions: [] };
let n = 0;
const match = (row, where = {}) => Object.entries(where).every(([k, v]) => {
  if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
    if ("gte" in v) return typeof row[k] === "number" ? row[k] >= v.gte : row[k] >= v.gte;
    return true; // nested relation filters (newsletter exclusion) are not modelled
  }
  return row[k] === v;
});
const pick = (o, sel) => sel ? Object.fromEntries(Object.keys(sel).map((k) => [k, o[k]])) : { ...o };
const prisma = {
  lead: { findFirst: async ({ where, select }) => { const r = db.leads.find((l) => match(l, where)); return r ? pick(r, select) : null; } },
  leadEmailDraft: {
    count: async () => 0,
    findFirst: async ({ where, select }) => { const r = db.drafts.find((d) => match(d, where)); return r ? pick(r, select) : null; },
    findUnique: async ({ where, select }) => { const r = db.drafts.find((d) => d.id === where.id); return r ? pick(r, select) : null; },
    update: async ({ where, data }) => Object.assign(db.drafts.find((d) => d.id === where.id), data),
    create: async ({ data, select }) => { const r = { id: "draft-" + (++n), status: "PENDING", failedAttempts: 0, ...data }; db.drafts.push(r); return pick(r, select); },
    updateMany: async ({ where, data }) => {
      const rows = db.drafts.filter((d) => d.id === where.id && (!where.status || d.status === where.status) && (!where.failedAttempts || d.failedAttempts >= where.failedAttempts.gte));
      for (const r of rows) for (const [k, v] of Object.entries(data)) r[k] = v && typeof v === "object" && "increment" in v ? r[k] + v.increment : v;
      return { count: rows.length };
    },
  },
  leadInteraction: {
    create: async ({ data, select }) => { const r = { id: "int-" + (++n), occurredAt: new Date(), ...data }; db.interactions.push(r); return pick(r, select); },
    findFirst: async ({ where, select }) => {
      const rows = db.interactions.filter((i) => match(i, where)).sort((x, y) => y.occurredAt - x.occurredAt);
      return rows[0] ? pick(rows[0], select) : null;
    },
  },
};
prisma.$transaction = async (fn) => fn(prisma);
module.exports.prisma = prisma;`);
const smtpStub = w("smtp.cjs", `
globalThis.__mails = globalThis.__mails || [];
class EmailSettingsMissingError extends Error {}
module.exports.EmailSettingsMissingError = EmailSettingsMissingError;
module.exports.getUserEmailSettingsRow = async () => ({ fromAddress: "operator@cyprusvipestates.com", fromName: "Sascha" });
module.exports.sendUserEmail = async (userId, opts) => { globalThis.__mails.push(opts); return { messageId: "<m" + globalThis.__mails.length + "@x>" }; };`);
const misc = w("misc.cjs", `
module.exports.getSignatureHtml = async () => "<p>Sascha</p>";
module.exports.applyFollowUpCadence = async () => {};
module.exports.EXCLUDE_NEWSLETTER = {};`);

const entry = w("entry.ts", `
export { createEmailDraft } from ${JSON.stringify(join(process.cwd(), "src/lib/mcp/drafts/createDraft.ts"))};
export { sendEmailDraft } from ${JSON.stringify(join(process.cwd(), "src/lib/mcp/drafts/sendDraft.ts"))};`);
const out = await build({
  entryPoints: [entry], bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent",
  tsconfig: join(process.cwd(), "tsconfig.json"),
  external: ["@prisma/client", "nodemailer"],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  plugins: [{ name: "stubs", setup(b) {
    b.onResolve({ filter: /^@\/lib\/prisma$/ }, () => ({ path: prismaStub }));
    b.onResolve({ filter: /(^@\/lib\/crm\/sendCrmEmail$|^\.\/sendCrmEmail$)/ }, () => ({ path: smtpStub }));
    b.onResolve({ filter: /(^@\/lib\/emailSignature$|^\.\/followUpCadence$|^@\/lib\/crm\/leadBucket$)/ }, () => ({ path: misc }));
    b.onResolve({ filter: /^next\/(server|headers|cache)$/ }, () => ({ path: misc })); // not on the tested path
  } }],
});
// Inside the repo, so the external packages (next, nodemailer, …) resolve.
const bundle = join(process.cwd(), "node_modules", `.qa-draft-cc-${process.pid}.mjs`);
process.on("exit", () => rmSync(bundle, { force: true }));
writeFileSync(bundle, out.outputFiles[0].text);
const { createEmailDraft, sendEmailDraft } = await import(bundle);

let failures = 0;
const check = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++; console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
};
const rejects = async (name, fn, re) => {
  try { await fn(); failures++; console.log(`  FAIL ${name}: no error`); }
  catch (e) { if (re.test(String(e?.message))) console.log(`  ok   ${name}`); else { failures++; console.log(`  FAIL ${name}: ${e?.message}`); } }
};

const db = globalThis.__db, mails = globalThis.__mails;
const actor = { userId: "u1", userName: "Sascha" };
db.leads.push({ id: "L1", email: "client@example.com", firstName: "Max", lastName: "Muster", languagePreference: "en", deletedAt: null });

/* ── draft with CC ── */
const d = await createEmailDraft(actor, { leadId: "L1", subject: "Your shortlist", body: "Dear Max,\n\nhere it is.", cc: ["partner@alfitouri.com"] });
const preview = mails[0];
check("preview goes only to the operator", [preview.to, preview.cc ?? null, preview.bcc ?? null], ["operator@cyprusvipestates.com", null, null]);
check("preview shows the CC before approval", /CC: partner@alfitouri\.com/.test(preview.text) && /CC: <strong>partner@alfitouri\.com/.test(preview.html), true);
check("draft stores the CC", db.drafts[0].cc, ["partner@alfitouri.com"]);
check("tool result reports the CC", d.cc, ["partner@alfitouri.com"]);
check("the draft's SYSTEM timeline row names the CC", /CC: partner@alfitouri\.com/.test(db.interactions[0].body), true);

/* ── approval code still required ── */
await rejects("a wrong code sends nothing", () => sendEmailDraft(actor, d.draftId, "WRONG1"), /code/i);
check("…no lead email went out", mails.length, 1);

/* ── send: exactly the stored CC, lead as To, operator BCC unchanged ── */
const r = await sendEmailDraft(actor, d.draftId, db.drafts[0].approvalCode);
const sent = mails[1];
check("sent to the lead", sent.to, "client@example.com");
check("CC exactly as stored on the draft", sent.cc, ["partner@alfitouri.com"]);
check("operator still in BCC", sent.bcc, "operator@cyprusvipestates.com");
check("send result reports the CC", r.cc, ["partner@alfitouri.com"]);
const out1 = db.interactions.find((i) => i.type === "EMAIL_OUT");
check("EMAIL_OUT timeline row records the CC", out1?.metadata?.cc, ["partner@alfitouri.com"]);

/* ── unchanged behaviour without CC ── */
const d2 = await createEmailDraft(actor, { leadId: "L1", subject: "No copy", body: "Dear Max,\n\nhi." });
await sendEmailDraft(actor, d2.draftId, db.drafts.find((x) => x.id === d2.draftId).approvalCode);
const sent2 = mails[mails.length - 1];
check("without CC: no cc header, BCC as before", [sent2.to, sent2.cc ?? null, sent2.bcc], ["client@example.com", null, "operator@cyprusvipestates.com"]);
check("without CC: no cc in the timeline metadata", "cc" in (db.interactions.filter((i) => i.type === "EMAIL_OUT").pop().metadata ?? {}), false);
check("without CC: no CC line in the preview", /CC:/.test(mails[mails.length - 2].text), false);

/* ── validation at draft time ── */
await rejects("CC equal to the lead's address is refused", () => createEmailDraft(actor, { leadId: "L1", subject: "s", body: "b", cc: ["Client@Example.com"] }), /lead's own address/);
await rejects("an invalid CC is refused", () => createEmailDraft(actor, { leadId: "L1", subject: "s", body: "b", cc: ["not-an-email"] }), /valid email/);
await rejects("more than five are refused", () => createEmailDraft(actor, { leadId: "L1", subject: "s", body: "b", cc: ["a@x.com", "b@x.com", "c@x.com", "d@x.com", "e@x.com", "f@x.com"] }), /At most 5/);

/* ── the lead's address changed to a CC address between draft and send ── */
const d3 = await createEmailDraft(actor, { leadId: "L1", subject: "s", body: "b", cc: ["partner@alfitouri.com"] });
db.leads[0].email = "partner@alfitouri.com";
const before = mails.length;
await rejects("send refuses instead of altering the CC", () => sendEmailDraft(actor, d3.draftId, db.drafts.find((x) => x.id === d3.draftId).approvalCode), /no longer be sent as approved/);
check("…and nothing went out", mails.length, before);
check("…the stored CC is untouched", db.drafts.find((x) => x.id === d3.draftId).cc, ["partner@alfitouri.com"]);

/* ── reply all (2026-10-02): no `cc` given → the other participants of the
   lead's LATEST inbound email, as stored by the inbound poller ── */
db.leads[0].email = "client@example.com";
const inbound = (cc, minutesAgo) => db.interactions.push({ id: "in-" + minutesAgo, leadId: "L1", type: "EMAIL_IN", occurredAt: new Date(Date.now() - minutesAgo * 60000), metadata: { attachmentCount: 0, ...(cc ? { cc } : {}) } });
inbound(["old@x.com"], 120);
inbound(["partner@alfitouri.com", "client@example.com", "operator@cyprusvipestates.com"], 5);
const rA = await createEmailDraft(actor, { leadId: "L1", subject: "Re: shortlist", body: "Dear Max,\n\nthanks." });
check("no cc given → the latest reply's partner is copied", [rA.cc, rA.ccSource], [["partner@alfitouri.com"], "last_reply"]);
check("…lead and operator are never copied, the older reply is ignored", db.drafts.find((x) => x.id === rA.draftId).cc, ["partner@alfitouri.com"]);
check("…and the preview shows it before approval", /CC: partner@alfitouri\.com/.test(mails[mails.length - 1].text), true);
const sentA = (await sendEmailDraft(actor, rA.draftId, db.drafts.find((x) => x.id === rA.draftId).approvalCode), mails[mails.length - 1]);
check("…and the sent reply carries it", [sentA.to, sentA.cc], ["client@example.com", ["partner@alfitouri.com"]]);
const rB = await createEmailDraft(actor, { leadId: "L1", subject: "Re: private", body: "Dear Max,\n\nonly you.", cc: [] });
check("cc: [] → deliberately nobody in copy", [rB.cc, rB.ccSource], [[], "explicit"]);
const rC = await createEmailDraft(actor, { leadId: "L1", subject: "Re: x", body: "b", cc: ["other@agency.com"] });
check("an explicit list replaces the reply-all default", [rC.cc, rC.ccSource], [["other@agency.com"], "explicit"]);
inbound(null, 1);
const rD = await createEmailDraft(actor, { leadId: "L1", subject: "Re: y", body: "b" });
check("latest reply had nobody in copy → none (no reaching back to older mail)", [rD.cc, rD.ccSource], [[], "none"]);

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
