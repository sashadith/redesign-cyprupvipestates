/**
 * Write a development's feed units WITHOUT changing their identity.
 *
 * A unit's primary key is `@default(uuid())`, so delete-then-insert hands every
 * consumer a brand-new identifier set. That is not a theoretical cost: the
 * Xellex bridge delivers `id: u.id` (src/lib/bridge/payload.ts), and on
 * 2026-10-24 Xellex reported Cybarco units arriving new every day. Measured the
 * same day in production: all 442 Cybarco units, across 10 PUBLISHED
 * developments, carried `createdAt` = that day — a single distinct day for a
 * developer live since September. The churn also made the bridge's
 * `changedSince` cursor useless, because `updatedAt` jumped for all 442 rows
 * nightly and every incremental fetch re-delivered the developer in full.
 *
 * This is not a new idea in this repo — it is the strategy two of the three
 * sync pipelines already used for published developments
 * (feedSync's syncFeedUnitsPreservingUnlisted, plusPropertiesSync). Cybarco was
 * the only one wiping unconditionally. It lives here, with an injected client,
 * because nothing pinned id stability anywhere: that absence is why the churn
 * went unnoticed for as long as it did.
 *
 * `ref` is the anchor, and it is the right one: it is what cybarcoSync's own
 * keepByRef already matches manual field values on, what
 * ClientPresentationItem.unitRefs pins, and its stability across runs is
 * evidenced by manually corrected unit types surviving Cybarco syncs.
 */

/** A built unit row, as each sync composes it. Only `ref` is read here. */
export type FeedUnitRow = Record<string, unknown> & { ref?: string | null };

type StoredUnit = { id: string; ref: string | null; status: string | null; label: string | null; name: string | null };

/**
 * The slice of Prisma this needs. Narrow on purpose: a client that can also
 * delete would invite the very thing this exists to prevent, and it keeps the
 * strategy testable against an in-memory double.
 */
export type FeedUnitWriteClient = {
  developmentUnit: {
    findMany(args: {
      where: { developmentId: string; source: string };
      select: { id: true; ref: true; status: true; label: true; name: true };
    }): Promise<StoredUnit[]>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
};

export type FeedUnitWriteResult = {
  /** Rows matched by ref and updated in place — their ids did not move. */
  updated: number;
  /** Refs that had no stored row, so they are genuinely new to the site. */
  created: { ref: string; label: string }[];
  /** Stored refs the feed stopped listing, switched to "unlisted". */
  unlisted: { ref: string; label: string }[];
};

export async function writeFeedUnitsPreservingIds(
  db: FeedUnitWriteClient,
  developmentId: string,
  rows: FeedUnitRow[],
): Promise<FeedUnitWriteResult> {
  const existing = await db.developmentUnit.findMany({
    where: { developmentId, source: "feed" },
    select: { id: true, ref: true, status: true, label: true, name: true },
  });
  const byRef = new Map<string, StoredUnit>();
  for (const u of existing) if (u.ref) byRef.set(u.ref, u);

  const freshRefs = new Set<string>();
  for (const r of rows) if (r.ref) freshRefs.add(String(r.ref));

  let updated = 0;
  const created: { ref: string; label: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    // The feed's order is the display order, and it is applied on BOTH paths:
    // an updated row whose neighbours moved would otherwise keep a stale
    // position, which is how a preserving write quietly reorders a page.
    const data = { ...r, sortIndex: i };
    const match = r.ref ? byRef.get(String(r.ref)) : undefined;
    if (match) {
      await db.developmentUnit.update({ where: { id: match.id }, data });
      updated++;
    } else {
      // Includes a unit with no ref: it cannot be matched, but dropping it
      // would lose a row the feed is actively listing. It gets a new id every
      // run, which is the price of having no stable key — and the reason refs
      // matter.
      await db.developmentUnit.create({ data: { ...data, developmentId } });
      const ref = r.ref ? String(r.ref) : "";
      created.push({ ref, label: String(r.label ?? r.name ?? ref) });
    }
  }

  const unlisted: { ref: string; label: string }[] = [];
  for (const old of existing) {
    // No stable key means no safe decision — unlisting a row we cannot match
    // would quietly remove units that predate refs.
    if (!old.ref || freshRefs.has(old.ref)) continue;
    // "sold" is a hard statement and must not be softened by a feed that
    // merely stopped listing the row; "unlisted" is already done, and
    // re-reporting it would make the nightly digest name it forever.
    if (old.status === "sold" || old.status === "unlisted") continue;
    await db.developmentUnit.update({ where: { id: old.id }, data: { status: "unlisted" } });
    unlisted.push({ ref: old.ref, label: old.label || old.name || old.ref });
  }

  return { updated, created, unlisted };
}
