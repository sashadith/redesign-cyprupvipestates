import "@/app/fonts/vendored.css";
import "./cockpit.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { frauncesFontDisplay, mulishFontBody } from "@/app/fonts";
import { computeAvailability } from "@/lib/developmentAvailability";
import { resolveDevelopmentPrice } from "@/lib/developmentCard";
import { toTitleCaseName } from "@/lib/textCase";
import { COUNTRY_NAME_BY_CODE, countryCodeToFlagEmoji } from "@/lib/countries";
import { REAL_CONTACT_TYPES } from "@/lib/actionCenter/rules/crm";
import { adminDateTime } from "@/lib/adminTime";
import BackLink from "../../BackLink";
import PriceGauge from "./PriceGauge";
import Gallery from "./Gallery";
import { matchesSavedSearch, type SavedSearch } from "@/lib/crm/savedSearchMatch";

export const dynamic = "force-dynamic";

/* Project Cockpit — one development, read-only. Nothing on this page writes.
   Every number comes from a shared helper rather than a stored column:
   availability from computeAvailability (Development.unitsAvailable is a cached
   column that has been wrong before — see the Celestia badge incident), price
   from resolveDevelopmentPrice, "last contact" from REAL_CONTACT_TYPES. */

const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
const eur = (n: number) => "€" + n.toLocaleString("en-GB");

/** Pipeline columns, in the order a deal moves through them. KEEP_CONTACT sits
 *  with the early statuses in the collapsed group: it is deliberately parallel
 *  to the funnel, not a stage inside it (see the LeadStatus enum). LOST is not
 *  shown at all — a lost lead is not interest in this project any more. */
const COLUMNS = [
  { key: "COMMUNICATING", label: "Communicating" },
  { key: "VIEWING_SCHEDULED", label: "Viewing scheduled" },
  { key: "OFFER", label: "Offer" },
  { key: "CLOSED", label: "Closed" },
] as const;
const EARLY = ["NEW", "CONTACTED", "KEEP_CONTACT"] as const;

type LeadCard = {
  id: string; name: string; status: string;
  country: string | null; budgetMax: number | null;
  hot: boolean; lastContact: Date | null;
};

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

const channelMark = (channel: string | null, type: string): string => {
  if (channel === "WHATSAPP" || type.startsWith("WHATSAPP")) return "WA";
  if (channel === "PHONE" || type === "CALL") return "Tel";
  if (channel === "EMAIL" || type.startsWith("EMAIL")) return "@";
  return "·";
};

const firstLine = (s: string | null | undefined, fallback: string): string => {
  const line = (s || "").split("\n").map((x) => x.trim()).find(Boolean);
  return line ? (line.length > 90 ? line.slice(0, 89) + "…" : line) : fallback;
};

