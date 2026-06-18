import { defineType, defineField, defineArrayMember } from "sanity";

const formMinimalBlock = defineType({
  name: "formMinimalBlock",
  title: "Form Minimal Block",
  type: "object",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
    }),
    defineField({
      name: "form",
      title: "Form",
      type: "reference",
      to: [{ type: "formStandardDocument" }],
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
      name: "buttonText",
      title: "Button Text",
      type: "string",
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

export default formMinimalBlock;
