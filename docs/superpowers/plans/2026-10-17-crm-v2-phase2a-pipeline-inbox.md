# CRM v2 Phase 2a (Shell, Pipeline, Inbox) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first usable slice of the new CRM at `/crm`: Limestone shell, a drag-and-drop pipeline that enforces deals on Reserved/Sold and a reason on Lost, and an inbox where the operator assigns unassigned leads using an explained owner suggestion with Telegram + email notification.

**Architecture:** A new top-level route `src/app/crm/` with its own `<html>` layout (like `src/app/admin/layout.tsx`), excluded from the locale middleware. Server components load data through the Phase 1 access layer; all writes go through one `"use server"` file that re-checks the session and rights. Decision logic lives in pure, unit-tested modules in `src/lib/crm/` (board model, move plan, owner suggestion); UI components are thin. Lead details open the existing old cockpit (`/admin/crm/[id]`) until Phase 2b ships the new one. The old admin CRM UI is not modified.

**Tech Stack:** Next.js 14.2 App Router (server components + server actions), Prisma 5.22, NextAuth v5 beta, Tailwind 3 plus a scoped CSS file with Limestone tokens, native HTML5 drag-and-drop (no new UI dependencies), Node test runner via tsx.

**Spec:** `docs/superpowers/specs/2026-10-17-crm-v2-partner-portal-design.md` (sections 2, 3, 5.1, 5.3, 6.1, 9 #9-12 context, 10 Phase 2). Mockup: https://claude.ai/artifact/FAmQpy3gu5DhicwAra8J4N (Limestone tab).

Phase 2 is split into three plans: **2a (this)** shell + pipeline + inbox; **2b** lead cockpit, commission-rate screen, employee rights screen, old-CRM gate for restricted employees; **2c** Today, SLA timers, Claude summary/intake, ⌘K.

## Global Constraints

- The local `.env.local` DATABASE_URL is the LIVE production database. Never run `prisma migrate dev/reset/deploy`, `db push`, `next build`, or any script that writes to the DB. `npx prisma generate`/`validate` with `DATABASE_URL=postgresql://x:x@localhost:1/x` only. This plan needs **no** schema change.
- **The old admin CRM UI stays untouched** (operator, 2026-10-17). Do not modify files under `src/app/admin/`. The guard test `src/lib/__tests__/crmStatusSitesUseCentralList.test.ts` must keep passing.
- Admin/internal copy is English. The new CRM is internal → English UI.
- Visual direction: **Limestone in its original colours** — cool light grey ground, white panels, brand green `#1B4B43` for text and structure, seven stage colours used identically everywhere; display face Bricolage Grotesque, body Hanken Grotesk; tabular numerals; motion only where it explains a change; honour `prefers-reduced-motion`; responsive down to 375 px. Champagne/bronze accents were rejected — do not add them.
- Every server action re-checks the session itself (middleware does not run auth for excluded routes).
- Access rules come only from `src/lib/crm/access.ts` (`leadAccessWhere`, `canEditLead`, `canAssignLeads`).
- Commission numbers come only from `src/lib/crm/commission.ts`. Prisma `Decimal` values are converted with `.toNumber()` at the DB boundary, never with an `as` cast.
- Tests: `npm test` (node:test via tsx, files in `src/lib/__tests__/` or `src/lib/mcp/__tests__/`), no DB access in tests. Type check `npx tsc --noEmit`. Lint `npm run lint`.
- Commit with explicit paths; never `git add -A`. Do not push. Do not deploy.

## Decisions taken while planning

1. **Route `/crm`, not a route group.** `src/app/crm/layout.tsx` owns `<html>/<body>` (same pattern as `src/app/admin/layout.tsx`, since `src/app/layout.tsx` is a fragment). Middleware matcher gets `crm(?![\\w-])` (a lookahead, the same regex feature the matcher already uses — `$` and `(?:` are avoided because Next compiles matchers through path-to-regexp) so `/crmfoo` still localises.
2. **Fonts are vendored**, not `next/font/google` (the repo moved away from it). Bricolage Grotesque (600, 700) and Hanken Grotesk (400, 500, 600, 700) woff2 files go into `public/crm-fonts/` with `@font-face` in `src/app/crm/crm.css`.
3. **Notifications:** there is no per-employee Telegram chat yet (that arrives with the Phase 3 bot). Assignment posts to the existing office Telegram chat naming the assignee, and emails the assignee directly. `sendEmail` gets an optional `to` parameter (backward compatible: default unchanged).
4. **Lead details** link to the old cockpit `/admin/crm/<id>` until 2b. Restricted employees do not exist yet (Phase 1 backfilled full rights), so this leaks nothing today; 2b adds the gate.
5. **Deals on move:** moving to Reserved requires deal input and creates a deal (EXPECTED). Moving to Sold marks open EXPECTED deals EARNED, or asks for a deal if there is none. Moving a lead that has open deals (EXPECTED/EARNED) back to an earlier stage or to Lost requires an explicit "cancel the deal(s)" confirmation, which sets them CANCELLED. Deals already DEVELOPER_PAID or PAID_OUT block any backwards move.
6. **Partner share is `null`** on deals created in 2a (partners arrive in Phase 3), so `partnerCommission` stays null.
7. **Board scope:** leads visible to the user (access layer), not deleted, not newsletter. Unassigned leads appear only in the Inbox, not on the board. KEEP_CONTACT and LOST are not board columns; they are reachable as drop targets ("Keep contact", "Lost") under the board.

## File Structure

| File | Responsibility |
|---|---|
| `src/middleware.ts` | Modify: exclude `/crm` from locale handling |
| `src/lib/crm/session.ts` | Create: `getCrmUser()` / `requireCrmUser()` (session → `CrmUser` + name) |
| `src/app/crm/layout.tsx` | Create: `<html>/<body>`, auth redirect, shell |
| `src/app/crm/crm.css` | Create: Limestone tokens, fonts, component styles |
| `src/app/crm/page.tsx` | Create: redirect to `/crm/pipeline` |
| `src/app/crm/components/Shell.tsx` | Create: top bar, nav, dock (client, for active state) |
| `src/lib/crm/boardModel.ts` | Create: pure board/card view model |
| `src/lib/crm/pipelineQuery.ts` | Create: load board leads + deals for a user |
| `src/app/crm/pipeline/page.tsx` | Create: server page |
| `src/app/crm/components/Board.tsx` | Create: client board, DnD, keyboard, move menu |
| `src/app/crm/components/MoveDialog.tsx` | Create: deal form / lost reason / cancel-deals confirm |
| `src/app/crm/components/Toast.tsx` | Create: toast |
| `src/lib/crm/movePlan.ts` | Create: pure "what does this move require" |
| `src/lib/crm/moveLead.ts` | Create: server-side execution of a move (status + deals) |
| `src/app/crm/actions.ts` | Create: `"use server"` entry points |
| `src/lib/crm/suggestOwner.ts` | Create: pure owner suggestion |
| `src/lib/crm/assignLead.ts` | Create: server-side assignment + timeline row + notifications |
| `src/lib/sendEmail.ts` | Modify: optional `to` |
| `src/app/crm/inbox/page.tsx` | Create: inbox |
| `src/app/crm/components/InboxList.tsx` | Create: client list with Assign |
| Tests in `src/lib/__tests__/`: `crmMiddlewareCrm.test.ts`, `crmBoardModel.test.ts`, `crmMovePlan.test.ts`, `crmSuggestOwner.test.ts` | Create |

---

### Task 1: Route, middleware exclusion, session helper, Limestone shell

**Files:**
- Modify: `src/middleware.ts` (the `matcher` string near the end of the file)
- Create: `src/lib/crm/session.ts`
- Create: `src/app/crm/layout.tsx`, `src/app/crm/page.tsx`, `src/app/crm/crm.css`, `src/app/crm/components/Shell.tsx`
- Create: `public/crm-fonts/*.woff2`
- Test: `src/lib/__tests__/crmMiddlewareCrm.test.ts`

**Interfaces:**
- Consumes: `CrmUser`, `canAssignLeads` from `src/lib/crm/access.ts`; `loadCrmUser` from `src/lib/crm/accessUser.ts`; `auth` from `src/auth.ts`.
- Produces:
  - `type SessionCrmUser = CrmUser & { name: string; email: string }`
  - `getCrmUser(): Promise<SessionCrmUser | null>` — null when not signed in or inactive
  - `requireCrmUser(): Promise<SessionCrmUser>` — throws `Error("Unauthorized")`
  - `<Shell user={{ name, canAssign, inboxCount }}>` client component wrapping page content
  - CSS classes used by later tasks: `.crm-app`, `.crm-main`, `.crm-headrow`, `.crm-chip`, `.crm-chip.on`, `.crm-panel`, `.crm-btn`, `.crm-btn.primary`, `.crm-toast`, `.crm-toast.show`, stage classes `.s-NEW … .s-CLOSED, .s-KEEP_CONTACT, .s-LOST` that set `--sc`

- [ ] **Step 1: Write the failing middleware test**

`src/lib/__tests__/crmMiddlewareCrm.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The matcher is a JS-compatible regex string; a path the matcher does NOT
// match is skipped by the locale middleware.
function matcher(): RegExp {
  const src = readFileSync("src/middleware.ts", "utf8");
  const m = src.match(/matcher:\s*\[\s*"([^"]+)"/);
  assert.ok(m, "matcher string not found");
  return new RegExp("^" + m![1].replace(/\\\\/g, "\\") + "$");
}

test("/crm and its sub-pages bypass the locale middleware", () => {
  const re = matcher();
  assert.equal(re.test("/crm"), false);
  assert.equal(re.test("/crm/pipeline"), false);
  assert.equal(re.test("/crm/inbox"), false);
});

test("look-alike public paths are still localised", () => {
  const re = matcher();
  assert.equal(re.test("/crmfoo"), true);
  assert.equal(re.test("/en/projects"), true);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test src/lib/__tests__/crmMiddlewareCrm.test.ts`
Expected: FAIL on "/crm … bypass" (the matcher still matches `/crm`).

- [ ] **Step 3: Add the exclusion**

In `src/middleware.ts`, in the matcher alternation, insert `crm(?![\\w-])|` right after `admin|` (in the TypeScript source that is the characters `crm(?![\\w-])|`, i.e. a doubled backslash inside the string literal, matching how `\\.well-known` is written):
```
"/((?!api|\\.well-known|_next/static|_next/image|admin|crm(?![\\w-])|structure|robots|...
```
Add a one-line comment above the matcher: `// crm (2026-10-18): the new CRM at /crm (own layout, own auth check) — anchored so /crmfoo still localises.`

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --import tsx --test src/lib/__tests__/crmMiddlewareCrm.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Session helper `src/lib/crm/session.ts`**

```ts
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { CrmUser } from "./access";

// The signed-in staff member as the new CRM sees them (2026-10-18). Same
// session as /admin; rights come from the DB on every call, never from the JWT.
export type SessionCrmUser = CrmUser & { name: string; email: string };

export async function getCrmUser(): Promise<SessionCrmUser | null> {
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) return null;
  const u = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, isOwner: true, isActive: true, canSeeColleagues: true, canEditColleagues: true },
  });
  if (!u || !u.isActive) return null;
  return { ...u, role: u.role as CrmUser["role"] };
}

export async function requireCrmUser(): Promise<SessionCrmUser> {
  const u = await getCrmUser();
  if (!u) throw new Error("Unauthorized");
  return u;
}
```

- [ ] **Step 6: Vendor the fonts**

Run (downloads from Google's own font CDN; files are static woff2):
```bash
mkdir -p public/crm-fonts
curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36" \
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Hanken+Grotesk:wght@400;500;600;700&display=swap" \
  -o /tmp/crm-fonts.css
grep -o "https://fonts.gstatic.com/[^)]*" /tmp/crm-fonts.css | sort -u
```
Download only the **latin** subset file of each family (the `/* latin */` blocks in `/tmp/crm-fonts.css`); Google serves one variable file per family covering all requested weights. Save as `public/crm-fonts/bricolage-grotesque-latin.woff2` and `public/crm-fonts/hanken-grotesk-latin.woff2` with `curl -s -o`. Verify each with `file public/crm-fonts/*.woff2` (expect "Web Open Font Format (Version 2)"). If the CSS lists separate files per weight, download each and add one `@font-face` per file in Step 7.

- [ ] **Step 7: `src/app/crm/crm.css`**

```css
/* CRM v2 — Limestone (2026-10-18). Scoped to .crm-app; tokens mirror the approved mockup. */
@font-face { font-family: "Bricolage Grotesque"; font-style: normal; font-weight: 600 700; font-display: swap; src: url("/crm-fonts/bricolage-grotesque-latin.woff2") format("woff2"); }
@font-face { font-family: "Hanken Grotesk"; font-style: normal; font-weight: 400 700; font-display: swap; src: url("/crm-fonts/hanken-grotesk-latin.woff2") format("woff2"); }

.crm-app {
  --bg: #eef2f1; --panel: #ffffff; --colbg: #e3e9e7; --ink: #10302b; --muted: #5f716c; --line: #d5dedb;
  --accent: #1b4b43; --onaccent: #f2f7f5; --good: #1d7a52; --warn: #b5651d; --danger: #b42318;
  --srcbg: #eef2f1; --partnerbg: #e2efe9; --partnerfg: #1b4b43; --sugbg: #eef5f2;
  --display: "Bricolage Grotesque", system-ui, sans-serif; --body: "Hanken Grotesk", system-ui, sans-serif;
  --mono: ui-monospace, "SF Mono", Menlo, monospace; --r: 14px;
  min-height: 100vh; background: var(--bg); color: var(--ink); font-family: var(--body); font-size: 14px;
}
.crm-app .s-NEW { --sc: #8a99a3; } .crm-app .s-CONTACTED { --sc: #4f86c6; } .crm-app .s-COMMUNICATING { --sc: #2f9e9a; }
.crm-app .s-VIEWING_SCHEDULED { --sc: #8467c9; } .crm-app .s-OFFER { --sc: #d19a2a; } .crm-app .s-RESERVED { --sc: #c8603a; }
.crm-app .s-CLOSED { --sc: #1d7a52; } .crm-app .s-KEEP_CONTACT { --sc: #6b7c86; } .crm-app .s-LOST { --sc: #b42318; }

.crm-top { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 20; display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
  padding: 12px 20px; background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
.crm-logo { font-family: var(--display); font-weight: 700; font-size: 17px; display: flex; align-items: center; gap: 8px; white-space: nowrap; color: var(--ink); text-decoration: none; }
.crm-logo i { width: 26px; height: 26px; border-radius: 8px; background: var(--accent); color: var(--onaccent); display: inline-grid; place-items: center; font: 700 11px var(--body); font-style: normal; }
.crm-nav { display: flex; gap: 2px; flex-wrap: wrap; }
.crm-nav a { padding: 8px 12px; border-radius: 10px; color: var(--muted); text-decoration: none; font-weight: 600; font-size: 13.5px; display: flex; gap: 6px; align-items: center; }
.crm-nav a.on { color: var(--ink); background: var(--panel); }
.crm-nav .n { font-family: var(--mono); font-size: 11px; background: var(--accent); color: var(--onaccent); border-radius: 99px; padding: 1px 6px; font-variant-numeric: tabular-nums; }
.crm-me { margin-left: auto; display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: 13px; }
.crm-me b { width: 32px; height: 32px; border-radius: 50%; background: var(--accent); color: var(--onaccent); display: grid; place-items: center; font-size: 12px; }
.crm-main { padding: 20px; display: flex; flex-direction: column; gap: 18px; padding-bottom: 96px; }
.crm-headrow { display: flex; justify-content: space-between; align-items: end; gap: 12px; flex-wrap: wrap; }
.crm-headrow h1 { margin: 0; font-family: var(--display); font-weight: 700; font-size: 30px; letter-spacing: -.03em; line-height: 1; }
.crm-headrow p { margin: 6px 0 0; color: var(--muted); font-size: 13.5px; }
.crm-chip { border: 1px solid var(--line); background: var(--panel); color: var(--ink); border-radius: 99px; padding: 6px 11px; font: 600 12.5px var(--body); cursor: pointer; text-decoration: none; }
.crm-chip.on { background: var(--ink); color: var(--bg); border-color: var(--ink); }
.crm-panel { background: var(--panel); border: 1px solid var(--line); border-radius: var(--r); padding: 14px; }
.crm-btn { border: 1px solid var(--line); background: var(--panel); color: var(--ink); font: 700 13px var(--body); padding: 8px 12px; border-radius: 10px; cursor: pointer; }
.crm-btn.primary { background: var(--accent); color: var(--onaccent); border-color: var(--accent); }
.crm-btn:disabled { opacity: .5; cursor: default; }
.crm-btn:focus-visible, .crm-chip:focus-visible, .crm-nav a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.crm-dock { position: fixed; left: 50%; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); display: flex; gap: 4px; z-index: 30;
  background: rgba(16, 48, 43, .92); backdrop-filter: blur(10px); padding: 6px; border-radius: 16px; box-shadow: 0 18px 40px -16px rgba(16, 48, 43, .6); }
.crm-dock a { color: #dfeee9; font: 600 12.5px var(--body); padding: 9px 12px; border-radius: 11px; text-decoration: none; white-space: nowrap; }
.crm-dock a:hover { background: rgba(255, 255, 255, .1); }
.crm-dock a.plus { background: #e9f3ef; color: #10302b; }
.crm-toast { position: fixed; left: 50%; bottom: calc(84px + env(safe-area-inset-bottom, 0px)); transform: translate(-50%, 20px); opacity: 0; pointer-events: none; z-index: 40;
  background: var(--ink); color: var(--bg); padding: 10px 16px; border-radius: 12px; font-size: 13px; font-weight: 600; transition: all .35s cubic-bezier(.2,.8,.2,1); max-width: calc(100% - 32px); }
.crm-toast.show { opacity: 1; transform: translate(-50%, 0); }
.crm-toast.error { background: var(--danger); color: #fff; }
@media (max-width: 720px) {
  .crm-main { padding: 14px 16px 104px; }
  .crm-headrow h1 { font-size: 24px; }
  .crm-me span { display: none; }
  .crm-dock { left: 0; right: 0; bottom: 0; transform: none; border-radius: 0; justify-content: space-around; padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px)); }
}
@media (prefers-reduced-motion: reduce) { .crm-app *, .crm-app *::before, .crm-app *::after { transition: none !important; animation: none !important; } }
```

- [ ] **Step 8: `src/app/crm/components/Shell.tsx`**

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = { user: { name: string; canAssign: boolean; inboxCount: number }; children: React.ReactNode };

export function Shell({ user, children }: Props) {
  const path = usePathname();
  const on = (p: string) => (path === p || path.startsWith(p + "/") ? "on" : undefined);
  const initials = user.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <>
      <header className="crm-top">
        <Link href="/crm/pipeline" className="crm-logo"><i>CV</i>CVE Office</Link>
        <nav className="crm-nav" aria-label="CRM">
          <Link href="/crm/pipeline" className={on("/crm/pipeline")}>Pipeline</Link>
          {user.canAssign && (
            <Link href="/crm/inbox" className={on("/crm/inbox")}>
              Inbox {user.inboxCount > 0 && <span className="n">{user.inboxCount}</span>}
            </Link>
          )}
          <Link href="/admin/crm">Old CRM</Link>
        </nav>
        <div className="crm-me"><span>{user.name}</span><b aria-hidden="true">{initials}</b></div>
      </header>
      <main className="crm-main">{children}</main>
      <nav className="crm-dock" aria-label="Quick actions">
        <Link href="/admin/crm/new" className="plus">＋ New lead</Link>
        <Link href="/crm/pipeline">Pipeline</Link>
        {user.canAssign && <Link href="/crm/inbox">Inbox</Link>}
      </nav>
    </>
  );
}
```

- [ ] **Step 9: `src/app/crm/layout.tsx` and `src/app/crm/page.tsx`**

```tsx
// src/app/crm/layout.tsx
import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import "@/app/globals.css";
import "./crm.css";
import { getCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { prisma } from "@/lib/prisma";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { Shell } from "./components/Shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "CVE Office", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const user = await getCrmUser();
  if (!user) redirect("/admin/login?callbackUrl=/crm");
  const canAssign = canAssignLeads(user);
  const inboxCount = canAssign
    ? await prisma.lead.count({ where: { deletedAt: null, assignedToId: null, ...EXCLUDE_NEWSLETTER } })
    : 0;
  return (
    <html lang="en">
      <body className="crm-app antialiased">
        <Shell user={{ name: user.name, canAssign, inboxCount }}>{children}</Shell>
      </body>
    </html>
  );
}
```
```tsx
// src/app/crm/page.tsx
import { redirect } from "next/navigation";
export default function CrmIndex() { redirect("/crm/pipeline"); }
```
If `globals.css` sets a body colour/background that fights `.crm-app`, the `.crm-app` class on `<body>` wins because it is declared later; check with the preview in Task 6.
If `/admin/login` does not honour `callbackUrl`, keep the redirect anyway (harmless) and note it in the report.

- [ ] **Step 10: Tests, types, lint, commit**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all pass (the old-CRM guard test included).
```bash
git add src/middleware.ts src/lib/crm/session.ts src/app/crm/layout.tsx src/app/crm/page.tsx src/app/crm/crm.css src/app/crm/components/Shell.tsx public/crm-fonts src/lib/__tests__/crmMiddlewareCrm.test.ts
git commit -m "CRM v2: /crm route with its own layout, Limestone shell and session helper"
```

---

### Task 2: Board model and pipeline page (read-only)

**Files:**
- Create: `src/lib/crm/boardModel.ts`, `src/lib/crm/pipelineQuery.ts`, `src/app/crm/pipeline/page.tsx`
- Test: `src/lib/__tests__/crmBoardModel.test.ts`

**Interfaces:**
- Consumes: `FUNNEL_STATUSES`, `STATUS_LABEL`, `LeadStatusValue`, `isLeadStatus` (leadStatus.ts); `leadAccessWhere`, `CrmUser` (access.ts); `EXCLUDE_NEWSLETTER` (leadBucket.ts).
- Produces (`boardModel.ts`, pure):
  - `type BoardLeadInput = { id: string; firstName: string; lastName: string; status: string; source: string; languagePreference: string | null; assignedTo: { id: string; name: string } | null; projectLabel: string | null; lastContactAt: Date | null; createdAt: Date; deals: { price: number; ourCommission: number | null; commissionStatus: string }[] }`
  - `type BoardCard = { id: string; name: string; lang: string | null; project: string | null; sourceLabel: string; isPartner: boolean; ownerInitials: string | null; ownerName: string | null; ageLabel: string; stale: boolean; dealValue: number | null; dealCommission: number | null; status: LeadStatusValue }`
  - `type BoardColumn = { status: LeadStatusValue; label: string; cards: BoardCard[]; total: number }`
  - `buildBoard(leads: BoardLeadInput[], now: Date): BoardColumn[]` — one column per `FUNNEL_STATUSES`, in order; leads with other statuses are omitted; `total` = sum of open-deal prices
  - `toCard(lead: BoardLeadInput, now: Date): BoardCard`
  - `STALE_DAYS = 7`
  - `type BoardFilter = "all" | "mine" | "stale"`; `isBoardFilter(x: unknown): x is BoardFilter`
- Produces (`pipelineQuery.ts`): `loadBoardLeads(user: CrmUser, filter: BoardFilter, now: Date): Promise<BoardLeadInput[]>`

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/crmBoardModel.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBoard, toCard, isBoardFilter, type BoardLeadInput } from "@/lib/crm/boardModel";

const now = new Date("2026-10-18T12:00:00Z");
const base: BoardLeadInput = {
  id: "l1", firstName: "Markus", lastName: "Brenner", status: "NEW", source: "CONTACT_FORM",
  languagePreference: "de", assignedTo: { id: "u1", name: "Sophie Keller" }, projectLabel: "Eden Coast",
  lastContactAt: null, createdAt: new Date("2026-10-18T10:00:00Z"), deals: [],
};

test("columns follow the funnel and leave out keep-contact and lost", () => {
  const cols = buildBoard([base, { ...base, id: "l2", status: "LOST" }, { ...base, id: "l3", status: "KEEP_CONTACT" }], now);
  assert.deepEqual(cols.map((c) => c.status), ["NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "RESERVED", "CLOSED"]);
  assert.equal(cols[0].cards.length, 1);
  assert.equal(cols.reduce((n, c) => n + c.cards.length, 0), 1);
});

test("a card shows name, owner initials and a recent age", () => {
  const c = toCard(base, now);
  assert.equal(c.name, "Markus Brenner");
  assert.equal(c.ownerInitials, "SK");
  assert.equal(c.ageLabel, "2h");
  assert.equal(c.stale, false);
  assert.equal(c.lang, "DE");
});

test("a lead without contact for 7+ days is stale, counted from the last contact", () => {
  const old = { ...base, createdAt: new Date("2026-09-01T00:00:00Z"), lastContactAt: new Date("2026-10-10T12:00:00Z") };
  const c = toCard(old, now);
  assert.equal(c.ageLabel, "8d");
  assert.equal(c.stale, true);
});

test("partner leads are flagged and labelled", () => {
  const c = toCard({ ...base, source: "PARTNER" }, now);
  assert.equal(c.isPartner, true);
  assert.equal(c.sourceLabel, "Partner");
});

test("open deals add up per card and per column; cancelled deals do not count", () => {
  const lead = { ...base, status: "RESERVED", deals: [
    { price: 400_000, ourCommission: 20_000, commissionStatus: "EXPECTED" },
    { price: 300_000, ourCommission: 15_000, commissionStatus: "CANCELLED" },
  ] };
  const c = toCard(lead, now);
  assert.equal(c.dealValue, 400_000);
  assert.equal(c.dealCommission, 20_000);
  const col = buildBoard([lead], now).find((x) => x.status === "RESERVED")!;
  assert.equal(col.total, 400_000);
});

test("filters are validated", () => {
  assert.equal(isBoardFilter("mine"), true);
  assert.equal(isBoardFilter("everything"), false);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test src/lib/__tests__/crmBoardModel.test.ts`
Expected: FAIL, cannot find module `@/lib/crm/boardModel`.

- [ ] **Step 3: Implement `src/lib/crm/boardModel.ts`**

```ts
import { FUNNEL_STATUSES, STATUS_LABEL, isLeadStatus, type LeadStatusValue } from "./leadStatus";

// Pure view model for the /crm pipeline (2026-10-18).

export const STALE_DAYS = 7;

export type BoardFilter = "all" | "mine" | "stale";
export function isBoardFilter(x: unknown): x is BoardFilter {
  return x === "all" || x === "mine" || x === "stale";
}

export type BoardLeadInput = {
  id: string; firstName: string; lastName: string; status: string; source: string;
  languagePreference: string | null; assignedTo: { id: string; name: string } | null;
  projectLabel: string | null; lastContactAt: Date | null; createdAt: Date;
  deals: { price: number; ourCommission: number | null; commissionStatus: string }[];
};

export type BoardCard = {
  id: string; name: string; lang: string | null; project: string | null; sourceLabel: string; isPartner: boolean;
  ownerInitials: string | null; ownerName: string | null; ageLabel: string; stale: boolean;
  dealValue: number | null; dealCommission: number | null; status: LeadStatusValue;
};

export type BoardColumn = { status: LeadStatusValue; label: string; cards: BoardCard[]; total: number };

const SOURCE_LABEL: Record<string, string> = {
  CONTACT_FORM: "Website", PROJECT_ENQUIRY: "Project page", BLOG_ENQUIRY: "Blog", WHATSAPP: "WhatsApp", PHONE: "Phone",
  REFERRAL: "Referral", MANUAL: "Manual", PARTNER: "Partner", ROI_CALCULATOR: "ROI calculator", NEWSLETTER: "Newsletter",
  OTHER: "Other", META_LEAD_AD: "Meta ad", PRIVATE_COLLECTION: "Private Collection",
};

const OPEN_DEAL = new Set(["EXPECTED", "EARNED", "DEVELOPER_PAID", "PAID_OUT"]);

function age(from: Date, now: Date): { label: string; days: number } {
  const ms = Math.max(0, now.getTime() - from.getTime());
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return { label: "now", days: 0 };
  if (h < 24) return { label: `${h}h`, days: 0 };
  const d = Math.floor(h / 24);
  return { label: `${d}d`, days: d };
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export function toCard(lead: BoardLeadInput, now: Date): BoardCard {
  const a = age(lead.lastContactAt ?? lead.createdAt, now);
  const open = lead.deals.filter((d) => OPEN_DEAL.has(d.commissionStatus));
  const status = isLeadStatus(lead.status) ? lead.status : "NEW";
  return {
    id: lead.id,
    name: `${lead.firstName} ${lead.lastName}`.trim(),
    lang: lead.languagePreference ? lead.languagePreference.toUpperCase() : null,
    project: lead.projectLabel,
    sourceLabel: SOURCE_LABEL[lead.source] ?? lead.source,
    isPartner: lead.source === "PARTNER",
    ownerInitials: lead.assignedTo ? initials(lead.assignedTo.name) : null,
    ownerName: lead.assignedTo?.name ?? null,
    ageLabel: a.label,
    stale: a.days >= STALE_DAYS && status !== "CLOSED",
    dealValue: open.length ? open.reduce((s, d) => s + d.price, 0) : null,
    dealCommission: open.some((d) => d.ourCommission != null) ? open.reduce((s, d) => s + (d.ourCommission ?? 0), 0) : null,
    status,
  };
}

export function buildBoard(leads: BoardLeadInput[], now: Date): BoardColumn[] {
  return FUNNEL_STATUSES.map((status) => {
    const cards = leads.filter((l) => l.status === status).map((l) => toCard(l, now));
    return { status, label: STATUS_LABEL[status], cards, total: cards.reduce((s, c) => s + (c.dealValue ?? 0), 0) };
  });
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --import tsx --test src/lib/__tests__/crmBoardModel.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: `src/lib/crm/pipelineQuery.ts`**

```ts
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { leadAccessWhere, type CrmUser } from "./access";
import { EXCLUDE_NEWSLETTER } from "./leadBucket";
import { FUNNEL_STATUSES } from "./leadStatus";
import { STALE_DAYS, type BoardFilter, type BoardLeadInput } from "./boardModel";

const CONTACT_TYPES = ["CALL", "EMAIL_OUT", "EMAIL_IN", "WHATSAPP_OUT", "WHATSAPP_IN"] as const;
const BOARD_CAP = 1500;

export async function loadBoardLeads(user: CrmUser, filter: BoardFilter, now: Date): Promise<BoardLeadInput[]> {
  const and: Prisma.LeadWhereInput[] = [
    leadAccessWhere(user),
    EXCLUDE_NEWSLETTER,
    { deletedAt: null, assignedToId: { not: null }, status: { in: [...FUNNEL_STATUSES] } },
  ];
  if (filter === "mine") and.push({ assignedToId: user.id });
  const rows = await prisma.lead.findMany({
    where: { AND: and },
    orderBy: { updatedAt: "desc" },
    take: BOARD_CAP,
    select: {
      id: true, firstName: true, lastName: true, status: true, source: true, languagePreference: true, createdAt: true,
      assignedTo: { select: { id: true, name: true } },
      projectInterest: { select: { title: true } },
      interactions: { where: { type: { in: [...CONTACT_TYPES] } }, orderBy: { occurredAt: "desc" }, take: 1, select: { occurredAt: true } },
      deals: { select: { price: true, ourCommission: true, commissionStatus: true } },
    },
  });
  const leads: BoardLeadInput[] = rows.map((r) => ({
    id: r.id, firstName: r.firstName, lastName: r.lastName, status: r.status, source: r.source,
    languagePreference: r.languagePreference, assignedTo: r.assignedTo, createdAt: r.createdAt,
    projectLabel: r.projectInterest?.title ?? null,
    lastContactAt: r.interactions[0]?.occurredAt ?? null,
    deals: r.deals,
  }));
  if (filter !== "stale") return leads;
  const cutoff = now.getTime() - STALE_DAYS * 86_400_000;
  return leads.filter((l) => (l.lastContactAt ?? l.createdAt).getTime() < cutoff && l.status !== "CLOSED");
}
```
If the `LeadInteractionType` enum names differ from `CONTACT_TYPES`, copy the list used by `src/lib/mcp/tools/getLead.ts` (`CONTACT_TYPES`) instead and import it from there if it is exported.

- [ ] **Step 6: Read-only page `src/app/crm/pipeline/page.tsx`**

```tsx
import Link from "next/link";
import { requireCrmUser } from "@/lib/crm/session";
import { loadBoardLeads } from "@/lib/crm/pipelineQuery";
import { buildBoard, isBoardFilter, type BoardFilter } from "@/lib/crm/boardModel";
import { Board } from "../components/Board";

export const dynamic = "force-dynamic";

const FILTERS: { key: BoardFilter; label: string }[] = [
  { key: "all", label: "Everyone" }, { key: "mine", label: "Mine" }, { key: "stale", label: "Stale 7d+" },
];

export default async function PipelinePage({ searchParams }: { searchParams: { f?: string } }) {
  const user = await requireCrmUser();
  const filter: BoardFilter = isBoardFilter(searchParams.f) ? searchParams.f : "all";
  const now = new Date();
  const columns = buildBoard(await loadBoardLeads(user, filter, now), now);
  const count = columns.reduce((n, c) => n + c.cards.length, 0);
  return (
    <>
      <div className="crm-headrow">
        <div>
          <h1>Pipeline</h1>
          <p>{count} active {count === 1 ? "lead" : "leads"}</p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <Link key={f.key} href={f.key === "all" ? "/crm/pipeline" : `/crm/pipeline?f=${f.key}`} className={`crm-chip${filter === f.key ? " on" : ""}`}>{f.label}</Link>
          ))}
        </div>
      </div>
      <Board columns={columns} />
    </>
  );
}
```
In this task create `src/app/crm/components/Board.tsx` as a **read-only** client component that renders the columns and cards (markup and CSS below); Task 4 adds interaction to the same file.

```tsx
"use client";
import type { BoardColumn, BoardCard } from "@/lib/crm/boardModel";

