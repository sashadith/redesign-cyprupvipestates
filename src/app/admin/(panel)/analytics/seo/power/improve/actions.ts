"use server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { AI_MODEL } from "@/lib/ai/anthropic";
import { gatherImprovementInput } from "@/lib/ai/pageImprover/gather";
import { generateProposal } from "@/lib/ai/pageImprover/generate";
import { isSeoTable, readTargetSeo, writeTargetSeo } from "@/lib/ai/pageImprover/target";
import { APPLY_ENABLED, type CurrentSeo, type ImprovementProposal } from "@/lib/ai/pageImprover/types";

async function requireActiveUser(): Promise<string> {
  const session = await auth();
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !uid) throw new Error("Unauthorized");
  // Re-validate against the DB so a deactivated/deleted user can't keep acting
  // for the remainder of their JWT lifetime (audit M3 — same as actions.ts).
  //
  // NOT named requireAdmin, deliberately: admin/actions.ts already owns that
  // name for a STRICTER helper that also demands role === "ADMIN". This one
  // must not, and the difference is load-bearing — the panel layout gates only
  // Users and settings on `isAdmin`, so every active panel user can already see
  // the Page Power row this action belongs to. A role check here would hide
  // Improve from the people the screen is for. Same body as requireSession()
  // there; the name says which of the two it is.
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { isActive: true } });
  if (!user || !user.isActive) throw new Error("Unauthorized");
  return uid;
}

const IMPROVE_PATH = "/admin/analytics/seo/power/improve";

export async function generateImprovementAction(pageKey: string): Promise<{ error?: string }> {
  await requireActiveUser();
  try {
    const input = await gatherImprovementInput(pageKey);
    if (input.page.kind === "development")
      return { error: "Developments have their own generator — use the override editor." };
    const proposal = await generateProposal(input);
    const source = input.page.source;
    // One draft per page: a regenerate REPLACES the standing draft rather than
    // stacking a second one — two open drafts for one page is a merge conflict
    // waiting for a tired click. Applied/dismissed rows stay; they are history.
    await prisma.$transaction([
      prisma.pageImprovement.deleteMany({ where: { pageKey, status: "draft" } }),
      prisma.pageImprovement.create({
        data: {
          pageKey,
          kind: input.page.kind,
          targetTable: source && isSeoTable(source.table) ? source.table : "",
          targetId: source && isSeoTable(source.table) ? source.id : "",
          status: "draft",
          diagnosis: input.verdict?.diagnosis ?? "unknown",
          reason: input.verdict?.reason ?? "",
          proposal: proposal as object,
          currentSeo: (input.currentSeo ?? { metaTitle: "", metaDescription: "" }) as object,
          model: AI_MODEL,
        },
      }),
    ]);
    revalidatePath(IMPROVE_PATH);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function applyImprovementAction(id: string): Promise<{ error?: string }> {
  const uid = await requireActiveUser();
  // Enforced HERE, not only in the UI: a disabled button is a courtesy, a
  // refusing action is the gate. Flipped by the calibration commit (types.ts).
  if (!APPLY_ENABLED) return { error: "Apply is behind the calibration gate — generate and judge five real pages first (see types.ts)." };
  try {
    const row = await prisma.pageImprovement.findUnique({ where: { id } });
    if (!row || row.status !== "draft") return { error: "No open draft with that id." };
    if (!row.targetTable || !isSeoTable(row.targetTable)) return { error: "This page kind has no apply path — copy the proposal into the code or editor by hand." };

    // Staleness guard, same posture as the stale-copy fix script's exactly-once
    // occurrence check: if the row's seo changed since this draft was generated,
    // refuse rather than overwrite someone's manual edit.
    //
    // What it guarantees, precisely: it refuses a STALE draft. It is not
    // race-proof. This read and writeTargetSeo's own read-then-merge are two
    // round trips with no transaction between them, so a hand save landing in
    // that window is still lost. Milliseconds wide, one admin, and the loss is
    // one recoverable edit — accepted rather than hidden. Making it airtight
    // means a conditional update (`updateMany where seo = snapshot`), which is
    // a change to target.ts and its own decision.
    const current = await readTargetSeo(row.targetTable, row.targetId);
    const snapshot = row.currentSeo as CurrentSeo;
    if (!current) return { error: "Target row no longer exists." };
    if (current.metaTitle !== snapshot.metaTitle || current.metaDescription !== snapshot.metaDescription)
      return { error: "The page's SEO fields changed after this draft was generated — regenerate to get a draft based on the current state." };

    const proposal = row.proposal as ImprovementProposal;
    await writeTargetSeo(row.targetTable, row.targetId, { metaTitle: proposal.metaTitle, metaDescription: proposal.metaDescription });
    await prisma.pageImprovement.update({ where: { id }, data: { status: "applied", appliedAt: new Date(), appliedBy: uid } });
    revalidatePath(IMPROVE_PATH);
    revalidatePath("/admin/analytics/seo/power");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function dismissImprovementAction(id: string): Promise<{ error?: string }> {
  await requireActiveUser();
  // Wrapped like its siblings: all three declare Promise<{ error?: string }>, so
  // a caller reasonably reads a rejection as impossible. Without this, a DB
  // failure here surfaces as an opaque server-action error while generate and
  // apply return a readable message for the same class of fault.
  try {
    const row = await prisma.pageImprovement.findUnique({ where: { id }, select: { status: true } });
    if (!row || row.status !== "draft") return { error: "No open draft with that id." };
    await prisma.pageImprovement.update({ where: { id }, data: { status: "dismissed" } });
    revalidatePath(IMPROVE_PATH);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
