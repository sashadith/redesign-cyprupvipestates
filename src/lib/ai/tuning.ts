export type Tuning = { emphasize?: string; avoid?: string };

/** Editor-supplied positive/negative steering, appended to an AI prompt so the
    same Claude button can be nudged ("emphasize sea views", "avoid clichés"). */
export function tuningBlock(t?: Tuning): string {
  const lines: string[] = [];
  if (t?.emphasize?.trim()) lines.push(`- Emphasize / focus on: ${t.emphasize.trim()}`);
  if (t?.avoid?.trim()) lines.push(`- Avoid / do NOT do: ${t.avoid.trim()}`);
  return lines.length
    ? `\n\nAdditional instructions from the editor — follow these closely:\n${lines.join("\n")}`
    : "";
}