const eur = (n: number) => "€" + n.toLocaleString("en-US");

export function CardView({ card }: { card: BoardCard }) {
  return (
    <a className={`crm-card s-${card.status}`} href={`/admin/crm/${card.id}`} data-id={card.id}>
      <div className="c-top"><b>{card.name}</b>{card.lang && <span className="lang">{card.lang}</span>}</div>
      {card.project && <div className="c-proj">{card.project}</div>}
      <div className="c-meta">
        <span className={`src${card.isPartner ? " partner" : ""}`}>{card.sourceLabel}</span>
        <span className={`age${card.stale ? " warn" : ""}`}>{card.ageLabel}</span>
        {card.ownerInitials && <span className="av" title={card.ownerName ?? undefined}>{card.ownerInitials}</span>}
      </div>
      {card.dealValue != null && (
        <div className="c-deal"><span>{eur(card.dealValue)}</span>{card.dealCommission != null && <span className="comm">{card.status === "CLOSED" ? "Earned" : "Exp."} {eur(card.dealCommission)}</span>}</div>
      )}
    </a>
  );
}

export function Board({ columns }: { columns: BoardColumn[] }) {
  return (
    <div className="crm-boardwrap">
      <div className="crm-board">
        {columns.map((col) => (
          <section key={col.status} className={`crm-col s-${col.status}`} aria-label={col.label}>
            <div className="colh"><span className="dot" />{col.label}<span className="cnt">{col.cards.length}</span>{col.total > 0 && <span className="sum">€{Math.round(col.total / 1000)}k</span>}</div>
            {col.cards.map((c) => <CardView key={c.id} card={c} />)}
          </section>
        ))}
      </div>
    </div>
  );
}
```
Append to `src/app/crm/crm.css`:
```css
.crm-boardwrap { overflow-x: auto; padding-bottom: 6px; }
.crm-board { display: grid; grid-template-columns: repeat(7, minmax(220px, 1fr)); gap: 10px; min-width: 1580px; }
.crm-col { background: var(--colbg); border-radius: var(--r); padding: 10px; display: flex; flex-direction: column; gap: 8px; min-height: 420px; transition: box-shadow .2s; }
.crm-col.over { box-shadow: inset 0 0 0 2px var(--sc); }
.crm-col .colh { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 700; padding: 2px 2px 4px; }
.crm-col .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--sc); }
.crm-col .cnt, .crm-col .sum { font-family: var(--mono); font-weight: 500; color: var(--muted); font-variant-numeric: tabular-nums; }
.crm-col .sum { margin-left: auto; font-size: 11px; }
.crm-card { position: relative; display: flex; flex-direction: column; gap: 7px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 11px 11px 11px 14px;
  color: var(--ink); text-decoration: none; font-size: 13px; cursor: grab; transition: transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s; }
