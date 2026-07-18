// Groups a URL into a coarse "template class" so per-page signals (like Core
// Web Vitals) can be reported once per SHARED TEMPLATE rather than once per
// URL — a Development page's LCP problem is a template-wide layout/asset
// issue, not specific to that one project, so one Action Center item per
// class (not per page) is the actionable framing. Shared by the CWV rule and
// the SEO Advisor's payload gatherer.
export type TemplateClass = "homepage" | "projects-listing" | "development-page" | "blog-post" | "other-landing-page";

const TEMPLATE_CLASS_LABEL: Record<TemplateClass, string> = {
  homepage: "the homepage",
  "projects-listing": "the projects listing page",
  "development-page": "Development pages",
  "blog-post": "blog posts",
  "other-landing-page": "other landing pages",
};

// developmentSlugs, when passed, disambiguates "development-page" from
// "other-landing-page" for a /projects/{slug} URL — the two share an
// identical URL shape (a legacy Sanity Project and a Development can both
// live at /projects/{slug}) but render via completely different components
// (PropertyIntro vs HeroMedia), so lumping them into one CWV bucket mixes
// two unrelated templates' numbers together. Omit it to classify by URL
// shape alone (fine for contexts without cheap DB access to the Development
// table; every /projects/{slug} URL then reads as "development-page").
export function templateClassOf(url: string, developmentSlugs?: Set<string>): TemplateClass {
  if (/^\/(de|pl|ru)?$/.test(url)) return "homepage";
  if (/^(?:\/(de|pl|ru))?\/projects$/.test(url)) return "projects-listing";
  const projectMatch = url.match(/^(?:\/(?:de|pl|ru))?\/projects\/([^/]+)$/);
  if (projectMatch) {
    if (!developmentSlugs || developmentSlugs.has(projectMatch[1])) return "development-page";
    return "other-landing-page";
  }
  if (/^(?:\/(de|pl|ru))?\/blog\/[^/]+$/.test(url)) return "blog-post";
  return "other-landing-page";
}

export function templateClassLabel(cls: TemplateClass): string {
  return TEMPLATE_CLASS_LABEL[cls];
}
