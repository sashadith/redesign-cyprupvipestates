import { defineField } from "sanity";

export const propertyTypes = [
  { title: "Apartment", value: "Apartment" },
  { title: "Villa", value: "Villa" },
  { title: "Townhouse", value: "Townhouse" },
  { title: "Semi-detached villa", value: "Semi-detached villa" },
  { title: "Office", value: "Office" },
  { title: "Shop", value: "Shop" },
];

export const propertyTypesClassification = [
  { title: "Residential", value: "Residential" },
  { title: "Commercial", value: "Commercial" },
  { title: "Investment", value: "Investment" },
  { title: "Exclusive", value: "Exclusive" },
];

export const energyEfficiency = [
  { title: "A", value: "A" },
  { title: "B", value: "B" },
  { title: "C", value: "C" },
  { title: "D", value: "D" },
  { title: "E", value: "E" },
  { title: "F", value: "F" },
  { title: "G", value: "G" },
];

export const propertyPurpose = [
  { title: "Sale", value: "Sale" },
  { title: "Rent", value: "Rent" },
];

export const propertyType = [
  { title: "Residential", value: "Residential" },
  { title: "Commercial", value: "Commercial" },
  { title: "Investment", value: "Investment" },
  { title: "Exclusive", value: "Exclusive" },
];

const cities = [
  { title: "Paphos", value: "Paphos" },
  { title: "Limassol", value: "Limassol" },
  { title: "Larnaca", value: "Larnaca" },
];

export const market = [
  { title: "Primary", value: "Primary" },
  { title: "Secondary", value: "Secondary" },
];

const project = {
  name: "project",
  title: "Project",
  type: "document",
  fields: [
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
      name: "title",
      title: "Object name",
      type: "string",
      validation: (Rule) =>
        Rule.required()
          .max(200)
          .error("Name should be less than 200 characters"),
    }),
    defineField({
      name: "excerpt",
      title: "Excerpt",
      type: "text",
      rows: 3,
      validation: (Rule) =>
        Rule.required()
          .max(200)
          .error("Excerpt should be less than 200 characters"),
    }),
    defineField({
      name: "previewImage",
      title: "Preview image",
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
      name: "slug",
      title: "Slug",
      type: "localizedSlug",
    }),
    defineField({
      name: "videoId",
      title: "YouTube Video ID",
      type: "string",
    }),
    defineField({
      name: "videoPreview",
      title: "Video preview",
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
      name: "images",
      title: "Property images",
      type: "array",
      of: [
        {
          type: "image",
          fields: [
            {
              name: "alt",
              title: "Alt Text",
              type: "string",
            },
          ],
        },
      ],
      validation: (Rule) => Rule.required().min(3).error("Minimum 3 images"),
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "contentBlock",
    }),
    defineField({
      name: "location",
      title: "Location",
      type: "geopoint",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "developer",
      title: "Developer",
      type: "reference",
      to: [{ type: "developer" }],
      options: {
        filter: ({ document }) => {
          return {
            filter: "language == $language",
            params: { language: document.language },
          };
        },
      },
    }),
    defineField({
      name: "keyFeatures",
      title: "Key features",
      type: "object",
      fields: [
        {
          name: "city",
          title: "City",
          type: "string",
          options: {
            list: cities,
          },
        },
        {
          name: "propertyType",
          title: "Property type",
          type: "string",
          options: {
            list: propertyTypes,
          },
        },
        {
          name: "bedrooms",
          title: "Bedrooms",
          type: "string",
        },
        {
          name: "coveredArea",
          title: "Covered area",
          type: "string",
        },
        {
          name: "plotSize",
          title: "Plot size",
          type: "string",
        },
        {
          name: "energyEfficiency",
          title: "Energy efficiency",
          type: "string",
          options: {
            list: energyEfficiency,
          },
        },
        {
          name: "completionDate",
          title: "Completion date",
          type: "date",
          options: {
            dateFormat: "YYYY-MM",
          },
        },
        {
          name: "price",
          title: "Price",
          type: "number",
        },
      ],
    }),
    defineField({
      name: "distances",
      title: "Distances",
      type: "object",
      fields: [
        { name: "beach", title: "Distance to the Beach", type: "string" },
        {
          name: "restaurants",
          title: "Distance to Restaurants",
          type: "string",
        },
        { name: "shops", title: "Distance to Shops", type: "string" },
        { name: "airport", title: "Distance to the Airport", type: "string" },
        { name: "hospital", title: "Distance to the Hospital", type: "string" },
        { name: "school", title: "Distance to the School", type: "string" },
        {
          name: "cityCenter",
          title: "Distance to the City Center",
          type: "string",
        },
        {
          name: "golfCourt",
          title: "Distance to the Golf Court",
          type: "string",
        },
      ],
    }),
    defineField({
      name: "fullDescription",
      title: "Full description",
      type: "contentBlock",
    }),
    defineField({
      name: "faq",
      title: "FAQ",
      type: "accordionBlock",
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
      name: "isFeatured",
      title: "Featured project",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "listingPriority",
      title: "Listing priority",
      type: "number",
      initialValue: 0,
      validation: (Rule) =>
        Rule.min(0).max(100).warning("Recommended range: 0–100"),
    }),
    defineField({
      name: "investmentData",
      title: "Investment data",
      type: "object",
      fields: [
        defineField({
          name: "expectedMonthlyRent",
          title: "Expected monthly rent",
          type: "number",
        }),
        defineField({
          name: "furnishingEstimate",
          title: "Furnishing estimate",
          type: "number",
        }),
        defineField({
          name: "annualServiceCharge",
          title: "Annual service charge",
          type: "number",
        }),
        defineField({
          name: "sellingCostsPercent",
          title: "Selling costs (%)",
          type: "number",
        }),
        defineField({
          name: "managementPercent",
          title: "Management (%)",
          type: "number",
        }),
        defineField({
          name: "maintenancePercent",
          title: "Maintenance (%)",
          type: "number",
        }),
        defineField({
          name: "customBuildPeriodYears",
          title: "Custom build period (years)",
          type: "number",
        }),
      ],
    }),
    defineField({
      name: "isSold",
      title: "Is Sold",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "language",
      type: "string",
      initialValue: "id",
      readOnly: true,
    }),
  ],
};

export default project;
