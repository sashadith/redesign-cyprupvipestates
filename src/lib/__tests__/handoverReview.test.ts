import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEAL_FIXED_ERROR, acceptOutcome, escalationDue, handoverEscalationHtml, keepFixChange, mayAcceptHandover,
} from "@/lib/crm/handoverReviewRules";
import { partnerTimeline, type TimelineRow } from "@/lib/partner/pipeline/timeline";
import { buildHandoverEmail, handoverNoticeOf } from "@/lib/partner/notify";
import { buildTelegramNotification } from "@/lib/partner/telegram";
import { PARTNER_LOCALES } from "@/lib/partner/i18n";

const H = 3_600_000;
const t0 = new Date(Date.UTC(2026, 10, 5, 10, 0));
const plus = (h: number) => new Date(t0.getTime() + h * H);
const req = (remindedAt: Date | null = null, escalatedAt: Date | null = null) => ({ createdAt: t0, remindedAt, escalatedAt });

test("escalationDue: nothing before 24 h, a reminder after, all admins after 48 h, each once", () => {
  assert.equal(escalationDue(req(), plus(23)), null);
  assert.equal(escalationDue(req(), plus(25)), "remind");
  assert.equal(escalationDue(req(plus(24.5)), plus(25)), null);
  assert.equal(escalationDue(req(), plus(49)), "escalate");
  assert.equal(escalationDue(req(plus(25)), plus(49)), "escalate");
  assert.equal(escalationDue(req(plus(25), plus(48.5)), plus(49)), null);
  // Escalated before the reminder ran (the cron was down): the manager is still reminded once.
  assert.equal(escalationDue(req(null, plus(48.5)), plus(49)), "remind");
});

test("acceptOutcome: only an early handover without keep-FIX becomes HANDOVER", () => {
  assert.equal(acceptOutcome({ downgrade: true, keepFix: false }), "HANDOVER");
  assert.equal(acceptOutcome({ downgrade: true, keepFix: true }), "FIX");
  assert.equal(acceptOutcome({ downgrade: false, keepFix: true }), "FIX");
  assert.equal(acceptOutcome({ downgrade: false, keepFix: false }), null);
});

test("keepFixChange: keep goes to FIX, un-keep back to HANDOVER only after a downgrade", () => {
  assert.equal(keepFixChange({ keep: true, currentMode: "HANDOVER", downgrade: true }), "FIX");
  assert.equal(keepFixChange({ keep: true, currentMode: "FIX", downgrade: true }), null);
  assert.equal(keepFixChange({ keep: false, currentMode: "FIX", downgrade: true }), "HANDOVER");
  assert.equal(keepFixChange({ keep: false, currentMode: "FIX", downgrade: false }), null);
  assert.equal(keepFixChange({ keep: false, currentMode: "HANDOVER", downgrade: true }), null);
});

test("mayAcceptHandover: admins and owners always, the partner's manager, nobody else", () => {
  const u = (o: Partial<{ id: string; role: "ADMIN" | "EDITOR"; isOwner: boolean; isActive: boolean }>) => ({ id: "u", role: "EDITOR" as const, isOwner: false, isActive: true, ...o });
  assert.equal(mayAcceptHandover(u({ role: "ADMIN" }), "m"), true);
  assert.equal(mayAcceptHandover(u({ isOwner: true }), null), true);
  assert.equal(mayAcceptHandover(u({ id: "m" }), "m"), true);
  assert.equal(mayAcceptHandover(u({ id: "x" }), "m"), false);
  assert.equal(mayAcceptHandover(u({ id: "x" }), null), false);
  assert.equal(mayAcceptHandover(u({ role: "ADMIN", isActive: false }), "m"), false);
  assert.equal(mayAcceptHandover(u({ id: "m", isActive: false }), "m"), false);
  assert.match(DEAL_FIXED_ERROR, /^The deal already exists/);
});

