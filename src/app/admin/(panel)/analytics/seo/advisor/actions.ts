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

export async function dismissSuggestion(runId: string, suggestionId: string) {
  await updateSuggestion(runId, suggestionId, { status: "dismissed", dismissedAt: new Date().toISOString() });
}

export async function approveSuggestion(runId: string, suggestionId: string) {
  const run = await prisma.advisorRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error("Run not found");
  const suggestions = (run.suggestions as unknown as StoredSuggestion[]) ?? [];
  const found = suggestions.find((s) => s.id === suggestionId);
  if (!found) throw new Error("Suggestion not found");
  const preparedPrompt = buildPreparedPrompt(found);
  await updateSuggestion(runId, suggestionId, { status: "approved", preparedPrompt });
}
