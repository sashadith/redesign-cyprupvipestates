import { defineField } from "sanity";

export const propertyTypes = [
  { title: "Apartment", value: "Apartment" },
  { title: "Villa", value: "Villa" },
  { title: "Townhouse", value: "Townhouse" },
  { title: "Semi-detached villa", value: "Semi-detached villa" },
  { title: "Office", value: "Office" },
  { title: "Shop", value: "Shop" },
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

export const market = [
  { title: "Primary", value: "Primary" },
  { title: "Secondary", value: "Secondary" },
];

const property = {
  name: "property",
  title: "Property",
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
        }),
        defineField({
          name: "metaDescription",
          title: "Meta Description",
          type: "string",
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
      name: "price",
      title: "Price",
      type: "number",
      validation: (Rule) => Rule.required(),
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
      name: "address",
      title: "Address",
      type: "string",
    }),
    defineField({
      name: "city",
      title: "City",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "district",
      title: "District",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "contentBlock",
    }),
    defineField({
      name: "type",
      title: "Property type",
      type: "string",
      options: {
        list: propertyTypes,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "purpose",
      title: "Property purpose",
      type: "string",
      options: {
        list: propertyPurpose,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "propertyType",
      title: "Property variant",
      type: "string",
      options: {
        list: propertyType,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "location",
      title: "Location",
      type: "geopoint",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "floorSize",
      title: "Floor size",
      type: "number",
      validation: (Rule) => Rule.required(),
      description: "Only numbers",
    }),
    defineField({
      name: "rooms",
      title: "Rooms",
      type: "number",
      validation: (Rule) => Rule.required(),
      description: "Only numbers",
    }),
    defineField({
      name: "hasParking",
      title: "Parking has/no",
      type: "boolean",
    }),
    defineField({
      name: "hasPool",
      title: "Pool has/no",
      type: "boolean",
    }),
    defineField({
      name: "distances",
      title: "Distances",
      type: "object",
      fields: [
        { name: "toCenter", title: "Distance to the center", type: "string" },
        { name: "toBeach", title: "Distance to the beach", type: "string" },
        { name: "toAirport", title: "Distance to the airport", type: "string" },
        { name: "toShop", title: "Distance to the shop", type: "string" },
        { name: "toSchool", title: "Distance to the school", type: "string" },
        { name: "toGolf", title: "Distance to the golf club", type: "string" },
      ],
    }),
    defineField({
      name: "marketType",
      title: "Market type",
      type: "string",
      options: {
        list: market,
      },
      description: "Primary or secondary market",
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
      name: "isActual",
      title: "Is actual",
      type: "boolean",
      initialValue: true,
      description: "Is this property actual?",
    }),
    defineField({
      name: "language",
      type: "string",
      initialValue: "id",
      readOnly: true,
    }),
  ],
};

export default property;
