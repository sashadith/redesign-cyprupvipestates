import { fmtDate, untrusted } from "@/lib/mcp/format";

export type RawMessage = {
  body?: string | null;
  type?: string | null;
  timestamp?: number | null;
  fromMe?: boolean | null;
  metadata?: { media?: { mimetype?: string; sizeBytes?: number } | null } | null;
};

export type ShapedMessage = {
  direction: "IN" | "OUT";
  at: ReturnType<typeof fmtDate>;
  type: string;
  text: string | ReturnType<typeof untrusted> | null;
  media: { type: string; mimetype: string | null; sizeBytes: number | null } | null;
};

// A body-less `unknown` row is a gateway protocol artefact, not a message.
// One of them, stamped at session-connect time, nearly became a lead's
// "last contact" during the 2026-09-13 reconciliation.
function isRealMessage(m: RawMessage): boolean {
  if (typeof m.timestamp !== "number") return false;
  const hasBody = !!m.body?.trim();
  return hasBody || (m.type ?? "unknown") !== "unknown";
}

export function shapeThread(raw: RawMessage[]): ShapedMessage[] {
  return raw
    .filter(isRealMessage)
    .sort((a, b) => (a.timestamp as number) - (b.timestamp as number))
    .map((m) => {
      const body = m.body?.trim() || null;
      const media = m.metadata?.media;
      const fromMe = !!m.fromMe;
      return {
        direction: fromMe ? ("OUT" as const) : ("IN" as const),
        at: fmtDate(new Date((m.timestamp as number) * 1000)),
        type: m.type ?? "text",
        // Their words are data, ours are not — same rule as every CRM tool.
        text: body === null ? null : fromMe ? body : untrusted(body),
        media: media ? { type: m.type ?? "media", mimetype: media.mimetype ?? null, sizeBytes: media.sizeBytes ?? null } : null,
      };
    });
}
