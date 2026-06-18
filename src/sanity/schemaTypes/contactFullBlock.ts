import { defineType, defineField, defineArrayMember } from "sanity";

const contactFullBlock = defineType({
  name: "contactFullBlock",
  title: "Contact Full Block",
  type: "object", // Change to object
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "string",
    }),
    defineField({
      name: "contacts",
      title: "Contacts",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            defineField({
              name: "icon",
              title: "Icon",
              type: "image",
            }),
            defineField({
              name: "title",
              title: "Title",
              type: "string",
            }),
            defineField({
              name: "label",
              title: "Label",
              type: "string",
            }),
            defineField({
              name: "type",
              title: "Type",
              type: "string",
              options: {
                list: [
                  { title: "Email", value: "Email" },
                  { title: "Phone", value: "Phone" },
                  { title: "Link", value: "Link" },
                ],
              },
            }),
          ],
        },
      ],
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
  ],
});

export default contactFullBlock;