export default async function CockpitPage({ params }: { params: { id: string } }) {
  const d = await prisma.development.findUnique({
    where: { id: params.id },
    // The override is SELECTED, not included: this page reads six of its
    // columns and `include` would fetch every one. That is not only wider than
    // needed — it couples a read-only overview to every column the override
    // table happens to grow, and a database a migration behind the code then
    // fails the whole page over a column nobody here reads. Caught exactly
    // that way on the testbed, whose restored backup predated extraLinks.
    include: {
      units: true,
      override: { select: { alias: true, district: true, area: true, town: true, mainImage: true, gallery: true } },
    },
  });
  if (!d) notFound();

  const ov = d.override;
  const name = toTitleCaseName(ov?.alias || d.publicName);
  const district = ov?.district || d.district || null;
  const area = ov?.area || d.area || null;

  // ---------------------------------------------------------------- units
  const avail = computeAvailability(d.units);
  const reserved = d.units.filter((u) => u.status === "reserved").length;
  const sold = d.units.filter((u) => u.status === "sold").length;
  const other = Math.max(avail.total - avail.available - reserved - sold, 0);

  // ---------------------------------------------------------------- price
  const { priceFrom, priceTo } = resolveDevelopmentPrice(d.priceFrom, d.priceTo, d.units);
  const availablePrices = d.units
    .filter((u) => u.status === "available" && typeof u.price === "number" && u.price > 0)
    .map((u) => u.price as number);
  const anyPrices = d.units
    .filter((u) => typeof u.price === "number" && u.price > 0)
    .map((u) => u.price as number);
  // resolveDevelopmentPrice falls back to any-status units when no AVAILABLE
  // unit carries a price. That fallback is right — a sold-out page must still
  // show what it sold for — but it must never masquerade as live asking
  // prices, so the card says which pool it is drawing from.
  const pricePool = availablePrices.length ? availablePrices : anyPrices;
  const soldPricesOnly = !availablePrices.length && anyPrices.length > 0;
  const hasGauge = pricePool.length > 0 && priceFrom != null && priceTo != null;

  // ---------------------------------------------------------------- media
  const gallery = arr(ov?.gallery).length ? arr(ov?.gallery) : arr(d.gallery);
  const hero = ov?.mainImage || null;
  const photos = hero ? [hero, ...gallery.filter((u) => u !== hero)] : gallery;
  const shots = [
    ...photos.map((url) => ({ url, kind: "photo" as const })),
    ...arr(d.plans).map((url) => ({ url, kind: "plan" as const })),
  ];

  // ------------------------------------------------- leads: presentations
  const items = await prisma.clientPresentationItem.findMany({
    where: { developmentId: d.id },
    select: {
      presentation: {
        select: {
          lead: {
            select: {
              id: true, firstName: true, lastName: true, status: true, hotAt: true,
              budgetMax: true, countryOfResidence: true, nationality: true, deletedAt: true,
            },
          },
        },
      },
    },
  });

  const shownLeads = new Map<string, LeadCard>();
  for (const it of items) {
    const l = it.presentation?.lead;
    if (!l || l.deletedAt) continue;
    shownLeads.set(l.id, {
      id: l.id,
      name: `${l.firstName} ${l.lastName}`.trim(),
      status: l.status,
      country: l.countryOfResidence || l.nationality || null,
      budgetMax: l.budgetMax,
      hot: !!l.hotAt,
      lastContact: null,
    });
  }

  // ------------------------------------------------- leads: saved searches
  // A second, weaker source, kept in its own column so it is never read as
  // "this lead was shown the project". See src/lib/crm/savedSearchMatch.ts.
  const candidates = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      status: { in: ["NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "KEEP_CONTACT"] },
      id: { notIn: Array.from(shownLeads.keys()) },
    },
    select: {
      id: true, firstName: true, lastName: true, status: true, hotAt: true,
      budgetMin: true, budgetMax: true, countryOfResidence: true, nationality: true,
      propertyTypeInterest: true, lastMatchFilters: true,
    },
  });

  const devFacts = {
    district, town: ov?.town || d.town || null, area,
    units: d.units.map((u) => ({ status: u.status, beds: u.beds, type: u.type, price: u.price })),
  };
  const searchLeads: LeadCard[] = candidates
    .filter((l) => matchesSavedSearch(devFacts, l.lastMatchFilters as SavedSearch | null, l))
    .map((l) => ({
      id: l.id,
      name: `${l.firstName} ${l.lastName}`.trim(),
      status: l.status,
      country: l.countryOfResidence || l.nationality || null,
      budgetMax: l.budgetMax,
      hot: !!l.hotAt,
      lastContact: null,
    }));

  // ------------------------------------------------- last contact + feed
  const allIds = [...Array.from(shownLeads.keys()), ...searchLeads.map((l) => l.id)];
  const contacts = allIds.length
    ? await prisma.leadInteraction.findMany({
        where: { leadId: { in: allIds }, type: { in: [...REAL_CONTACT_TYPES] } },
        orderBy: { occurredAt: "desc" },
        select: { leadId: true, occurredAt: true },
      })
    : [];
  const lastByLead = new Map<string, Date>();
  for (const c of contacts) if (!lastByLead.has(c.leadId)) lastByLead.set(c.leadId, c.occurredAt);
  Array.from(shownLeads.values()).forEach((l) => { l.lastContact = lastByLead.get(l.id) ?? null; });
  for (const l of searchLeads) l.lastContact = lastByLead.get(l.id) ?? null;

  const feed = allIds.length
    ? await prisma.leadInteraction.findMany({
        where: { leadId: { in: allIds } },
        orderBy: { occurredAt: "desc" },
        take: 10,
        select: {
          id: true, leadId: true, type: true, direction: true, channel: true,
          subject: true, body: true, occurredAt: true,
        },
      })
    : [];
  const nameById = new Map<string, string>();
  Array.from(shownLeads.values()).forEach((l) => nameById.set(l.id, l.name));
  for (const l of searchLeads) nameById.set(l.id, l.name);

  const presented = Array.from(shownLeads.values());
  const early = presented.filter((l) => (EARLY as readonly string[]).includes(l.status));
  const publicHref = d.slug ? `/projects/${d.slug}` : null;

  const since = (dt: Date | null): string => {
    if (!dt) return "no contact yet";
    const days = Math.floor((Date.now() - dt.getTime()) / 86_400_000);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    return `${days} days ago`;
  };

  const LeadCardLink = ({ l }: { l: LeadCard }) => (
    <Link href={`/admin/crm/${l.id}`} className="ck__lead">
      <span className="ck__leadTop">
        <span className="ck__flag" title={l.country ? COUNTRY_NAME_BY_CODE[l.country] ?? l.country : undefined}>
          {l.country ? countryCodeToFlagEmoji(l.country) : "·"}
        </span>
        <span className="ck__leadName">{l.name}</span>
        {l.hot ? <span className="ck__flame" title="Marked hot">🔥</span> : null}
      </span>
      <span className="ck__leadMeta">
        <span>{l.budgetMax != null ? `up to ${eur(l.budgetMax)}` : "no budget set"}</span>
        <span>{since(l.lastContact)}</span>
      </span>
    </Link>
  );

  return (
    <div className={`ck ${frauncesFontDisplay.variable} ${mulishFontBody.variable}`}>
      <BackLink label="← Back to project" />

      <header className="ck__head">
        <div style={{ minWidth: 0 }}>
          <h1 className="ck__h ck__title">{name}</h1>
          <p className="ck__sub">
            {[d.developer, [area, district].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || "No location set"}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 11 }}>
            <span className={`ck__chip ${avail.soldOut ? "ck__chip--out" : "ck__chip--ok"}`}>
              {avail.soldOut ? "Sold out" : `${avail.available} available`}
            </span>
            <span className="ck__chip ck__chip--line">{avail.total} units</span>
            {d.stage ? <span className="ck__chip ck__chip--line">{d.stage}</span> : null}
          </div>
        </div>
        <div className="ck__headActions">
          {publicHref ? (
            <a className="ck__pill ck__pill--ghost" href={publicHref} target="_blank" rel="noopener noreferrer">Open public page ↗</a>
          ) : null}
          <Link className="ck__pill ck__pill--dark" href={`/admin/developments/${d.id}`}>Edit</Link>
        </div>
      </header>

      <div className="ck__grid">
        <div className="ck__main">
          <div className="ck__row2">
            {/* ------------------------------------------------ price */}
            <section className="ck__card">
              <p className="ck__eyebrow">Price</p>
              {hasGauge ? (
                <>
                  <PriceGauge
                    min={Math.min(...pricePool)}
                    max={Math.max(...pricePool)}
                    median={median(pricePool)}
                    format={{ prefix: "€", thousands: "en-GB" }}
                  />
                  <p className="ck__note">
                    {soldPricesOnly
                      ? "No available unit carries a price, so this is the range of SOLD and reserved units — past prices, not current asking prices."
                      : "Range across available units. Prices are quoted + VAT."}
                  </p>
                </>
              ) : (
                <p className="ck__note">No unit carries a price, so there is nothing to plot.</p>
              )}
            </section>

            {/* ----------------------------------------- availability */}
            <section className="ck__card">
              <p className="ck__eyebrow">Availability</p>
              <div className="ck__bar" role="img"
                aria-label={`${avail.available} available, ${reserved} reserved, ${sold} sold of ${avail.total}`}>
                {avail.total > 0 ? (
                  <>
                    <span className="ck__barSeg ck__barSeg--avail" style={{ width: `${(avail.available / avail.total) * 100}%` }} />
                    <span className="ck__barSeg ck__barSeg--res" style={{ width: `${(reserved / avail.total) * 100}%` }} />
                    <span className="ck__barSeg ck__barSeg--sold" style={{ width: `${(sold / avail.total) * 100}%` }} />
                  </>
                ) : null}
              </div>
              <div className="ck__legend">
                <span className="ck__legendItem">
                  <b className="ck__legendNum">{avail.available}</b>
                  <span><i className="ck__legendDot" style={{ background: "var(--champagne, #C29A5E)" }} />Available</span>
                </span>
                <span className="ck__legendItem">
                  <b className="ck__legendNum">{reserved}</b>
                  <span><i className="ck__legendDot" style={{ background: "rgba(194,154,94,0.42)" }} />Reserved</span>
                </span>
                <span className="ck__legendItem">
                  <b className="ck__legendNum">{sold}</b>
                  <span><i className="ck__legendDot" style={{ background: "rgba(34,28,21,0.26)" }} />Sold</span>
                </span>
              </div>
              {other > 0 ? (
                <p className="ck__note">{other} {other === 1 ? "unit carries" : "units carry"} another status and sit outside these three.</p>
              ) : null}
              {priceFrom != null && priceTo != null ? (
                <p className="ck__note">Advertised range {eur(priceFrom)} – {eur(priceTo)}.</p>
              ) : null}
            </section>
          </div>

          {/* --------------------------------------------- gallery */}
          <section className="ck__card">
            <p className="ck__eyebrow">Photos and floor plans</p>
            <Gallery shots={shots} />
          </section>

        </div>

        {/* ------------------------------------------------ sidebar */}
        <aside className="ck__side">
          <section className="ck__card">
            <p className="ck__eyebrow">Latest activity</p>
            {feed.length ? (
              <div className="ck__feed">
                {feed.map((a) => (
                  <div className="ck__act" key={a.id}>
                    <span className="ck__actIcon">{channelMark(a.channel, a.type)}</span>
                    <div className="ck__actBody">
                      <div className="ck__actHead">
                        {a.direction ? <i className={`ck__dir ck__dir--${a.direction === "INBOUND" ? "in" : "out"}`} /> : null}
                        <span className="ck__actWho">{nameById.get(a.leadId) ?? "Lead"}</span>
                        <span className="ck__actWhen">{adminDateTime(a.occurredAt)}</span>
                      </div>
                      <p className="ck__actLine">{firstLine(a.subject || a.body, a.type.replace(/_/g, " ").toLowerCase())}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="ck__empty">No interactions recorded for these leads.</p>
            )}
          </section>
        </aside>
      </div>

        {/* -------------------------------------------- pipeline */}
        <section className="ck__card">
          <p className="ck__eyebrow">Interested leads</p>
          <div className="ck__cols">
            {COLUMNS.map((c) => {
              const inCol = presented.filter((l) => l.status === c.key);
              return (
                <div className="ck__col" key={c.key}>
                  <div className="ck__colHead"><span>{c.label}</span><span className="ck__colCount">{inCol.length}</span></div>
                  {inCol.length ? inCol.map((l) => <LeadCardLink key={l.id} l={l} />) : <p className="ck__empty">None</p>}
                </div>
              );
            })}
          </div>

          {early.length ? (
            <details style={{ marginTop: 14 }}>
              <summary className="ck__colHead" style={{ cursor: "pointer" }}>
                <span>Earlier stages</span><span className="ck__colCount">{early.length}</span>
              </summary>
              <div style={{ marginTop: 10 }}>{early.map((l) => <LeadCardLink key={l.id} l={l} />)}</div>
            </details>
          ) : null}

          {!presented.length ? (
            <p className="ck__empty" style={{ marginTop: 10 }}>No client has been shown this project yet.</p>
          ) : null}
        </section>

        {/* ---------------------------------------- saved searches */}
        <section className="ck__card">
          <p className="ck__eyebrow">Matches a saved search</p>
          <p className="ck__note" style={{ margin: "0 0 12px" }}>
            Leads whose last saved search covers this project. They have not been shown it.
          </p>
          {searchLeads.length ? (
            <div className="ck__cols">
              {searchLeads.slice(0, 12).map((l) => <LeadCardLink key={l.id} l={l} />)}
            </div>
          ) : (
            <p className="ck__empty">No saved search covers this project.</p>
          )}
          {searchLeads.length > 12 ? (
            <p className="ck__note">{searchLeads.length - 12} more not shown.</p>
          ) : null}
        </section>
    </div>
  );
}
