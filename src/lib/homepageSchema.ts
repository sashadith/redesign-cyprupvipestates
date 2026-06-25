// Faithful transcription of the original Sanity homepage schema
// (cyprusvipestates repo → src/sanity/schemaTypes/homepage.ts and its referenced types:
//  contentBlock, blockContentWithStyle, accordionBlock, faqBlock, textContent, doubleTextBlock).
// Field NAMES, TITLES, TYPES and ORDER match Sanity exactly. Drives the admin homepage editor.
// This file contains NO React and is safe to import on both server and client.

export type HField = {
  name: string;
  title: string;
  showWhen?: { field: string; equals: string }; // mirror Sanity `hidden` conditionals
} & (
  | { kind: "string" }
  | { kind: "text"; rows?: number }
  | { kind: "number" }
  | { kind: "boolean" }
  | { kind: "enum"; options: { title: string; value: string }[] }
  | { kind: "image" }
  | { kind: "file" }
  | { kind: "pt" } // Portable Text (contentBlock)
  | { kind: "object"; fields: HField[] }
  | { kind: "objectArray"; itemLabel?: string; fields: HField[] }
  | { kind: "refArray"; refType: "project" | "caseStudy" }
  | { kind: "mixedArray"; members: { type: string; title: string; fields: HField[] }[] }
);

const linkButton = [
  { title: "Link", value: "link" },
  { title: "Button", value: "button" },
];
const marginSML = [
  { title: "Small", value: "small" },
  { title: "Medium", value: "medium" },
  { title: "Large", value: "large" },
];
const spacingNSML = [
  { title: "None", value: "none" },
  { title: "Small", value: "small" },
  { title: "Medium", value: "medium" },
  { title: "Large", value: "large" },
];

// type: "contentBlock" (Portable Text)
const PT = (name: string, title: string): HField => ({ name, title, kind: "pt" });

// type: "blockContentWithStyle"
const blockContentWithStyle: HField[] = [
  PT("content", "Content"),
  { name: "backgroundColor", title: "Background Color", kind: "string" },
];

// type: "accordionBlock"
const accordionBlock: HField[] = [
  {
    name: "items", title: "Items", kind: "objectArray", itemLabel: "Item",
    fields: [
      { name: "question", title: "Question", kind: "string" },
      PT("answer", "Answer"),
    ],
  },
];

// type: "faqBlock"
const faqBlock: HField[] = [
  { name: "faq", title: "FAQ", kind: "object", fields: accordionBlock },
  { name: "marginTop", title: "Margin Top", kind: "enum", options: marginSML },
  { name: "marginBottom", title: "Margin Bottom", kind: "enum", options: marginSML },
];

// type: "textContent"
const textContent: HField[] = [
  PT("content", "Content Editor"),
  { name: "backgroundColor", title: "Background Color", kind: "string" },
  { name: "paddingVertical", title: "Vertical Padding", kind: "enum", options: spacingNSML },
  { name: "paddingHorizontal", title: "Horizontal Padding", kind: "enum", options: spacingNSML },
  { name: "marginTop", title: "Margin Top", kind: "enum", options: spacingNSML },
  { name: "marginBottom", title: "Margin Bottom", kind: "enum", options: spacingNSML },
  { name: "textAlign", title: "Text Alignment", kind: "enum", options: [
    { title: "Left", value: "left" }, { title: "Center", value: "center" }, { title: "Right", value: "right" },
  ] },
  { name: "textColor", title: "Text Color", kind: "string" },
  { name: "backgroundFull", title: "Background Full", kind: "string" },
];

const sideContent: HField[] = [
  { name: "type", title: "Type", kind: "enum", options: [
    { title: "Text", value: "text" }, { title: "Image", value: "image" },
  ] },
  { name: "blockContent", title: "Block Content", kind: "object", fields: blockContentWithStyle, showWhen: { field: "type", equals: "text" } },
  { name: "image", title: "Image", kind: "image", showWhen: { field: "type", equals: "image" } },
];

// type: "doubleTextBlock"
const doubleTextBlock: HField[] = [
  { name: "doubleTextBlockTitle", title: "Title of the block", kind: "string" },
  { name: "leftContent", title: "Left Content", kind: "object", fields: sideContent },
  { name: "rightContent", title: "Right Content", kind: "object", fields: sideContent },
  { name: "isDivider", title: "Is Divider", kind: "boolean" },
  { name: "marginTop", title: "Margin Top", kind: "enum", options: marginSML },
  { name: "marginBottom", title: "Margin Bottom", kind: "enum", options: marginSML },
  { name: "paddingTop", title: "Padding Top", kind: "enum", options: marginSML },
  { name: "paddingBottom", title: "Padding Bottom", kind: "enum", options: marginSML },
];

