// "Already sent" history per development, so the picker can warn before the
// same project goes to the same lead twice.
import type { PresentationListRow } from "./rows";

/** The part of a list row the history needs, so the client can call it on its own row views. */
export type SentHistoryRow = Pick<PresentationListRow, "id" | "createdAt"> & {
  items: Pick<PresentationListRow["items"][number], "developmentId" | "views" | "isFavorited">[];
};

export type SentInfo = { lastSentAt: Date; views: number; favorited: boolean; times: number };

/** Keyed by developmentId. Revoked and expired selections still count; `excludeId` skips the one being edited. */
export function sentHistory(rows: SentHistoryRow[], excludeId?: string): Record<string, SentInfo> {
  const out: Record<string, SentInfo> = {};
  for (const r of rows) {
    if (r.id === excludeId) continue;
    for (const it of r.items) {
      const cur = out[it.developmentId];
      if (!cur) {
        out[it.developmentId] = { lastSentAt: r.createdAt, views: it.views, favorited: it.isFavorited, times: 1 };
        continue;
      }
      if (r.createdAt.getTime() > cur.lastSentAt.getTime()) cur.lastSentAt = r.createdAt;
      cur.views += it.views;
      cur.favorited = cur.favorited || it.isFavorited;
      cur.times += 1;
    }
  }
  return out;
}

const dayMonth = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Nicosia", day: "2-digit", month: "2-digit" });

/** "sent 12.10. · 3 views · ♥", or "sent 2× · last 12.10. · …" when sent more than once. */
export function sentLabel(s: SentInfo): string {
  const date = dayMonth.format(s.lastSentAt).replace("/", ".") + ".";
  const parts = [s.times > 1 ? `sent ${s.times}× · last ${date}` : `sent ${date}`];
  if (s.views > 0) parts.push(`${s.views} view${s.views === 1 ? "" : "s"}`);
  if (s.favorited) parts.push("♥");
  return parts.join(" · ");
}
