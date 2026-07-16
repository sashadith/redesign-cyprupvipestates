// Personal, token-protected property presentation page generated from a CRM
// lead + curated Development matches (see the "Property Matching" section on
// /admin/crm/[id] and prisma/schema.prisma's ClientPresentation models). No
// locale prefix — the presentation's own `locale` field drives everything.
// Always noindex (meta + X-Robots-Tag, see next.config.mjs headers()).
// <html>/<body> + font/CSS imports live in ./layout.tsx (this route sits
// outside [lang] so it needs its own, like preview-home/preview-projects do).
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getDbProjectsByIds } from "@/lib/developmentRender";
import { normalizeRef } from "@/lib/unitRef";
import type { MatchFilters } from "@/lib/crm/matching";
import { asPLocale, COPY, timeOfDayGreeting } from "./copy";
import HeroGreeting from "./HeroGreeting";
import PresentationBody, { type PresentationDevelopmentVM } from "./PresentationBody";
import ClosingSection from "./ClosingSection";
import ViewTracker from "./ViewTracker";

export const dynamic = "force-dynamic";

// No per-token content in the metadata — never leak a client's name or
// selection into a link preview, browser history entry, or shared screenshot.
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Your Property Selection - Cyprus VIP Estates",
    description: "A personal property selection.",
    robots: { index: false, follow: false },
  };
}

// Large (2560px-capped) hero background photos, one per district — processed
// through the same pipeline as api/admin/upload/route.ts (auto-orient, JPEG
// q82 mozjpeg, content-hashed filename) but sized for a full-bleed hero rather
// than the homepage's small 800x600 city-tile thumbnails (Cities.tsx).
const DISTRICT_HERO_IMAGES: Record<string, string> = {
  paphos: "/uploads/images/61b30f9ea861f57b62622d20ab25a95dedad5c63-2560x1441.jpg",
  limassol: "/uploads/images/7002ff319a170a66ef37739e608e14a0e3b0a9c1-2560x1441.jpg",
  larnaca: "/uploads/images/986aea3f8ad4e98e9b5962fe5b48841707229c5a-2560x1441.jpg",
};

const CYPRUS_TZ = "Asia/Nicosia";
function cyprusHour(): number {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: CYPRUS_TZ }).format(new Date()));
}

function NotAvailable({ locale }: { locale: ReturnType<typeof asPLocale> }) {
  const c = COPY[locale];
  return (
    <main className="cp-gone">
      <img src="/uploads/images/862e62ebddfc232ff9838efb63eb28685b515eb4-400x208.png" alt="Cyprus VIP Estates" className="cp-gone__logo" />
      <h1>{c.notAvailableTitle}</h1>
      <p>{c.notAvailableBody}</p>
      <a href="https://cyprusvipestates.com" className="cp-gone__btn">{c.contactUs}</a>
    </main>
  );
}