.crm-card::before { content: ""; position: absolute; left: 0; top: 10px; bottom: 10px; width: 3px; border-radius: 3px; background: var(--sc); }
.crm-card:hover { transform: translateY(-2px); box-shadow: 0 10px 24px -14px rgba(0,0,0,.35); }
.crm-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.crm-card.drag { transform: rotate(3deg) scale(1.03); box-shadow: 0 22px 40px -18px rgba(0,0,0,.45); opacity: .92; }
.crm-card.pop { animation: crm-pop .55s cubic-bezier(.2,.8,.2,1); }
@keyframes crm-pop { 0% { transform: scale(.85); opacity: 0 } 60% { transform: scale(1.03); opacity: 1 } 100% { transform: none } }
.crm-card .c-top { display: flex; align-items: center; gap: 7px; }
.crm-card .c-top b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.crm-card .lang { font-family: var(--mono); font-size: 10.5px; border: 1px solid var(--line); border-radius: 5px; padding: 0 4px; color: var(--muted); }
.crm-card .c-proj { color: var(--muted); font-size: 12.5px; }
.crm-card .c-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.crm-card .src { font-size: 11px; font-weight: 600; border-radius: 6px; padding: 2px 6px; background: var(--srcbg); color: var(--muted); }
.crm-card .src.partner { background: var(--partnerbg); color: var(--partnerfg); }
.crm-card .age { font-family: var(--mono); font-size: 11px; color: var(--muted); }
.crm-card .age.warn { color: var(--warn); }
.crm-card .av { margin-left: auto; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 9.5px; font-weight: 700; color: #fff; background: var(--accent); }
.crm-card .c-deal { display: flex; justify-content: space-between; gap: 6px; border-top: 1px dashed var(--line); padding-top: 7px; font-family: var(--mono); font-size: 11.5px; font-variant-numeric: tabular-nums; }
.crm-card .c-deal .comm { color: var(--good); }
```

- [ ] **Step 7: Tests, types, lint, commit**

Run: `npm test && npx tsc --noEmit && npm run lint`
```bash
git add src/lib/crm/boardModel.ts src/lib/crm/pipelineQuery.ts src/app/crm/pipeline/page.tsx src/app/crm/components/Board.tsx src/app/crm/crm.css src/lib/__tests__/crmBoardModel.test.ts
git commit -m "CRM v2: pipeline board model and read-only /crm/pipeline"
```

---

### Task 3: Move plan and server-side move (status + deals)

**Files:**
- Create: `src/lib/crm/movePlan.ts`, `src/lib/crm/moveLead.ts`, `src/app/crm/actions.ts`
- Test: `src/lib/__tests__/crmMovePlan.test.ts`

**Interfaces:**
- Consumes: `LeadStatusValue`, `LostReasonValue`, `LOST_REASONS`, `isLeadStatus` (leadStatus.ts); `applyLeadStatusChange` (updateLeadStatus.ts; signature `(actor: EmailActor, leadId, status, opts: { viewingScheduledAt?, via?, lostReason? })`, `EmailActor = { userId: string; userName: string }` — check `src/lib/crm/sendLeadEmail.ts` for the exact type); `canEditLead` (access.ts); `requireCrmUser` (session.ts); `resolveRate`, `computeDealAmounts`, `RateRow` (commission.ts).
- Produces (`movePlan.ts`, pure):
  - `type DealLite = { id: string; commissionStatus: "EXPECTED" | "EARNED" | "DEVELOPER_PAID" | "PAID_OUT" | "CANCELLED" }`
  - `type MovePlan = { kind: "blocked"; reason: string } | { kind: "ok"; needsDeal: boolean; needsLostReason: boolean; cancelDealIds: string[]; earnDealIds: string[] }`
  - `planMove(from: LeadStatusValue, to: LeadStatusValue, deals: DealLite[]): MovePlan`
- Produces (`moveLead.ts`, server): `type DealInput = { developmentId: string; unitLabel: string | null; price: number }`; `moveLead(actor: SessionCrmUser, leadId: string, to: LeadStatusValue, input: { deal?: DealInput; lostReason?: LostReasonValue; confirmCancel?: boolean }): Promise<{ ok: true } | { error: string; need?: "deal" | "lostReason" | "confirmCancel"; cancelCount?: number }>`
- Produces (`actions.ts`, `"use server"`): `moveLeadAction(leadId: string, to: string, input: { deal?: DealInput; lostReason?: string; confirmCancel?: boolean })` → same result type; `searchDevelopmentsAction(q: string): Promise<{ id: string; label: string }[]>`

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/crmMovePlan.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { planMove, type DealLite } from "@/lib/crm/movePlan";

const expected: DealLite = { id: "d1", commissionStatus: "EXPECTED" };
const earned: DealLite = { id: "d2", commissionStatus: "EARNED" };
const paid: DealLite = { id: "d3", commissionStatus: "DEVELOPER_PAID" };
const cancelled: DealLite = { id: "d4", commissionStatus: "CANCELLED" };

test("forward moves inside the early funnel need nothing", () => {
  assert.deepEqual(planMove("NEW", "CONTACTED", []), { kind: "ok", needsDeal: false, needsLostReason: false, cancelDealIds: [], earnDealIds: [] });
});

test("reserving asks for a deal", () => {
  const p = planMove("OFFER", "RESERVED", []);
  assert.equal(p.kind, "ok");
  assert.equal(p.kind === "ok" && p.needsDeal, true);
});

test("reserving again with an open deal does not ask for a second one", () => {
  const p = planMove("RESERVED", "RESERVED", [expected]);
  assert.equal(p.kind === "ok" && p.needsDeal, false);
});

test("selling earns the expected deals, or asks for a deal when there is none", () => {
  const withDeal = planMove("RESERVED", "CLOSED", [expected, cancelled]);
  assert.deepEqual(withDeal, { kind: "ok", needsDeal: false, needsLostReason: false, cancelDealIds: [], earnDealIds: ["d1"] });
  const without = planMove("OFFER", "CLOSED", [cancelled]);
  assert.equal(without.kind === "ok" && without.needsDeal, true);
});

test("losing asks for a reason and cancels open deals", () => {
  const p = planMove("RESERVED", "LOST", [expected, cancelled]);
  assert.deepEqual(p, { kind: "ok", needsDeal: false, needsLostReason: true, cancelDealIds: ["d1"], earnDealIds: [] });
});

test("moving back before Reserved cancels expected and earned deals", () => {
  const p = planMove("CLOSED", "OFFER", [earned]);
  assert.deepEqual(p, { kind: "ok", needsDeal: false, needsLostReason: false, cancelDealIds: ["d2"], earnDealIds: [] });
});

test("keep contact with an open deal also cancels it", () => {
  const p = planMove("RESERVED", "KEEP_CONTACT", [expected]);
  assert.equal(p.kind === "ok" && p.cancelDealIds.length, 1);
});

test("a deal the developer already paid blocks any move away from Sold", () => {
  const p = planMove("CLOSED", "OFFER", [paid]);
  assert.equal(p.kind, "blocked");
  assert.match(p.kind === "blocked" ? p.reason : "", /already paid/);
});

test("Sold back to Reserved keeps an earned deal as it is", () => {
  const p = planMove("CLOSED", "RESERVED", [earned]);
  assert.deepEqual(p, { kind: "ok", needsDeal: false, needsLostReason: false, cancelDealIds: [], earnDealIds: [] });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test src/lib/__tests__/crmMovePlan.test.ts`
Expected: FAIL, cannot find module `@/lib/crm/movePlan`.

- [ ] **Step 3: Implement `src/lib/crm/movePlan.ts`**

```ts
import type { LeadStatusValue } from "./leadStatus";

// What a pipeline move requires and does to the lead's deals (2026-10-18). Pure.
// Reserved creates a deal, Sold earns it, Lost asks for a reason, and leaving
// the Reserved/Sold zone cancels open deals — unless the developer already paid.

export type DealLite = { id: string; commissionStatus: "EXPECTED" | "EARNED" | "DEVELOPER_PAID" | "PAID_OUT" | "CANCELLED" };

export type MovePlan =
  | { kind: "blocked"; reason: string }
  | { kind: "ok"; needsDeal: boolean; needsLostReason: boolean; cancelDealIds: string[]; earnDealIds: string[] };

const DEAL_ZONE: LeadStatusValue[] = ["RESERVED", "CLOSED"];

export function planMove(from: LeadStatusValue, to: LeadStatusValue, deals: DealLite[]): MovePlan {
  const live = deals.filter((d) => d.commissionStatus !== "CANCELLED");
  const settled = live.filter((d) => d.commissionStatus === "DEVELOPER_PAID" || d.commissionStatus === "PAID_OUT");
  const open = live.filter((d) => d.commissionStatus === "EXPECTED" || d.commissionStatus === "EARNED");
  const leavingZone = !DEAL_ZONE.includes(to);

  if (leavingZone && settled.length) {
    return { kind: "blocked", reason: "A deal on this lead was already paid by the developer; it cannot leave Reserved/Sold." };
  }

  const plan = { kind: "ok" as const, needsDeal: false, needsLostReason: to === "LOST", cancelDealIds: [] as string[], earnDealIds: [] as string[] };
  if (leavingZone) {
    plan.cancelDealIds = open.map((d) => d.id);
    return plan;
  }
  if (to === "RESERVED") {
    plan.needsDeal = live.length === 0;
    return plan;
  }
  // to === "CLOSED"
  const toEarn = live.filter((d) => d.commissionStatus === "EXPECTED");
  plan.earnDealIds = toEarn.map((d) => d.id);
  plan.needsDeal = live.length === 0;
  return plan;
}
```
Note `from` is accepted for future rules and readability; it does not change the outcome today. Keep the parameter.

- [ ] **Step 4: Run it to verify it passes**

Run: `node --import tsx --test src/lib/__tests__/crmMovePlan.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: `src/lib/crm/moveLead.ts` (server)**

```ts
import { prisma } from "@/lib/prisma";
import { applyLeadStatusChange } from "./updateLeadStatus";
import { canEditLead } from "./access";
import { planMove, type DealLite } from "./movePlan";
import { resolveRate, computeDealAmounts, type RateRow } from "./commission";
import type { LeadStatusValue, LostReasonValue } from "./leadStatus";
import type { SessionCrmUser } from "./session";

export type DealInput = { developmentId: string; unitLabel: string | null; price: number };
export type MoveResult = { ok: true } | { error: string; need?: "deal" | "lostReason" | "confirmCancel"; cancelCount?: number };

export async function moveLead(
  actor: SessionCrmUser,
  leadId: string,
  to: LeadStatusValue,
  input: { deal?: DealInput; lostReason?: LostReasonValue; confirmCancel?: boolean },
): Promise<MoveResult> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, deletedAt: null },
    select: { id: true, status: true, assignedToId: true, deals: { select: { id: true, commissionStatus: true } } },
  });
  if (!lead || !canEditLead(actor, lead)) return { error: "Lead not found." };

  const plan = planMove(lead.status as LeadStatusValue, to, lead.deals as DealLite[]);
  if (plan.kind === "blocked") return { error: plan.reason };
  if (plan.needsLostReason && !input.lostReason) return { error: "Choose why the lead was lost.", need: "lostReason" };
  if (plan.cancelDealIds.length && !input.confirmCancel) {
    return { error: "This move cancels the open deal(s).", need: "confirmCancel", cancelCount: plan.cancelDealIds.length };
  }
  if (plan.needsDeal) {
    const d = input.deal;
    if (!d) return { error: "Enter the deal: project, unit and price.", need: "deal" };
    if (!Number.isInteger(d.price) || d.price <= 0 || d.price > 100_000_000) return { error: "Enter a valid price in whole euros.", need: "deal" };
  }

  const now = new Date();
  if (plan.needsDeal && input.deal) {
    const dev = await prisma.development.findUnique({ where: { id: input.deal.developmentId }, select: { id: true, developerAccountId: true } });
    if (!dev) return { error: "Project not found.", need: "deal" };
    const rows = await prisma.commissionRate.findMany({ where: { developerAccountId: dev.developerAccountId } });
    const rateRows: RateRow[] = rows.map((r) => ({ developerAccountId: r.developerAccountId, developmentId: r.developmentId, ratePercent: r.ratePercent.toNumber() }));
    const rate = resolveRate(rateRows, dev.developerAccountId, dev.id);
    const amounts = computeDealAmounts({ price: input.deal.price, ourRatePercent: rate.ratePercent, partnerSharePercent: null });
    const earnNow = to === "CLOSED";
    await prisma.deal.create({
      data: {
        leadId, developmentId: dev.id, unitLabel: input.deal.unitLabel?.trim() || null, price: input.deal.price,
        ourRatePercent: rate.ratePercent, rateSource: rate.source, ourCommission: amounts.ourCommission,
        partnerSharePercent: null, partnerCommission: null,
        commissionStatus: earnNow ? "EARNED" : "EXPECTED", earnedAt: earnNow ? now : null, createdById: actor.id,
      },
    });
  }
  if (plan.earnDealIds.length) {
    await prisma.deal.updateMany({ where: { id: { in: plan.earnDealIds }, commissionStatus: "EXPECTED" }, data: { commissionStatus: "EARNED", earnedAt: now } });
  }
  if (plan.cancelDealIds.length) {
    await prisma.deal.updateMany({ where: { id: { in: plan.cancelDealIds } }, data: { commissionStatus: "CANCELLED", cancelledAt: now } });
  }
  if (lead.status !== to) {
    await applyLeadStatusChange({ userId: actor.id, userName: actor.name }, leadId, to, { lostReason: input.lostReason ?? undefined });
  }
  return { ok: true };
}
```
Match the real `EmailActor` field names from `src/lib/crm/sendLeadEmail.ts` (it may also need `email`); pass what it requires from `actor`.

- [ ] **Step 6: `src/app/crm/actions.ts`**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { isLeadStatus, LOST_REASONS, type LostReasonValue } from "@/lib/crm/leadStatus";
import { moveLead, type DealInput, type MoveResult } from "@/lib/crm/moveLead";

export async function moveLeadAction(
  leadId: string,
  to: string,
  input: { deal?: DealInput; lostReason?: string; confirmCancel?: boolean } = {},
): Promise<MoveResult> {
  const user = await requireCrmUser();
  if (!isLeadStatus(to)) return { error: "Unknown stage." };
  const lostReason = input.lostReason && (LOST_REASONS as readonly string[]).includes(input.lostReason) ? (input.lostReason as LostReasonValue) : undefined;
  const res = await moveLead(user, leadId, to, { deal: input.deal, lostReason, confirmCancel: input.confirmCancel === true });
  if ("ok" in res) revalidatePath("/crm/pipeline");
  return res;
}

export async function searchDevelopmentsAction(q: string): Promise<{ id: string; label: string }[]> {
  await requireCrmUser();
  const term = q.trim();
  const rows = await prisma.development.findMany({
    where: { publishStatus: "published", ...(term ? { publicName: { contains: term, mode: "insensitive" } } : {}) },
    orderBy: { publicName: "asc" },
    take: 20,
    select: { id: true, publicName: true, town: true },
  });
  return rows.map((r) => ({ id: r.id, label: r.town ? `${r.publicName} · ${r.town}` : r.publicName }));
}
```

