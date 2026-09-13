import { prisma } from "@/lib/prisma";
import { graphemeLength, TITLE_GRAPHEME_MAX, DESC_GRAPHEME_MAX } from "@/lib/ai/translateHe";
import { HE_ENTITY_TYPE, HE_ENTITY_TYPES, SAMPLE_SIZE } from "@/lib/ai/heTranslateQueue";
import { enqueueMissingAction, enqueueSampleAction, rejectSampleAction } from "./actions";

/* Steering page for the EN→HE volume translation queue (Phase 5e).
   UI language is English (project convention: everything admin-facing is EN);
   only the translated CONTENT shown in the sample view is Hebrew, and that
   column carries dir="rtl". */

export const dynamic = "force-dynamic";

const QUEUE_ROWS = 50;

const ENTITY_LABEL: Record<string, string> = {
  [HE_ENTITY_TYPE.developmentDescription]: "Development description",
  [HE_ENTITY_TYPE.developmentSeo]: "Development SEO",
  [HE_ENTITY_TYPE.areaText]: "Area text",
  [HE_ENTITY_TYPE.developerProfile]: "Developer profile",
};

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-[#F3F4F6] text-[#374151]",
  DONE: "bg-[#DCFCE7] text-[#166534]",
  FAILED: "bg-[#FEE2E2] text-[#991B1B]",
};

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const seoOf = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const when = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "");

