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

export function templateClassOf(url: string): TemplateClass {
  if (/^\/(de|pl|ru)?$/.test(url)) return "homepage";
  if (/^\/(de|pl|ru)?\/projects$/.test(url)) return "projects-listing";
  if (/^\/(de|pl|ru)?\/projects\/[^/]+$/.test(url)) return "development-page";
  if (/^\/(de|pl|ru)?\/blog\/[^/]+$/.test(url)) return "blog-post";
  return "other-landing-page";
}

export function templateClassLabel(cls: TemplateClass): string {
  return TEMPLATE_CLASS_LABEL[cls];
}