- [ ] **Step 7: Tests, types, lint, commit**

Run: `npm test && npx tsc --noEmit && npm run lint`
```bash
git add src/lib/crm/movePlan.ts src/lib/crm/moveLead.ts src/app/crm/actions.ts src/lib/__tests__/crmMovePlan.test.ts
git commit -m "CRM v2: move plan (deals on Reserved/Sold, reason on Lost) and server move action"
```

---

### Task 4: Interactive board (drag-and-drop, keyboard, move menu, dialogs, toast)

**Files:**
- Modify: `src/app/crm/components/Board.tsx`, `src/app/crm/crm.css`
- Create: `src/app/crm/components/MoveDialog.tsx`, `src/app/crm/components/Toast.tsx`

**Interfaces:**
- Consumes: `BoardColumn`, `BoardCard` (boardModel.ts); `moveLeadAction`, `searchDevelopmentsAction` (crm/actions.ts); `MoveResult`, `DealInput` (moveLead.ts); `LOST_REASONS`, `LOST_REASON_LABEL`, `STATUS_LABEL`, `LeadStatusValue` (leadStatus.ts).
- Produces: `<Board columns={BoardColumn[]} />` (same props as Task 2); `<MoveDialog need … onSubmit onCancel />`; `useToast()` → `{ show(msg: string, kind?: "ok" | "error"): void; node: JSX.Element }`.