function Stat({ label, value, of }: { label: string; value: number; of: number }) {
  const pct = of > 0 ? Math.round((value / of) * 100) : 0;
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-[#9CA3AF]">{label}</div>
      <div className="mt-1 text-xl font-semibold text-[#111827]">
        {value} <span className="text-sm font-normal text-[#6B7280]">/ {of}</span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-[#F3F4F6]">
        <div className="h-1.5 rounded-full bg-[#1B4B43]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Btn({ children }: { children: React.ReactNode }) {
  return (
    <button type="submit" className="rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm text-[#1B4B43] hover:bg-[#1B4B43]/5">
      {children}
    </button>
  );
}

function MetaCell({ value, max, rtl }: { value: string; max: number; rtl?: boolean }) {
  if (!value) return <span className="text-[#9CA3AF]">not set</span>;
  const n = graphemeLength(value);
  return (
    <div>
      <div dir={rtl ? "rtl" : "ltr"} className={rtl ? "text-right" : ""}>{value}</div>
      <div className={`mt-0.5 text-[11px] ${n > max ? "text-[#991B1B]" : "text-[#9CA3AF]"}`}>
        {n} / {max} graphemes
      </div>
    </div>
  );
}

export default async function HebrewTranslationPage() {
  const [developments, areas, developers, queue] = await Promise.all([
    prisma.development.findMany({
      where: { publishStatus: "published" },
      include: { override: true },
      orderBy: { publicName: "asc" },
    }),
    prisma.areaDescription.findMany({ orderBy: { areaName: "asc" } }),
    prisma.developer.findMany({ orderBy: { title: "asc" } }),
    prisma.aiGenerationQueue.findMany({
      where: { locale: "he", entityType: { in: HE_ENTITY_TYPES } },
      orderBy: { createdAt: "desc" },
      take: QUEUE_ROWS,
    }),
  ]);

  const devWithHe = developments.filter((d) => str(d.override?.descriptionHE)).length;
  const devWithHeSeo = developments.filter((d) => str(seoOf(d.override?.seo).titleHE)).length;
  const areasWithEn = areas.filter((a) => str(a.textEN));
  const areasWithHe = areasWithEn.filter((a) => str(a.textHE)).length;
  const developersEn = developers.filter((d) => d.language === "en");
  const heGroups = new Set(developers.filter((d) => d.language === "he").map((d) => str(d.translationGroupId)).filter(Boolean));
  const developersWithHe = developersEn.filter((d) => str(d.translationGroupId) && heGroups.has(str(d.translationGroupId))).length;

  const pending = queue.filter((q) => q.status === "PENDING").length;
  const failed = queue.filter((q) => q.status === "FAILED").length;

  // Row labels for the queue table — one lookup per entity kind, not per row.
  const devNames = new Map(developments.map((d) => [d.id, d.publicName]));
  const areaNames = new Map(areas.map((a) => [a.id, a.areaName]));
  const developerNames = new Map(developers.map((d) => [d.id, d.title]));
  const nameOf = (entityType: string, entityId: string) =>
    (entityType === HE_ENTITY_TYPE.areaText
      ? areaNames.get(entityId)
      : entityType === HE_ENTITY_TYPE.developerProfile
        ? developerNames.get(entityId)
        : devNames.get(entityId)) ?? entityId.slice(0, 8);

  const sample = developments.slice(0, SAMPLE_SIZE);

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <h1 className="mb-2 text-2xl font-semibold">Hebrew translation queue</h1>
        <p className="max-w-3xl text-sm text-[#6B7280]">
          EN&rarr;HE translation for the volume content: development descriptions and their SEO pairs, area texts and
          developer profiles. Queueing here only writes queue rows. The translation itself runs on the server, through
          the <code className="rounded bg-[#F3F4F6] px-1">/api/cron/he-translate</code> route, so nothing is generated
          by the click. An existing Hebrew value is never overwritten unless the row was queued with force.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Developments with HE description" value={devWithHe} of={developments.length} />
        <Stat label="Developments with HE meta" value={devWithHeSeo} of={developments.length} />
        <Stat label="Areas with HE text" value={areasWithHe} of={areasWithEn.length} />
        <Stat label="Developers with a HE profile" value={developersWithHe} of={developersEn.length} />
      </section>

      <section className="rounded-lg border border-[#E5E7EB] bg-white p-4">
        <h2 className="mb-1 text-sm font-medium">Enqueue</h2>
        <p className="mb-3 text-xs text-[#6B7280]">
          Skips anything that already has Hebrew and anything already pending, so a second click adds nothing.
        </p>
        <div className="flex flex-wrap gap-2">
          <form action={enqueueMissingAction.bind(null, "developments")}><Btn>Enqueue missing developments</Btn></form>
          <form action={enqueueMissingAction.bind(null, "areas")}><Btn>Enqueue missing areas</Btn></form>
          <form action={enqueueMissingAction.bind(null, "developers")}><Btn>Enqueue missing developers</Btn></form>
          <form action={enqueueSampleAction}><Btn>Enqueue {SAMPLE_SIZE} sample</Btn></form>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">
          Queue <span className="text-[#6B7280]">({pending} pending, {failed} failed of the last {QUEUE_ROWS})</span>
        </h2>
        <div className="overflow-x-auto rounded-lg border border-[#E5E7EB] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#F9FAFB] text-left text-xs uppercase tracking-wide text-[#9CA3AF]">
              <tr>
                <th className="p-3 font-medium">Entity</th>
                <th className="p-3 font-medium">Kind</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Queued</th>
                <th className="p-3 font-medium">Processed</th>
                <th className="p-3 font-medium">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {queue.length === 0 && (
                <tr><td colSpan={6} className="p-4 text-[#9CA3AF]">Queue is empty.</td></tr>
              )}
              {queue.map((q) => {
                const result = seoOf(q.result);
                const note = str(result.error) || (result.skipped ? `skipped: ${str(result.reason)}` : "")
                  || (Array.isArray(result.critique) && result.critique.length ? `${result.critique.length} critique note(s)` : "");
                return (
                  <tr key={q.id}>
                    <td className="p-3">{nameOf(q.entityType, q.entityId)}</td>
                    <td className="p-3 text-[#6B7280]">{ENTITY_LABEL[q.entityType] ?? q.entityType}{q.prompt === "force" ? " · force" : ""}</td>
                    <td className="p-3">
                      <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[q.status] ?? "bg-[#F3F4F6] text-[#374151]"}`}>{q.status}</span>
                    </td>
                    <td className="p-3 text-xs text-[#9CA3AF]">{when(q.createdAt)}</td>
                    <td className="p-3 text-xs text-[#9CA3AF]">{when(q.processedAt)}</td>
                    <td className="p-3 text-xs text-[#6B7280]">{note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium">Sample ({sample.length} developments)</h2>
        <p className="mb-3 text-xs text-[#6B7280]">
          The first {SAMPLE_SIZE} published developments by name. Read the Hebrew against the English; reject a bad one
          to queue it again with force, which is the only way an existing Hebrew value gets overwritten.
        </p>
        <div className="space-y-3">
          {sample.map((d) => {
            const seo = seoOf(d.override?.seo);
            return (
              <div key={d.id} className="rounded-lg border border-[#E5E7EB] bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">{d.publicName}</div>
                  <form action={rejectSampleAction.bind(null, d.id)}><Btn>Reject &rarr; re-enqueue with force</Btn></form>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="text-xs uppercase tracking-wide text-[#9CA3AF]">English</div>
                    <div className="whitespace-pre-wrap text-sm text-[#374151]">
                      {str(d.override?.descriptionEN) || str(d.description) || <span className="text-[#9CA3AF]">no English description</span>}
                    </div>
                    <div className="text-xs text-[#6B7280]">
                      <div className="mb-1 font-medium">Meta</div>
                      <MetaCell value={str(seo.titleEN)} max={TITLE_GRAPHEME_MAX} />
                      <MetaCell value={str(seo.descEN)} max={DESC_GRAPHEME_MAX} />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="text-xs uppercase tracking-wide text-[#9CA3AF]">Hebrew</div>
                    <div dir="rtl" className="whitespace-pre-wrap text-right text-sm text-[#374151]">
                      {str(d.override?.descriptionHE) || <span className="text-[#9CA3AF]">not translated yet</span>}
                    </div>
                    <div className="text-xs text-[#6B7280]">
                      <div className="mb-1 font-medium">Meta</div>
                      <MetaCell value={str(seo.titleHE)} max={TITLE_GRAPHEME_MAX} rtl />
                      <MetaCell value={str(seo.descHE)} max={DESC_GRAPHEME_MAX} rtl />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
