"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { buildPreparedPrompt } from "@/lib/seoAdvisor/deliver";
import type { StoredSuggestion } from "@/lib/seoAdvisor/types";

async function updateSuggestion(runId: string, suggestionId: string, patch: Partial<StoredSuggestion>) {
  const run = await prisma.advisorRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error("Run not found");
  const suggestions = (run.suggestions as unknown as StoredSuggestion[]) ?? [];
  const next = suggestions.map((s) => (s.id === suggestionId ? { ...s, ...patch } : s));
  await prisma.advisorRun.update({ where: { id: runId }, data: { suggestions: next as any } });
  revalidatePath("/admin/analytics/seo/advisor");
  revalidatePath("/admin");
}

export async function dismissSuggestion(runId: string, suggestionId: string, reason?: string) {
  await updateSuggestion(runId, suggestionId, {
    status: "dismissed",
    dismissedAt: new Date().toISOString(),
    ...(reason ? { dismissalReason: reason } : {}),
  });
}

export async function approveSuggestion(runId: string, suggestionId: string) {
  const run = await prisma.advisorRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error("Run not found");
  const suggestions = (run.suggestions as unknown as StoredSuggestion[]) ?? [];
  const found = suggestions.find((s) => s.id === suggestionId);
  if (!found) throw new Error("Suggestion not found");
  const preparedPrompt = buildPreparedPrompt(found);
  await updateSuggestion(runId, suggestionId, { status: "approved", preparedPrompt, approvedAt: new Date().toISOString() });
}

// Approving/dismissing through the plain buttons above never asks for a
// note — the only way one landed here before was a Claude Code session
// running a one-off DB script. This lets anyone (agent or admin) attach one
// afterwards through the UI itself, on any closed suggestion, so a note
// never depends on someone remembering to script it in.
export async function setImplementationNote(runId: string, suggestionId: string, note: string) {
  await updateSuggestion(runId, suggestionId, { implementationNotes: note });
}