export default async function ClientPresentationPage({ params }: { params: { token: string } }) {
  const presentation = await prisma.clientPresentation.findUnique({
    where: { token: params.token },
    // Least-data principle: no Lead PII (name/email/phone) — greetingName and
    // personalNote already live on the presentation row itself. `timeline`
    // isn't PII; it's reflected back as a "your preferences" chip. Budget/
    // property-type/location/bedroom chips come from `criteria` (this row's
    // own snapshot of the matching-panel filters), not from Lead fields —
    // see the criteria comment on the schema for why.
    include: {
      items: { orderBy: { sortIndex: "asc" } },
      advisor: { select: { name: true, avatar: true, photoPng: true, email: true, phone: true } },
      lead: { select: { timeline: true } },
    },
  });

  const isExpired = !!presentation?.expiresAt && presentation.expiresAt < new Date();
  // Lazily flip an overdue "active" row to "expired" so the status column stays
  // accurate for the admin list without needing a separate cron sweep.
  if (presentation && presentation.status === "active" && isExpired) {
    await prisma.clientPresentation.update({ where: { id: presentation.id }, data: { status: "expired" } }).catch(() => {});
  }

  const usable = presentation && presentation.status === "active" && !isExpired;
  if (!presentation || !usable) {
    return <NotAvailable locale={asPLocale(presentation?.locale)} />;
  }

  const locale = asPLocale(presentation.locale);
  const c = COPY[locale];

  const devMap = await getDbProjectsByIds(presentation.items.map((i) => i.developmentId), locale);
  const items: PresentationDevelopmentVM[] = presentation.items
    .map((it): PresentationDevelopmentVM | null => {
      const vm = devMap[it.developmentId];
      if (!vm) return null;
      const unitRefs = Array.isArray(it.unitRefs) ? (it.unitRefs as string[]) : null;
      // DEPRECATED, no longer written to except as a fallback for units with no
      // ref at all (manual units) — see PART 1 / src/lib/unitRef.ts. Feed-sourced
      // unit UUIDs get orphaned by re-syncs, which is why unitRefs exists.
      const unitIds = Array.isArray(it.unitIds) ? (it.unitIds as string[]) : null;
      const allUnits = vm.units.map((u) => ({
        id: u.id ?? "", ref: u.ref, label: u.label, type: u.type, beds: u.beds,
        areaBuilt: u.areaBuilt, price: u.price, currency: u.currency, status: u.status,
      }));
      let units: typeof allUnits;
      if (unitRefs && unitRefs.length) {
        const matched = allUnits.filter((u) =>
          u.ref && u.ref.trim() ? unitRefs.includes(normalizeRef(u.ref, vm.publicName)) : !!unitIds?.includes(u.id)
        );
        // None of the selected refs still exist (units removed from the feed) —
        // fall back to the whole project rather than showing an empty selection.
        units = matched.length ? matched : allUnits.filter((u) => u.status === "available");
      } else if (unitIds && unitIds.length) {
        // Legacy item that predates unitRefs entirely.
        units = allUnits.filter((u) => unitIds.includes(u.id));
      } else {
        units = allUnits.filter((u) => u.status === "available");
      }
      const availableCount = vm.units.filter((u) => u.status === "available").length;
      return {
        developmentId: it.developmentId,
        // Presentation-item alias wins over the development's own override.alias
        // (already baked into vm.publicName by developmentRender.ts) — lets an
        // admin rename a property just for this one client without touching the
        // development record itself.
        publicName: it.aliasName || vm.publicName,
        town: vm.town || null,
        district: vm.district || null,
        area: vm.area || null,
        vatApplies: vm.vatApplies ?? null,
        priceFrom: vm.priceFrom ?? null,
        currency: vm.currency || "EUR",
        unitsAvailable: availableCount,
        unitsTotal: vm.units.length,
        mainImage: vm.gallery[0] ?? null,
        advisorComment: it.advisorComment,
        isFavorited: it.isFavorited,
        isNew: it.isNew,
        lat: vm.center?.lat ?? null,
        lng: vm.center?.lng ?? null,
        description: vm.description,
        amenities: vm.amenities ?? [],
        gallery: vm.gallery,
        units,
        distances: vm.distances ?? null,
      };
    })
    .filter((x): x is PresentationDevelopmentVM => x !== null);

  const greetingWord = timeOfDayGreeting(locale, cyprusHour());

  // Hero background: the homepage's photo for whichever district most of the
  // selected properties are in (simple majority vote by count of items).
  const districtCounts = new Map<string, number>();
  for (const it of items) { if (it.district) districtCounts.set(it.district, (districtCounts.get(it.district) ?? 0) + 1); }
  let topDistrict: string | null = null;
  let topCount = 0;
  districtCounts.forEach((n, d) => { if (n > topCount) { topDistrict = d; topCount = n; } });
  const districtImage: string | null = topDistrict ? (DISTRICT_HERO_IMAGES[(topDistrict as string).trim().toLowerCase()] ?? null) : null;

  // "Your preferences" chips render EXCLUSIVELY from the persisted criteria
  // snapshot — never from Lead fields directly. A lead's own profile
  // (budget/property type) can be empty even when the admin explicitly
  // searched with a budget/type filter in the matching panel, which used to
  // make those chips silently vanish (see PRESENTATION_CRITERIA fix).
  const criteria = (presentation.criteria as MatchFilters | null) ?? {};
  const requirementChips: string[] = [];
  const locationChips = criteria.areas?.length ? criteria.areas : criteria.districts ?? [];
  for (const l of locationChips) requirementChips.push(l);
  for (const t of criteria.propertyTypes ?? []) requirementChips.push(c.propertyTypeNames[t] ?? t);
  for (const n of criteria.bedrooms ?? []) requirementChips.push(c.bedroomLabels[String(n)] ?? String(n));
  const { budgetMin, budgetMax } = criteria;
  if (budgetMin != null || budgetMax != null) {
    const fmt = (n: number) => `€${n.toLocaleString("en-US")}`;
    requirementChips.push(
      budgetMin != null && budgetMax != null ? `${fmt(budgetMin)} – ${fmt(budgetMax)}`
        : budgetMin != null ? `${c.priceFrom} ${fmt(budgetMin)}`
        : `${c.budgetUpTo} ${fmt(budgetMax as number)}`
    );
  }
  const { timeline } = presentation.lead;
  if (timeline) requirementChips.push(c.timelineLabels[timeline] ?? timeline);

  return (
    <>
      <ViewTracker token={params.token} />
      <main className="cp-page" data-theme="dark">
        <HeroGreeting
          eyebrowTag={c.eyebrowTag}
          greetingWord={greetingWord}
          name={presentation.greetingName}
          introLine={c.intro}
          requirementsTitle={c.requirementsTitle}
          requirementChips={requirementChips}
          note={presentation.personalNote}
          advisorName={presentation.advisor?.name}
          districtImage={districtImage}
        />
        <PresentationBody token={params.token} items={items} locale={locale} />
        <ClosingSection
          advisor={presentation.advisor ? {
            name: presentation.advisor.name, avatar: presentation.advisor.avatar, photoPng: presentation.advisor.photoPng,
            whatsappPhone: "35799278285", email: presentation.advisor.email, personalPhone: presentation.advisor.phone,
          } : null}
          locale={locale}
        />
      </main>
    </>
  );
}
