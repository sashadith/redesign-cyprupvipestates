"use client";

import React from "react";
import { ProjectCard } from "@/app/preview-projects/ProjectCard";
import { toCardData } from "@/app/preview-projects/toCardData";
import { projectsStrings } from "@/app/[lang]/projects/projectsI18n";

/* The card grid has to be a client island, not a server-rendered list.

   ProjectCard is a client component and its `s` prop is the ProjectsStrings
   bundle, which carries `mapTileSub` — a function. Handing that object across
   the server/client boundary throws "Functions cannot be passed directly to
   Client Components". ProjectsSectionBlockComponent never hits this because it
   is itself a client component; this page is not. So the strings are resolved
   on this side of the boundary and only plain project rows cross it.

   data-theme="dark" scopes the grid the same way /projects and the article
   block do: .prj paints its own deep-sea surface and needs the dark token
   values for its muted label text regardless of the page around it. */
export default function LandingProjectsGrid({ projects, lang }: { projects: any[]; lang: string }) {
  const s = projectsStrings(lang);
  return (
    <div data-theme="dark" className="pl-grid">
      {projects.map((p) => (
        <ProjectCard key={p._id} c={toCardData(p, lang)} s={s} locale={lang} />
      ))}
    </div>
  );
}