Behaviour to implement:
- Drag a card onto a column or onto the two drop targets under the board ("Keep contact", "Lost"). On drop call `moveLeadAction(id, status)`.
- Keyboard: focused card + `ArrowRight`/`ArrowLeft` moves one funnel step; `Enter` opens the lead (`/admin/crm/<id>`).
- Every card has a small "Move" button (visible on hover/focus, always visible on touch widths ≤ 720 px) that opens a menu of all stages including Keep contact and Lost — this is the touch path, since HTML5 drag-and-drop does not work on phones.
- Optimistic: move the card locally at once; on `{ error, need }` open `MoveDialog` for that need and retry with the extra input; on `{ error }` without `need`, put the card back and show an error toast; on `{ ok }` show a success toast (`"Markus Brenner → Reserved"`) and `router.refresh()`.
- Dialog for `need: "deal"`: project search (calls `searchDevelopmentsAction` debounced 250 ms, shows up to 20 results), unit label (optional), price (whole euros, required). Submit retries the move with `deal`.
- Dialog for `need: "lostReason"`: a select of `LOST_REASONS` with `LOST_REASON_LABEL`. Submit retries with `lostReason`.
- Dialog for `need: "confirmCancel"`: text "This cancels {n} open deal(s). The commission becomes Cancelled and stays on record." with buttons "Cancel deal and move" (retries with `confirmCancel: true`) and "Keep as is".
- Dialogs are `<dialog>` elements opened with `showModal()`, close on Escape, return focus to the card.
- The card pops (`.pop`) on its new column after a successful move.

