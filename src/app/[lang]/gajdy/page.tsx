// /<lang>/gajdy is not a public URL of this language except where it is that language's guides slug,
// and there the middleware serves the guides page before this route is ever reached (src/middleware.ts,
// guidesPageLang). Anything that gets here is the wrong language/slug pair: send it to the real index.
import { permanentRedirect } from "next/navigation";
import { localizedHref } from "@/lib/locale";
import { guidesSectionSlug, hasGuidesSection } from "@/lib/articleSections";

export default function Page({ params }: { params: { lang: string } }) {
  permanentRedirect(localizedHref(params.lang, hasGuidesSection(params.lang) ? guidesSectionSlug(params.lang) : "blog"));
}