test("handoverEscalationHtml escapes and names the age and the CRM link", () => {
  const html = handoverEscalationHtml({ kind: "escalate", partnerName: "A&B", client: "<Jo>", hours: 49, url: "https://x/crm/leads/1" });
  assert.ok(html.includes("A&amp;B") && html.includes("&lt;Jo&gt;") && html.includes("49 h"));
  assert.ok(html.includes('href="https://x/crm/leads/1"'));
  assert.ok(!html.includes("!"));
});

const at = (m: number) => new Date(Date.UTC(2026, 10, 5, 10, m));
const row = (id: string, m: number, extra: Partial<TimelineRow>): TimelineRow => ({ id, type: "SYSTEM", occurredAt: at(m), ...extra });

test("partnerTimeline carries the manager's acceptance and keep-FIX change without the staff name", () => {
  const out = partnerTimeline([
    row("acc", 3, { createdByUserId: "u1", createdByName: "Anna", body: "Assigned to Anna (handover accepted)", metadata: { kind: "handover_accepted", requestId: "r1" } }),
    row("on", 2, { createdByUserId: "u1", createdByName: "Anna", body: "Keep Fix on by Anna", metadata: { kind: "keep_fix_changed", keepFix: true } }),
    row("off", 1, { createdByUserId: "u1", createdByName: "Anna", body: "Keep Fix off by Anna", metadata: { kind: "keep_fix_changed", keepFix: false } }),
    row("other", 0, { createdByUserId: "u1", createdByName: "Anna", body: "staff system", metadata: { kind: "lead_edit" } }),
  ], []);
  assert.deepEqual(out.map((e) => [e.id, e.event, e.by, e.text]), [
    ["acc", "handover_accepted", null, null],
    ["on", "keep_fix_on", null, null],
    ["off", "keep_fix_off", null, null],
  ]);
  assert.ok(!JSON.stringify(out).includes("Anna"));
});

test("handoverNoticeOf reads only the handover payloads", () => {
  assert.deepEqual(handoverNoticeOf({ handover: "accepted", keepFix: true, downgraded: false }), { kind: "accepted", keepFix: true, downgraded: false });
  assert.deepEqual(handoverNoticeOf({ handover: "keepFix", keepFix: false }), { kind: "keepFix", keepFix: false, downgraded: false });
  assert.equal(handoverNoticeOf({ toStatus: "OFFER" }), null);
  assert.equal(handoverNoticeOf(null), null);
});

test("the handover notice renders in every partner language, without exclamation marks", () => {
  const notices = [
    { kind: "accepted" as const, keepFix: false, downgraded: true },
    { kind: "accepted" as const, keepFix: true, downgraded: false },
    { kind: "accepted" as const, keepFix: false, downgraded: false },
    { kind: "keepFix" as const, keepFix: true, downgraded: false },
    { kind: "keepFix" as const, keepFix: false, downgraded: false },
  ];
  for (const locale of PARTNER_LOCALES) {
    for (const notice of notices) {
      const mail = buildHandoverEmail(locale, { partnerFirstName: "Paul", clientName: "Jo Doe", link: "https://p/clients/c1", notice });
      const tg = buildTelegramNotification(locale, { kind: "STAGE", clientName: "Jo Doe", handover: notice, url: "https://p/clients/c1", portalUrl: "https://p" });
      for (const s of [mail.subject, mail.text, tg]) {
        assert.ok(s.includes("Jo Doe"), `${locale} ${notice.kind} names the client`);
        assert.ok(!s.includes("!"), `${locale} ${notice.kind}: ${s}`);
        assert.ok(!s.includes("{"), `${locale} ${notice.kind} leaves no placeholder`);
      }
    }
  }
  const en = (notice: (typeof notices)[number]) => buildTelegramNotification("en", { kind: "STAGE", clientName: "Jo", handover: notice, url: "u", portalUrl: "p" });
  assert.ok(en(notices[0]).includes("Your manager took over Jo.") && en(notices[0]).includes("The client is now Handover."));
  assert.ok(en(notices[1]).includes("Your commission stays at Fix."));
  assert.ok(!en(notices[2]).includes("Fix") && !en(notices[2]).includes("now Handover"));
});