- [ ] **Step 1: `src/app/crm/components/Toast.tsx`**

```tsx
"use client";
import { useCallback, useRef, useState } from "react";

export function useToast() {
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "error" } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, kind: "ok" | "error" = "ok") => {
    setMsg({ text, kind });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2800);
  }, []);
  const node = (
    <div role="status" aria-live="polite" className={`crm-toast${msg ? " show" : ""}${msg?.kind === "error" ? " error" : ""}`}>{msg?.text}</div>
  );
  return { show, node };
}
```

- [ ] **Step 2: `src/app/crm/components/MoveDialog.tsx`**

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { LOST_REASONS, LOST_REASON_LABEL, STATUS_LABEL, type LeadStatusValue } from "@/lib/crm/leadStatus";
import { searchDevelopmentsAction } from "../actions";
import type { DealInput } from "@/lib/crm/moveLead";

export type DialogNeed = { need: "deal" | "lostReason" | "confirmCancel"; leadName: string; to: LeadStatusValue; cancelCount?: number; error?: string };
export type DialogAnswer = { deal?: DealInput; lostReason?: string; confirmCancel?: boolean };

export function MoveDialog({ state, onSubmit, onCancel }: { state: DialogNeed; onSubmit: (a: DialogAnswer) => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<{ id: string; label: string }[]>([]);
  const [devId, setDevId] = useState("");
  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("");
  const [reason, setReason] = useState<string>(LOST_REASONS[0]);

  useEffect(() => { ref.current?.showModal(); }, []);
  useEffect(() => {
    if (state.need !== "deal") return;
    const t = setTimeout(() => { searchDevelopmentsAction(q).then(setOptions).catch(() => setOptions([])); }, 250);
    return () => clearTimeout(t);
  }, [q, state.need]);

  const priceNum = Number(price.replace(/[^\d]/g, ""));
  const dealReady = devId !== "" && Number.isInteger(priceNum) && priceNum > 0;

  return (
    <dialog ref={ref} className="crm-dialog" onCancel={(e) => { e.preventDefault(); onCancel(); }} aria-labelledby="crm-dialog-title">
      <form method="dialog" onSubmit={(e) => {
        e.preventDefault();
        if (state.need === "deal" && dealReady) onSubmit({ deal: { developmentId: devId, unitLabel: unit || null, price: priceNum } });
        if (state.need === "lostReason") onSubmit({ lostReason: reason });
        if (state.need === "confirmCancel") onSubmit({ confirmCancel: true });
      }}>
        <h2 id="crm-dialog-title">{state.leadName} → {STATUS_LABEL[state.to]}</h2>
        {state.error && <p className="crm-dialog-error">{state.error}</p>}

        {state.need === "deal" && (
          <>
            <label htmlFor="crm-dev-q">Project</label>
            <input id="crm-dev-q" value={q} onChange={(e) => { setQ(e.target.value); setDevId(""); }} placeholder="Search published projects" autoComplete="off" />
            <div className="crm-options" role="listbox" aria-label="Projects">
              {options.map((o) => (
                <button type="button" key={o.id} role="option" aria-selected={devId === o.id} className={devId === o.id ? "on" : undefined}
                  onClick={() => { setDevId(o.id); setQ(o.label); }}>{o.label}</button>
              ))}
            </div>
            <label htmlFor="crm-unit">Unit (optional)</label>
            <input id="crm-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. A203" />
            <label htmlFor="crm-price">Price (EUR)</label>
            <input id="crm-price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="412000" />
          </>
        )}

        {state.need === "lostReason" && (
          <>
            <label htmlFor="crm-reason">Why was the lead lost?</label>
            <select id="crm-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
              {LOST_REASONS.map((r) => <option key={r} value={r}>{LOST_REASON_LABEL[r]}</option>)}
            </select>
          </>
        )}

        {state.need === "confirmCancel" && (
          <p>This cancels {state.cancelCount ?? 1} open deal{(state.cancelCount ?? 1) === 1 ? "" : "s"}. The commission becomes Cancelled and stays on record.</p>
        )}

        <div className="crm-dialog-actions">
          <button type="button" className="crm-btn" onClick={onCancel}>{state.need === "confirmCancel" ? "Keep as is" : "Cancel"}</button>
          <button type="submit" className="crm-btn primary" disabled={state.need === "deal" && !dealReady}>
            {state.need === "confirmCancel" ? "Cancel deal and move" : state.need === "deal" ? "Save deal and move" : "Move"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
```

- [ ] **Step 3: Make `Board.tsx` interactive**

Replace the Task 2 `Board` export (keep `CardView`, extend it with drag props and the Move button) with:
```tsx
"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { BoardColumn, BoardCard } from "@/lib/crm/boardModel";
import { FUNNEL_STATUSES, STATUS_LABEL, type LeadStatusValue } from "@/lib/crm/leadStatus";
import { moveLeadAction } from "../actions";
import { MoveDialog, type DialogNeed, type DialogAnswer } from "./MoveDialog";
import { useToast } from "./Toast";

const eur = (n: number) => "€" + n.toLocaleString("en-US");
const MENU_TARGETS: LeadStatusValue[] = [...FUNNEL_STATUSES, "KEEP_CONTACT", "LOST"];

type DragProps = {
  onDragStart: (id: string) => void; onDragEnd: () => void; onKeyMove: (id: string, dir: 1 | -1) => void;
  onMenu: (id: string, to: LeadStatusValue) => void; popId: string | null;
};

export function CardView({ card, drag }: { card: BoardCard; drag?: DragProps }) {
  const [menu, setMenu] = useState(false);
  return (
    <div className={`crm-cardwrap${menu ? " menu-open" : ""}`}>
      <a
        className={`crm-card s-${card.status}${drag?.popId === card.id ? " pop" : ""}`}
        href={`/admin/crm/${card.id}`}
        data-id={card.id}
        draggable={!!drag}
        onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", card.id); e.currentTarget.classList.add("drag"); drag?.onDragStart(card.id); }}
        onDragEnd={(e) => { e.currentTarget.classList.remove("drag"); drag?.onDragEnd(); }}
        onKeyDown={(e) => {
          if (!drag) return;
          if (e.key === "ArrowRight") { e.preventDefault(); drag.onKeyMove(card.id, 1); }
          if (e.key === "ArrowLeft") { e.preventDefault(); drag.onKeyMove(card.id, -1); }
        }}
      >
        <div className="c-top"><b>{card.name}</b>{card.lang && <span className="lang">{card.lang}</span>}</div>
        {card.project && <div className="c-proj">{card.project}</div>}
        <div className="c-meta">
          <span className={`src${card.isPartner ? " partner" : ""}`}>{card.sourceLabel}</span>
          <span className={`age${card.stale ? " warn" : ""}`}>{card.ageLabel}</span>
          {card.ownerInitials && <span className="av" title={card.ownerName ?? undefined}>{card.ownerInitials}</span>}
        </div>
        {card.dealValue != null && (
          <div className="c-deal"><span>{eur(card.dealValue)}</span>{card.dealCommission != null && <span className="comm">{card.status === "CLOSED" ? "Earned" : "Exp."} {eur(card.dealCommission)}</span>}</div>
        )}
      </a>
      {drag && (
        <>
          <button type="button" className="crm-move" aria-haspopup="menu" aria-expanded={menu} aria-label={`Move ${card.name}`} onClick={() => setMenu((m) => !m)}>Move</button>
          {menu && (
            <div className="crm-menu" role="menu">
              {MENU_TARGETS.filter((s) => s !== card.status).map((s) => (
                <button type="button" role="menuitem" key={s} className={`s-${s}`} onClick={() => { setMenu(false); drag.onMenu(card.id, s); }}>
                  <span className="dot" />{STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function Board({ columns: initial }: { columns: BoardColumn[] }) {
  const router = useRouter();
  const toast = useToast();
  const [columns, setColumns] = useState(initial);
  const [dialog, setDialog] = useState<(DialogNeed & { id: string }) | null>(null);
  const [popId, setPopId] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  useEffect(() => setColumns(initial), [initial]);

  const find = (id: string) => columns.flatMap((c) => c.cards).find((c) => c.id === id);

  function moveLocal(id: string, to: LeadStatusValue) {
    setColumns((cols) => {
      const card = cols.flatMap((c) => c.cards).find((c) => c.id === id);
      if (!card) return cols;
      return cols.map((c) => ({
        ...c,
        cards: c.status === to ? [{ ...card, status: to }, ...c.cards.filter((x) => x.id !== id)] : c.cards.filter((x) => x.id !== id),
      }));
    });
  }

  async function attempt(id: string, to: LeadStatusValue, answer: DialogAnswer = {}) {
    const card = find(id);
    if (!card) return;
    const before = columns;
    moveLocal(id, to);
    const res = await moveLeadAction(id, to, answer);
    if ("ok" in res) {
      setDialog(null);
      setPopId(id);
      toast.show(`${card.name} → ${STATUS_LABEL[to]}`);
      router.refresh();
      return;
    }
    setColumns(before);
    if (res.need) setDialog({ id, need: res.need, leadName: card.name, to, cancelCount: res.cancelCount, error: answer.deal || answer.lostReason ? res.error : undefined });
    else { setDialog(null); toast.show(res.error, "error"); }
  }

  const drag: DragProps = {
    onDragStart: (id) => { dragId.current = id; },
    onDragEnd: () => { dragId.current = null; },
    onKeyMove: (id, dir) => {
      const card = find(id);
      if (!card) return;
      const i = FUNNEL_STATUSES.indexOf(card.status as (typeof FUNNEL_STATUSES)[number]);
      const next = FUNNEL_STATUSES[i + dir];
      if (i >= 0 && next) void attempt(id, next);
    },
    onMenu: (id, to) => void attempt(id, to),
    popId,
  };

  const dropProps = (to: LeadStatusValue) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.currentTarget.classList.add("over"); },
    onDragLeave: (e: React.DragEvent) => e.currentTarget.classList.remove("over"),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault(); e.currentTarget.classList.remove("over");
      const id = dragId.current ?? e.dataTransfer.getData("text/plain");
      const card = id ? find(id) : undefined;
      if (card && card.status !== to) void attempt(card.id, to);
    },
  });

  return (
    <>
      <div className="crm-boardwrap">
        <div className="crm-board">
          {columns.map((col) => (
            <section key={col.status} className={`crm-col s-${col.status}`} aria-label={col.label} {...dropProps(col.status)}>
              <div className="colh"><span className="dot" />{col.label}<span className="cnt">{col.cards.length}</span>{col.total > 0 && <span className="sum">€{Math.round(col.total / 1000)}k</span>}</div>
              {col.cards.map((c) => <CardView key={c.id} card={c} drag={drag} />)}
            </section>
          ))}
        </div>
      </div>
      <div className="crm-droprow">
        <div className="crm-drop s-KEEP_CONTACT" {...dropProps("KEEP_CONTACT")}><span className="dot" />Keep contact</div>
        <div className="crm-drop s-LOST" {...dropProps("LOST")}><span className="dot" />Lost</div>
      </div>
      {dialog && (
        <MoveDialog
          state={dialog}
          onCancel={() => setDialog(null)}
          onSubmit={(a) => void attempt(dialog.id, dialog.to, { ...a, ...(dialog.need === "confirmCancel" ? { confirmCancel: true } : {}) })}
        />
      )}
      {toast.node}
    </>
  );
}
```
Note: the second round after a dialog can itself return another `need` (e.g. Lost needs a reason AND a cancel confirmation). `attempt` handles that by opening the next dialog; carry earlier answers forward by merging them: keep the last `DialogAnswer` in a ref and spread it into the next call. Implement this with `const answers = useRef<DialogAnswer>({})`, reset when a new move starts (menu/drag/keyboard), merged on each dialog submit.

- [ ] **Step 4: Append styles to `src/app/crm/crm.css`**

```css
.crm-cardwrap { position: relative; }
.crm-move { position: absolute; top: 8px; right: 8px; opacity: 0; border: 1px solid var(--line); background: var(--panel); color: var(--muted);
  font: 600 11px var(--body); border-radius: 7px; padding: 2px 7px; cursor: pointer; transition: opacity .15s; }
.crm-cardwrap:hover .crm-move, .crm-cardwrap:focus-within .crm-move, .crm-cardwrap.menu-open .crm-move { opacity: 1; }
.crm-menu { position: absolute; top: 34px; right: 8px; z-index: 15; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 6px;
  box-shadow: 0 18px 40px -18px rgba(0,0,0,.35); display: flex; flex-direction: column; min-width: 180px; }
.crm-menu button { display: flex; align-items: center; gap: 8px; border: 0; background: none; text-align: left; padding: 8px 10px; border-radius: 8px; font: 600 13px var(--body); color: var(--ink); cursor: pointer; }
.crm-menu button:hover, .crm-menu button:focus-visible { background: var(--bg); }
.crm-menu .dot, .crm-drop .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--sc); }
.crm-droprow { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.crm-drop { display: flex; align-items: center; justify-content: center; gap: 8px; border: 1.5px dashed var(--line); border-radius: var(--r); padding: 16px; color: var(--muted); font-weight: 700; font-size: 13px; transition: border-color .2s, background .2s; }
.crm-drop.over { border-color: var(--sc); background: var(--panel); color: var(--ink); }
.crm-dialog { border: 1px solid var(--line); border-radius: 18px; padding: 0; width: min(440px, calc(100vw - 32px)); color: var(--ink); background: var(--panel); }
.crm-dialog::backdrop { background: rgba(16, 48, 43, .35); backdrop-filter: blur(2px); }
.crm-dialog form { display: flex; flex-direction: column; gap: 8px; padding: 20px; font-family: var(--body); }
.crm-dialog h2 { margin: 0 0 6px; font-family: var(--display); font-size: 20px; letter-spacing: -.02em; }
.crm-dialog label { font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; margin-top: 6px; }
.crm-dialog input, .crm-dialog select { border: 1px solid var(--line); border-radius: 10px; padding: 9px 11px; font: 500 14px var(--body); color: var(--ink); background: var(--panel); }
.crm-dialog input:focus-visible, .crm-dialog select:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.crm-options { display: flex; flex-direction: column; max-height: 180px; overflow: auto; gap: 2px; }
.crm-options button { text-align: left; border: 0; background: none; padding: 7px 9px; border-radius: 8px; font: 500 13px var(--body); color: var(--ink); cursor: pointer; }
.crm-options button.on, .crm-options button:hover { background: var(--sugbg); }
.crm-dialog-error { margin: 0; color: var(--danger); font-size: 13px; font-weight: 600; }
.crm-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
@media (max-width: 720px) { .crm-move { opacity: 1; } }
```

- [ ] **Step 5: Types, lint, tests, commit**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all green. There is no unit test for this client component; behaviour is covered by the pure move plan (Task 3) and the controller's preview check in Task 6.
```bash
git add src/app/crm/components/Board.tsx src/app/crm/components/MoveDialog.tsx src/app/crm/components/Toast.tsx src/app/crm/crm.css
git commit -m "CRM v2: drag-and-drop pipeline with keyboard, touch menu and deal/lost/cancel dialogs"
```

---

### Task 5: Inbox with owner suggestion, assignment and notifications

**Files:**
- Create: `src/lib/crm/suggestOwner.ts`, `src/lib/crm/assignLead.ts`, `src/app/crm/inbox/page.tsx`, `src/app/crm/components/InboxList.tsx`
- Modify: `src/lib/sendEmail.ts` (optional `to`), `src/app/crm/actions.ts` (add `assignLeadAction`), `src/app/crm/crm.css`
- Test: `src/lib/__tests__/crmSuggestOwner.test.ts`

**Interfaces:**
- Consumes: `canAssignLeads` (access.ts); `requireCrmUser`, `SessionCrmUser` (session.ts); `ACTIVE_LEAD_STATUSES` (leadStatus.ts); `sendTelegramMessage(text, opts?)` (src/lib/telegram.ts); `sendEmail({subject, text, html?, replyTo?, to?})`; `EXCLUDE_NEWSLETTER` (leadBucket.ts).
- Produces (`suggestOwner.ts`, pure):
  - `type Candidate = { id: string; name: string; acceptsLeads: boolean; isActive: boolean; languages: string[]; specialties: string[]; activeLeads: number }`
  - `type Suggestion = { userId: string; name: string; reason: string; languageMatch: boolean } | null`
  - `suggestOwner(lead: { language: string | null; specialtyKeys: string[] }, candidates: Candidate[]): Suggestion`
- Produces (`assignLead.ts`, server): `assignLead(actor: SessionCrmUser, leadId: string, userId: string): Promise<{ ok: true } | { error: string }>`
- Produces (`actions.ts`): `assignLeadAction(leadId: string, userId: string)` → same result.

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/crmSuggestOwner.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestOwner, type Candidate } from "@/lib/crm/suggestOwner";

const c = (o: Partial<Candidate> & { id: string }): Candidate => ({
  name: o.id, acceptsLeads: true, isActive: true, languages: [], specialties: [], activeLeads: 0, ...o,
});

test("language match wins, then fewest active leads", () => {
  const s = suggestOwner({ language: "ru", specialtyKeys: [] }, [
    c({ id: "anna", languages: ["de"], activeLeads: 1 }),
    c({ id: "dmitri", languages: ["ru", "en"], activeLeads: 9 }),
    c({ id: "olga", languages: ["ru"], activeLeads: 12 }),
  ]);
  assert.equal(s?.userId, "dmitri");
  assert.equal(s?.reason, "speaks RU · 9 active");
  assert.equal(s?.languageMatch, true);
});

test("a specialty match breaks a tie between speakers of the language", () => {
  const s = suggestOwner({ language: "de", specialtyKeys: ["paphos"] }, [
    c({ id: "a", languages: ["de"], activeLeads: 3 }),
    c({ id: "b", languages: ["de"], specialties: ["Paphos"], activeLeads: 8 }),
  ]);
  assert.equal(s?.userId, "b");
  assert.equal(s?.reason, "speaks DE · Paphos · 8 active");
});

test("no language match falls back to the least loaded and says so", () => {
  const s = suggestOwner({ language: "pl", specialtyKeys: [] }, [
    c({ id: "a", languages: ["de"], activeLeads: 5 }),
    c({ id: "b", languages: ["ru"], activeLeads: 2 }),
  ]);
  assert.equal(s?.userId, "b");
  assert.equal(s?.languageMatch, false);
  assert.equal(s?.reason, "no PL speaker · 2 active");
});

test("people on holiday or deactivated are never suggested", () => {
  const s = suggestOwner({ language: "de", specialtyKeys: [] }, [
    c({ id: "away", languages: ["de"], acceptsLeads: false }),
    c({ id: "gone", languages: ["de"], isActive: false }),
    c({ id: "here", languages: ["en"], activeLeads: 4 }),
  ]);
  assert.equal(s?.userId, "here");
});

test("nobody available means no suggestion", () => {
  assert.equal(suggestOwner({ language: null, specialtyKeys: [] }, [c({ id: "x", acceptsLeads: false })]), null);
});

test("a lead without a language is matched on load only", () => {
  const s = suggestOwner({ language: null, specialtyKeys: [] }, [c({ id: "a", activeLeads: 3 }), c({ id: "b", activeLeads: 1 })]);
  assert.equal(s?.userId, "b");
  assert.equal(s?.reason, "1 active");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test src/lib/__tests__/crmSuggestOwner.test.ts`
Expected: FAIL, cannot find module `@/lib/crm/suggestOwner`.

- [ ] **Step 3: Implement `src/lib/crm/suggestOwner.ts`**

```ts
// Who should take a new lead (2026-10-18). Pure. Order: accepts leads and is
// active → speaks the lead's language → shares a specialty → fewest active
// leads. The reason string is shown to the operator next to the suggestion.

export type Candidate = { id: string; name: string; acceptsLeads: boolean; isActive: boolean; languages: string[]; specialties: string[]; activeLeads: number };
export type Suggestion = { userId: string; name: string; reason: string; languageMatch: boolean } | null;

const norm = (s: string) => s.trim().toLowerCase();

export function suggestOwner(lead: { language: string | null; specialtyKeys: string[] }, candidates: Candidate[]): Suggestion {
  const pool = candidates.filter((c) => c.isActive && c.acceptsLeads);
  if (!pool.length) return null;
  const lang = lead.language ? norm(lead.language) : null;
  const keys = new Set(lead.specialtyKeys.map(norm));
  const speakers = lang ? pool.filter((c) => c.languages.some((l) => norm(l) === lang)) : [];
  const languageMatch = speakers.length > 0;
  const shortlist = languageMatch ? speakers : pool;
  const specialtyOf = (c: Candidate) => c.specialties.find((s) => keys.has(norm(s))) ?? null;
  const ranked = [...shortlist].sort((a, b) => {
    const sa = specialtyOf(a) ? 0 : 1, sb = specialtyOf(b) ? 0 : 1;
    return sa - sb || a.activeLeads - b.activeLeads || a.name.localeCompare(b.name);
  });
  const best = ranked[0];
  const parts: string[] = [];
  if (lang) parts.push(languageMatch ? `speaks ${lang.toUpperCase()}` : `no ${lang.toUpperCase()} speaker`);
  const spec = specialtyOf(best);
  if (spec) parts.push(spec);
  parts.push(`${best.activeLeads} active`);
  return { userId: best.id, name: best.name, reason: parts.join(" · "), languageMatch };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --import tsx --test src/lib/__tests__/crmSuggestOwner.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: `sendEmail` gets an optional `to`**

In `src/lib/sendEmail.ts` add `to?: string` to the parameter object and type, and use `to: to || process.env.EMAIL_TO || process.env.EMAIL_USER!`. No other change. Existing callers are unaffected.

- [ ] **Step 6: `src/lib/crm/assignLead.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { sendEmail } from "@/lib/sendEmail";
import { canAssignLeads } from "./access";
import type { SessionCrmUser } from "./session";

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

export async function assignLead(actor: SessionCrmUser, leadId: string, userId: string): Promise<{ ok: true } | { error: string }> {
  if (!canAssignLeads(actor)) return { error: "Only admins can assign leads." };
  const [lead, owner] = await Promise.all([
    prisma.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true, firstName: true, lastName: true, assignedToId: true, source: true } }),
    prisma.user.findFirst({ where: { id: userId, isActive: true }, select: { id: true, name: true, email: true } }),
  ]);
  if (!lead) return { error: "Lead not found." };
  if (!owner) return { error: "That employee is not active." };
  if (lead.assignedToId === owner.id) return { ok: true };

  await prisma.lead.update({ where: { id: leadId }, data: { assignedToId: owner.id } });
  await prisma.leadInteraction.create({
    data: {
      leadId, type: "SYSTEM", channel: "SYSTEM",
      body: `Assigned to ${owner.name}`,
      metadata: { assignedToId: owner.id, assignedById: actor.id, via: "crm-v2" },
      createdByUserId: actor.id, createdByName: actor.name,
    },
  });

  const leadName = `${lead.firstName} ${lead.lastName}`.trim();
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://cyprusvipestates.com"}/admin/crm/${lead.id}`;
  // Notifications must never undo the assignment: failures are logged, not thrown.
  await Promise.allSettled([
    sendTelegramMessage(`👤 <b>${esc(owner.name)}</b> takes <b>${esc(leadName)}</b> (assigned by ${esc(actor.name)})\n${url}`),
    sendEmail({ to: owner.email, subject: `New lead for you: ${leadName}`, text: `${actor.name} assigned ${leadName} to you.\n\nOpen the lead: ${url}` }),
  ]).then((rs) => rs.forEach((r) => { if (r.status === "rejected") console.error("[crm assign notify]", r.reason); }));
  return { ok: true };
}
```
Check the real public base-URL env name used elsewhere for absolute links in notifications (grep `NEXT_PUBLIC_SITE_URL\|SITE_URL` in `src/lib/leadNotify.ts` / `src/lib/metaLeadgen/notify.ts`) and use the same one.

- [ ] **Step 7: Add the action to `src/app/crm/actions.ts`**

```ts
import { assignLead } from "@/lib/crm/assignLead";

export async function assignLeadAction(leadId: string, userId: string): Promise<{ ok: true } | { error: string }> {
  const user = await requireCrmUser();
  const res = await assignLead(user, leadId, userId);
  if ("ok" in res) { revalidatePath("/crm/inbox"); revalidatePath("/crm/pipeline"); }
  return res;
}
```

- [ ] **Step 8: `src/app/crm/inbox/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { ACTIVE_LEAD_STATUSES } from "@/lib/crm/leadStatus";
import { suggestOwner, type Candidate } from "@/lib/crm/suggestOwner";
import { InboxList, type InboxItem } from "../components/InboxList";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = { PARTNER: "Partner", META_LEAD_AD: "Meta ad", CONTACT_FORM: "Website", PROJECT_ENQUIRY: "Project page", WHATSAPP: "WhatsApp" };

export default async function InboxPage() {
  const user = await requireCrmUser();
  if (!canAssignLeads(user)) redirect("/crm/pipeline");

  const [leads, staff, loads] = await Promise.all([
    prisma.lead.findMany({
      where: { deletedAt: null, assignedToId: null, ...EXCLUDE_NEWSLETTER },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: { id: true, firstName: true, lastName: true, createdAt: true, source: true, languagePreference: true, budgetMax: true, projectInterest: { select: { id: true, title: true, city: true } } },
    }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, isActive: true, acceptsLeads: true, languages: true, specialties: true } }),
    prisma.lead.groupBy({ by: ["assignedToId"], where: { deletedAt: null, assignedToId: { not: null }, status: { in: [...ACTIVE_LEAD_STATUSES] } }, _count: { _all: true } }),
  ]);

  const loadOf = new Map(loads.map((l) => [l.assignedToId, l._count._all]));
  const candidates: Candidate[] = staff.map((s) => ({ ...s, activeLeads: loadOf.get(s.id) ?? 0 }));
  const items: InboxItem[] = leads.map((l) => {
    const keys = [l.projectInterest?.id, l.projectInterest?.city].filter((x): x is string => !!x);
    const s = suggestOwner({ language: l.languagePreference, specialtyKeys: keys }, candidates);
    return {
      id: l.id, name: `${l.firstName} ${l.lastName}`.trim(), lang: l.languagePreference?.toUpperCase() ?? null,
      source: SOURCE_LABEL[l.source] ?? l.source, isPartner: l.source === "PARTNER",
      interest: l.projectInterest?.title ?? null, createdAt: l.createdAt.toISOString(),
      suggestion: s ? { userId: s.userId, name: s.name, reason: s.reason } : null,
    };
  });

  return (
    <>
      <div className="crm-headrow">
        <div>
          <h1>Inbox</h1>
          <p>{items.length === 0 ? "Every lead has an owner." : `${items.length} unassigned, oldest first`}</p>
        </div>
      </div>
      <InboxList items={items} staff={staff.map((s) => ({ id: s.id, name: s.name, acceptsLeads: s.acceptsLeads }))} />
    </>
  );
}
```
`Project.city` and `Project.title` exist on the legacy `Project` model (Lead.projectInterest); confirm field names in `prisma/schema.prisma` model Project and adjust if `city` is named differently.

- [ ] **Step 9: `src/app/crm/components/InboxList.tsx`**

```tsx
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { assignLeadAction } from "../actions";
import { useToast } from "./Toast";

export type InboxItem = {
  id: string; name: string; lang: string | null; source: string; isPartner: boolean; interest: string | null; createdAt: string;
  suggestion: { userId: string; name: string; reason: string } | null;
};

function waited(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`;
}

export function InboxList({ items, staff }: { items: InboxItem[]; staff: { id: string; name: string; acceptsLeads: boolean }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [leaving, setLeaving] = useState<string | null>(null);
  const [choice, setChoice] = useState<Record<string, string>>({});

  async function assign(item: InboxItem, userId: string) {
    const who = staff.find((s) => s.id === userId)?.name ?? "them";
    setLeaving(item.id);
    const res = await assignLeadAction(item.id, userId);
    if ("ok" in res) { toast.show(`Assigned to ${who}. Notified on Telegram and email.`); router.refresh(); }
    else { setLeaving(null); toast.show(res.error, "error"); }
  }

  if (!items.length) return <div className="crm-panel crm-empty">Inbox zero. New leads land here first.</div>;
  return (
    <>
      <div className="crm-inbox">
        {items.map((it) => {
          const pick = choice[it.id] ?? it.suggestion?.userId ?? "";
          return (
            <article key={it.id} className={`crm-ib${leaving === it.id ? " leaving" : ""}`}>
              <div className="t"><a href={`/admin/crm/${it.id}`}>{it.name}</a>{it.lang && <span className="lang">{it.lang}</span>}<span className="wait">{waited(it.createdAt)}</span></div>
              <div className="s"><span className={`src${it.isPartner ? " partner" : ""}`}>{it.source}</span>{it.interest && <> · {it.interest}</>}</div>
              <div className="sug">
                {it.suggestion ? <span><b>{it.suggestion.name}</b> <span className="why">{it.suggestion.reason}</span></span> : <span className="why">Nobody is taking leads right now</span>}
                <label className="sr-only" htmlFor={`own-${it.id}`}>Owner</label>
                <select id={`own-${it.id}`} value={pick} onChange={(e) => setChoice((c) => ({ ...c, [it.id]: e.target.value }))}>
                  <option value="" disabled>Choose…</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.name}{s.acceptsLeads ? "" : " (away)"}</option>)}
                </select>
                <button type="button" className="crm-btn primary" disabled={!pick || leaving === it.id} onClick={() => void assign(it, pick)}>Assign</button>
              </div>
            </article>
          );
        })}
      </div>
      {toast.node}
    </>
  );
}
```
Append to `src/app/crm/crm.css`:
```css
.crm-inbox { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
.crm-ib { background: var(--panel); border: 1px solid var(--line); border-radius: var(--r); padding: 14px; display: flex; flex-direction: column; gap: 8px; transition: transform .45s cubic-bezier(.2,.8,.2,1), opacity .35s; }
.crm-ib.leaving { transform: translateX(40px) scale(.96); opacity: 0; }
.crm-ib .t { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14.5px; }
.crm-ib .t a { color: var(--ink); text-decoration: none; }
.crm-ib .t .wait { margin-left: auto; font-family: var(--mono); font-size: 11.5px; color: var(--muted); font-weight: 500; }
.crm-ib .lang { font-family: var(--mono); font-size: 10.5px; border: 1px solid var(--line); border-radius: 5px; padding: 0 4px; color: var(--muted); }
.crm-ib .s { font-size: 12.5px; color: var(--muted); }
.crm-ib .src { font-size: 11px; font-weight: 600; border-radius: 6px; padding: 2px 6px; background: var(--srcbg); color: var(--muted); }
.crm-ib .src.partner { background: var(--partnerbg); color: var(--partnerfg); }
.crm-ib .sug { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; background: var(--sugbg); border-radius: 10px; padding: 8px; font-size: 12.5px; }
.crm-ib .sug .why { color: var(--muted); }
.crm-ib .sug select { margin-left: auto; border: 1px solid var(--line); border-radius: 8px; padding: 6px 8px; font: 500 12.5px var(--body); background: var(--panel); color: var(--ink); }
.crm-empty { text-align: center; color: var(--muted); padding: 32px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
```

- [ ] **Step 10: Tests, types, lint, commit**

Run: `npm test && npx tsc --noEmit && npm run lint`
```bash
git add src/lib/crm/suggestOwner.ts src/lib/crm/assignLead.ts src/lib/sendEmail.ts src/app/crm/actions.ts src/app/crm/inbox/page.tsx src/app/crm/components/InboxList.tsx src/app/crm/crm.css src/lib/__tests__/crmSuggestOwner.test.ts
git commit -m "CRM v2: inbox with explained owner suggestion, assignment and Telegram/email notice"
```

---

### Task 6: Phase 2a wrap-up

- [ ] **Step 1: Full verification**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all green; report the test count.

- [ ] **Step 2: Read-only preview (controller)**

The dev server reads the LIVE production DB. The controller (not a subagent) starts it, opens `/crm/pipeline` and `/crm/inbox`, checks layout, fonts, console errors, phone width (375 px) and keyboard focus — **without** dragging cards, assigning leads or submitting any dialog (those write to production). Screenshot both pages for the operator.

- [ ] **Step 3: Independent review and hand-over**

Final whole-branch review of the 2a range. Push the branch. Report: what is live under `/crm` after a deploy, that no migration is needed, and the open 2b items (new cockpit, rates screen, rights screen, old-CRM gate for restricted employees).