// ── The homepage document — top-level fields in EXACT Sanity order ──
export const HOMEPAGE_SCHEMA: HField[] = [
  { name: "title", title: "Title", kind: "string" },
  { name: "seo", title: "SEO", kind: "object", fields: [
    { name: "metaTitle", title: "Meta Title", kind: "string" },
    { name: "metaDescription", title: "Meta Description", kind: "string" },
  ] },
  { name: "heroBlock", title: "Hero Block", kind: "object", fields: [
    { name: "video", title: "Video", kind: "file" },
    { name: "posterImage", title: "Poster Image", kind: "image" },
    { name: "heroTitle", title: "Hero Title", kind: "string" },
    { name: "heroDescription", title: "Hero Description", kind: "string" },
    { name: "type", title: "Type", kind: "enum", options: linkButton },
    { name: "linkLabel", title: "Link Label", kind: "string", showWhen: { field: "type", equals: "link" } },
    { name: "linkDestination", title: "Link Destination", kind: "string", showWhen: { field: "type", equals: "link" } },
    { name: "buttonLabel", title: "Button Label", kind: "string", showWhen: { field: "type", equals: "button" } },
  ] },
  { name: "sliderMain", title: "Slider Main", kind: "objectArray", itemLabel: "Slide", fields: [
    { name: "image", title: "Image", kind: "image" },
    { name: "title", title: "Title", kind: "string" },
    { name: "description", title: "Description", kind: "string" },
    { name: "type", title: "Type", kind: "enum", options: linkButton },
    { name: "linkLabel", title: "Link Label", kind: "string", showWhen: { field: "type", equals: "link" } },
    { name: "linkDestination", title: "Link Destination", kind: "string", showWhen: { field: "type", equals: "link" } },
    { name: "buttonLabel", title: "Button Label", kind: "string", showWhen: { field: "type", equals: "button" } },
  ] },
  { name: "brochureBlock", title: "Brochure Block", kind: "object", fields: [
    { name: "logo", title: "Logo", kind: "image" },
    { name: "title", title: "Title", kind: "string" },
    { name: "subtitle", title: "Subtitle", kind: "string" },
    { name: "description", title: "Description", kind: "string" },
    { name: "list", title: "List", kind: "objectArray", itemLabel: "List Item", fields: [
      { name: "listItem", title: "List Item", kind: "string" },
    ] },
    { name: "buttonLabel", title: "Button Label", kind: "string" },
    { name: "image", title: "Image", kind: "image" },
  ] },
  { name: "featuredProjectsBlock", title: "Featured Projects Block", kind: "object", fields: [
    { name: "title", title: "Title", kind: "string" },
    { name: "description", title: "Description", kind: "text", rows: 5 },
    { name: "projects", title: "Projects", kind: "refArray", refType: "project" },
  ] },
  { name: "citiesBlock", title: "Cities Block", kind: "object", fields: [
    { name: "title", title: "Title", kind: "string" },
    { name: "cities", title: "Cities", kind: "objectArray", itemLabel: "City", fields: [
      { name: "image", title: "Image", kind: "image" },
      { name: "city", title: "City", kind: "string" },
      { name: "link", title: "Link", kind: "string" },
    ] },
  ] },
  { name: "homepageTitle", title: "Homepage Title", kind: "string" },
  { name: "aboutBlock", title: "About Block", kind: "object", fields: [
    { name: "title", title: "Title", kind: "string" },
    { name: "description", title: "Description", kind: "string" },
    { name: "bullets", title: "Bullets", kind: "objectArray", itemLabel: "Bullet", fields: [
      { name: "image", title: "Image", kind: "image" },
      { name: "description", title: "Description", kind: "string" },
    ] },
  ] },
  { name: "descriptionBlock", title: "Description Block", kind: "object", fields: [
    { name: "title", title: "Title", kind: "string" },
    { name: "descriptionFields", title: "Description Fields", kind: "objectArray", itemLabel: "Field", fields: [
      PT("descriptionField", "Description Field"),
    ] },
  ] },
  { name: "projectsBlock", title: "Projects Block", kind: "object", fields: [
    { name: "title", title: "Title", kind: "string" },
    { name: "projects", title: "Projects", kind: "objectArray", itemLabel: "Project", fields: [
      { name: "image", title: "Image", kind: "image" },
      { name: "title", title: "Title", kind: "string" },
      { name: "description", title: "Description", kind: "string" },
      { name: "city", title: "City", kind: "enum", options: [
        { title: "Paphos", value: "Paphos" }, { title: "Limassol", value: "Limassol" }, { title: "Larnaca", value: "Larnaca" },
      ] },
      { name: "propertyType", title: "Property Type", kind: "enum", options: [
        { title: "Villa", value: "Villa" }, { title: "Apartment", value: "Apartment" },
      ] },
      { name: "adress", title: "Adress", kind: "string" },
      { name: "flatsAmount", title: "Flats Amount", kind: "string" },
      { name: "area", title: "Area", kind: "string" },
      { name: "price", title: "Price", kind: "string" },
      { name: "buttonLabel", title: "Button Label", kind: "string" },
      { name: "buttonAltLabel", title: "Button Alternate Label", kind: "string" },
    ] },
  ] },
  { name: "logosBlock", title: "Logos Block", kind: "object", fields: [
    { name: "logos", title: "Logos", kind: "objectArray", itemLabel: "Logo", fields: [
      { name: "image", title: "Image", kind: "image" },
    ] },
  ] },
  { name: "parallaxImage", title: "Parallax Image", kind: "image" },
  { name: "benefitsBlock", title: "Benefits Block", kind: "object", fields: [
    { name: "title", title: "Title", kind: "string" },
    { name: "benefits", title: "Benefits", kind: "objectArray", itemLabel: "Benefit", fields: [
      { name: "counting", title: "Counting", kind: "object", fields: [
        { name: "conuntNumber", title: "Count Number", kind: "number" },
        { name: "sign", title: "Sign", kind: "string" },
      ] },
      { name: "title", title: "Title", kind: "string" },
      { name: "description", title: "Description", kind: "string" },
    ] },
  ] },
  { name: "howWeWorkBlock", title: "How We Work Block", kind: "object", fields: [
    { name: "title", title: "Title", kind: "string" },
    { name: "steps", title: "Steps", kind: "objectArray", itemLabel: "Step", fields: [
      { name: "icon", title: "Icon", kind: "image" },
      { name: "text", title: "text", kind: "string" },
    ] },
    { name: "description", title: "Description", kind: "string" },
  ] },
  { name: "contentBlocks", title: "SEO Content Blocks", kind: "mixedArray", members: [
    { type: "textContent", title: "Text Content Block", fields: textContent },
    { type: "doubleTextBlock", title: "Double Text Block", fields: doubleTextBlock },
  ] },
  { name: "featuredCaseStudiesBlock", title: "Featured Case Studies Block", kind: "object", fields: [
    { name: "title", title: "Title", kind: "string" },
    { name: "description", title: "Description", kind: "text", rows: 5 },
    { name: "caseStudies", title: "Case Studies", kind: "refArray", refType: "caseStudy" },
    { name: "button", title: "Button", kind: "object", fields: [
      { name: "label", title: "Label", kind: "string" },
      { name: "url", title: "URL", kind: "string" },
    ] },
  ] },
  { name: "faqSection", title: "FAQ Section", kind: "object", fields: [
    { name: "faqTitle", title: "FAQ Title", kind: "string" },
    { name: "faq", title: "FAQ", kind: "object", fields: faqBlock },
  ] },
  { name: "reviewsFullBlock", title: "Reviews Full Block", kind: "object", fields: [
    { name: "title", title: "Title", kind: "string" },
    { name: "reviews", title: "Reviews", kind: "objectArray", itemLabel: "Review", fields: [
      { name: "name", title: "Name", kind: "string" },
      PT("text", "Text"),
      { name: "image", title: "Image", kind: "image" },
    ] },
  ] },
  { name: "reviewsBlock", title: "Reviews Block", kind: "object", fields: [
    { name: "title", title: "Title", kind: "string" },
    { name: "reviews", title: "Reviews", kind: "objectArray", itemLabel: "Review", fields: [
      PT("reviewText", "Review Text"),
      { name: "name", title: "Name", kind: "string" },
    ] },
  ] },
];
