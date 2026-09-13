// Sibling copy module for SectionLinks.tsx — moved out of the component so
// the snapshot/meta-length gates can load it standalone (the component file
// itself imports a CSS module, which tsx/esbuild can't parse when the file is
// loaded outside Next's build pipeline). Two distinct, non-merged link
// blocks, each rendered ONLY when it has links (never site-wide):
//  - "section" = structural parent -> child links (via parentSanityId)
//  - "related" = editor-curated contextual links (Phase 2 "Related Landing Pages")
import type { Locale } from "@/lib/locale";

export const HEADINGS: Record<string, Record<Locale, string>> = {
  section: {
    en: "More in this section",
    de: "Mehr in diesem Bereich",
    ru: "Ещё в этом разделе",
    pl: "Więcej w tej sekcji",
    he: "More in this section", // TODO(he)
  },
  related: {
    en: "You may also be interested in",
    de: "Das könnte Sie auch interessieren",
    ru: "Вам также может быть интересно",
    pl: "Może Cię również zainteresować",
    he: "You may also be interested in", // TODO(he)
  },
};
