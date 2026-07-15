// Developer-agnostic ADMIN preview of a project, addressed by ?dev=&id= (the raw
// feed key) rather than a slug. Always noindex — this is a working/QA view for
// drafts and for developers that haven't been assigned a slug yet. Once a
// Development has a slug (assigned automatically on publish, see
// src/lib/developmentSeo.ts), this route 301s straight to the real SEO-facing
// slug route (src/app/[lang]/preview-project/[slug]/page.tsx) so no two URLs
// ever serve the same published project.
import "@/app/preview-home/tokens.css";
import "@/app/preview-projects/projects.css";
import "@/app/preview-project/project.css";

import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { i18n } from "@/i18n.config";
import { localizedHref } from "@/lib/locale";
import type { Translation } from "@/types/homepage";

import Header from "@/app/components/Header/Header";
import Footer from "@/app/components/Footer/Footer";
import ProjectPageBody from "@/app/preview-project/ProjectPageBody";
import { getPreviewProject, DEV_LIST } from "@/app/preview-project/feeds";
import { getDbProject } from "@/lib/developmentRender";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Project page — preview", robots: { index: false, follow: false } };

export default async function PreviewProjectPage({ params, searchParams }: { params: { lang: string }; searchParams?: { dev?: string; id?: string; source?: string } }) {
  const { lang } = params;
  const dev = searchParams?.dev ?? "island-blue";
  const target = searchParams?.id ?? DEV_LIST.find((d) => d.id === dev)?.default ?? "";
  const forceFeed = searchParams?.source === "feed";

  // DB-first (synced developments) → live feed as fallback. ?source=feed forces the feed.
  const dbP = forceFeed ? null : await getDbProject(dev, target);
  // A published (or any slugged) development has a real SEO URL — send traffic
  // there instead of rendering this admin view twice under two addresses.
  if (dbP?.slug) {
    permanentRedirect(localizedHref(lang, ["preview-project", dbP.slug]));
  }
  const p = dbP ?? (await getPreviewProject(dev, target));
  const translations: Translation[] = i18n.languages.map((l) => ({ language: l.id, path: localizedHref(l.id, "preview-project") }));

  const Switcher = () => (
    <span className="pp-note__switch">
      {DEV_LIST.map((d) => (
        <a key={d.id} href={`?dev=${d.id}`} className={dev === d.id ? "is-on" : ""}>{d.label}</a>
      ))}
    </span>
  );

  if (!p) {
    return (
      <>
        <Header params={params} translations={translations} />
        <main className="pp" data-theme="dark">
          <div className="pp-note"><span className="pp-note__tag">Preview</span><Switcher /></div>
          <div className="pp-wrap pp-section"><p>This feed could not be loaded (e.g. missing API key for {dev}).</p></div>
        </main>
        <Footer params={params} />
      </>
    );
  }

  const banner = (
    <div className="pp-note">
      <span className="pp-note__tag">Preview</span>
      Public: <strong>{p.publicName}</strong>
      <span className="pp-note__sep">·</span>
      <span className="pp-note__int">Internal: {p.developerName} — {p.developer}</span>
      <span className="pp-note__sep">·</span>
      <Switcher />
    </div>
  );

  return <ProjectPageBody p={p} lang={lang} params={params} translations={translations} banner={banner} />;
}
