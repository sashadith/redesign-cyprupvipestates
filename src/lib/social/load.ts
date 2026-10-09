// Social monitoring — the network half: fetch the draft lists from Typefully
// (read-only client, 5-minute memo) and hand them to the pure functions in
// socialMonitor.ts. Neither function throws: the client turns every failure
// into a result, and the pure functions turn that into an explicit item/line.
import type { ActionItem } from "@/lib/actionCenter/types";
import { typefully } from "./typefully";
import { socialActionItems, socialDigestLines } from "./socialMonitor";
import { CYPRUS_TZ } from "@/lib/booking/timezone";

export async function loadSocialActionItems(now = new Date()): Promise<ActionItem[]> {
  const [planned, errored] = await Promise.all([typefully.listDrafts("planned"), typefully.listDrafts("error")]);
  return socialActionItems({ planned, errored }, now);
}

export async function loadSocialDigestLines(now = new Date()): Promise<string[]> {
  const isMonday = new Intl.DateTimeFormat("en-US", { timeZone: CYPRUS_TZ, weekday: "short" }).format(now) === "Mon";
  const [scheduled, planned, errored] = await Promise.all([
    typefully.listDrafts("scheduled"), typefully.listDrafts("planned"), typefully.listDrafts("error"),
  ]);
  // The "no drafts this week" check counts every status that can be dated
  // Monday–Friday of this week (a Monday 08:00 post may already be published
  // when the digest runs at 08:00). Mondays only.
  const rest = isMonday
    ? await Promise.all([typefully.listDrafts("draft"), typefully.listDrafts("published"), typefully.listDrafts("publishing")])
    : undefined;
  return socialDigestLines({ scheduled, planned, errored, rest }, now);
}
