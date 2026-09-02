import { urlFor } from "@/sanity/sanity.client";
import { localePrefix } from "@/lib/locale";
import { resolveCompletionYear } from "@/lib/text";
import type { ProjectCardData } from "./ProjectCard";

/* Sanity/legacy project row → the redesigned card's shape.

   Lives here rather than inside ProjectsSectionBlockComponent because that
   file is a client component: importing a plain function out of one from a
   server component hands back a client reference, not the function, and the
   call fails at render with "toCardData is not a function". Both the block
   component and the server-rendered landing pages import it from here.

   Field-for-field match with getDeveloperCatalogByLang's own card mapping —
   one shape for every surface that shows a project card, not a second
   near-copy that drifts. */
export function toCardData(project: any, lang: string): ProjectCardData {
  const kf = project.keyFeatures ?? {};
  const img = project.previewImage;
  return {
    id: project._id,
    title: project.title,
    href: `${localePrefix(lang)}/projects/${project.slug}`,
    image: typeof img === "string" ? img : img ? urlFor(img).url() : undefined,
    city: kf.city ?? "",
    price: typeof kf.price === "number" ? kf.price : Number(kf.price) || null,
    bedrooms: kf.bedrooms ?? "",
    area: kf.coveredArea ?? "",
    type: kf.propertyType ?? "",
    energy: kf.energyEfficiency ?? "",
    completion: resolveCompletionYear(kf.completionDate),
    isNew: !!project.isNew,
    isFeatured: !!project.isFeatured,
    vatApplies: kf.vatApplies ?? null,
    distances: project.distances ?? null,
    unitsAvailable: project.unitsAvailable,
    unitsTotal: project.unitsTotal,
  };
}
