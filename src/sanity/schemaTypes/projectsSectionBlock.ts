// schemas/blocks/projectsBlock.ts
import { defineType, defineField } from "sanity";

export default defineType({
  name: "projectsSectionBlock",
  title: "Projects Section Block",
  type: "object",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
    }),
    defineField({
      name: "filterCity",
      title: "City",
      type: "string",
      options: {
        list: [
          { title: "Paphos", value: "Paphos" },
          { title: "Limassol", value: "Limassol" },
          { title: "Larnaca", value: "Larnaca" },
        ],
      },
    }),
    defineField({
      name: "filterPropertyType",
      title: "Property Type",
      type: "string",
      options: {
        list: [
          { title: "Apartment", value: "Apartment" },
          { title: "Villa", value: "Villa" },
          { title: "Townhouse", value: "Townhouse" },
          { title: "Semi-detached villa", value: "Semi-detached villa" },
          { title: "Office", value: "Office" },
          { title: "Shop", value: "Shop" },
        ],
      },
    }),
    defineField({
      name: "projects",
      title: "Projects",
      type: "array",
      of: [
        defineField({
          name: "projectRef",
          title: "Project Reference",
          type: "reference",
          to: [{ type: "project" }],
          options: {
            filter: ({ document }) => ({
              filter: "language == $language",
              params: { language: document.language },
            }),
          },
        }),
      ],
    }),
    defineField({
      name: "marginTop",
      title: "Margin Top",
      type: "string",
      options: {
        list: [
          { title: "Small", value: "small" },
          { title: "Medium", value: "medium" },
          { title: "Large", value: "large" },
        ],
      },
    }),
    defineField({
      name: "marginBottom",
      title: "Margin Bottom",
      type: "string",
      options: {
        list: [
          { title: "Small", value: "small" },
          { title: "Medium", value: "medium" },
          { title: "Large", value: "large" },
        ],
      },
    }),
  ],
});
