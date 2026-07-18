// The shape of one entry in AdvisorRun.suggestions (JSON column) — see the
// Prisma model comment in prisma/schema.prisma for why this lives as JSON
// on the run rather than a normalized table.
export type SuggestionStatus = "open" | "approved" | "dismissed";

export type StoredSuggestion = {
  id: string;
  fingerprint: string;
  title: string;
  rationale: string;
  action: string;
  impact_estimate: "low" | "med" | "high";
  effort: "clicks" | "small" | "session";
  category: string;
  status: SuggestionStatus;
  dismissedAt?: string;
  dismissalReason?: string;
  preparedPrompt?: string;
  // Free-text findings recorded after implementation — a follow-up lever
  // identified during the work but deliberately not executed (e.g. a
  // bigger architectural item filed for its own future session).
  implementationNotes?: string;
};
