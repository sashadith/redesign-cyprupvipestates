import { defineField } from "sanity";

export const caseStudyCategories = [
  { title: "Luxury Villa Purchase", value: "luxury-villa" },
  { title: "Apartment Purchase", value: "apartment" },
  { title: "Investment Property", value: "investment" },
  { title: "Relocation to Cyprus", value: "relocation" },
  { title: "Permanent Residency", value: "permanent-residency" },
  { title: "New Development Purchase", value: "new-development" },
];

const caseStudy = {
  name: "caseStudy",
  title: "Case Study",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Case Study Title",
      type: "string",
      validation: (Rule) =>
        Rule.required()
          .max(200)
          .error("Title should be less than 200 characters"),
    }),

    defineField({
      name: "slug",
      title: "Slug",
      type: "localizedSlug",
    }),

    defineField({
      name: "seo",
      title: "SEO",
      type: "object",
      fields: [
        defineField({
          name: "metaTitle",
          title: "Meta Title",
          type: "string",
          description: "Max 60 characters",
          validation: (Rule) =>
            Rule.required()
              .max(60)
              .error("Title should be less than 60 characters"),
        }),
        defineField({
          name: "metaDescription",
          title: "Meta Description",
          type: "string",
          description: "Max 160 characters",
          validation: (Rule) =>
            Rule.required()
              .max(160)
              .error("Description should be less than 160 characters"),
        }),
      ],
    }),

    defineField({
      name: "category",
      title: "Case Study Category",
      type: "string",
      options: {
        list: caseStudyCategories,
      },
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: "fullTitle",
      title: "Full Case Study Title",
      type: "string",
    }),

    defineField({
      name: "excerpt",
      title: "Excerpt",
      type: "text",
      rows: 3,
      validation: (Rule) =>
        Rule.required()
          .max(250)
          .error("Excerpt should be less than 250 characters"),
    }),

    defineField({
      name: "clientOverview",
      title: "Client Overview",
      type: "object",
      fields: [
        {
          name: "propertyType",
          title: "Property Type",
          type: "string",
          options: {
            list: [
              { title: "Villa", value: "villa" },
              { title: "Apartment", value: "apartment" },
              { title: "Penthouse", value: "penthouse" },
              { title: "Townhouse", value: "townhouse" },
              { title: "Plot", value: "plot" },
            ],
          },
          validation: (Rule) => Rule.required(),
        },

        {
          name: "location",
          title: "Location",
          type: "string",
          description: "Example: Paphos, Limassol, Larnaca",
          validation: (Rule) => Rule.required(),
        },

        {
          name: "budget",
          title: "Budget",
          type: "string",
          description: "Example: €950,000",
          validation: (Rule) => Rule.required(),
        },

        {
          name: "purchaseTimeline",
          title: "Purchase Timeline",
          type: "string",
          description: "Example: 7 Weeks, 2 Months",
          validation: (Rule) => Rule.required(),
        },
      ],
    }),

    defineField({
      name: "previewImage",
      title: "Preview Image",
      type: "image",
      options: {
        hotspot: true,
      },
      fields: [
        {
          name: "alt",
          title: "Alt Text",
          type: "string",
        },
      ],
    }),

    defineField({
      name: "caseDetails",
      title: "Case Details",
      type: "object",
      fields: [
        {
          name: "clientSituation",
          title: "Client Situation",
          type: "contentBlock",
        },
        {
          name: "requirements",
          title: "Client Requirements",
          type: "contentBlock",
        },
        {
          name: "solution",
          title: "Our Solution",
          type: "contentBlock",
        },
        {
          name: "selectedProperty",
          title: "Selected Property",
          type: "contentBlock",
        },
        {
          name: "result",
          title: "Result",
          type: "contentBlock",
        },
      ],
    }),

    defineField({
      name: "mainContent",
      title: "Main Content",
      type: "array",
      of: [
        { type: "textContent" },
        { type: "doubleTextBlock" },
        { type: "imageFullBlock" },
        { type: "formMinimalBlock" },
      ],
    }),

    defineField({
      name: "relatedProjects",
      title: "Related Properties",
      type: "array",
      of: [
        {
          type: "reference",
          to: [{ type: "project" }],
          options: {
            filter: ({ document }: { document: any }) => ({
              filter: "language == $language",
              params: { language: document.language },
            }),
          },
        },
      ],
    }),

    defineField({
      name: "publishedAt",
      title: "Published At",
      type: "datetime",
      options: {
        dateFormat: "YYYY-MM-DD",
        timeFormat: "HH:mm",
      },
    }),

    defineField({
      name: "language",
      type: "string",
      initialValue: "id",
      readOnly: true,
    }),
  ],
};

export default caseStudy;
