import { defineField } from "sanity";

const footer = {
  name: "footer",
  title: "Footer",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
    }),
    defineField({
      name: "logo",
      title: "Logo",
      type: "image",
    }),
    defineField({
      name: "socialLinks",
      title: "Social links",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            defineField({
              name: "label",
              title: "Label",
              type: "string",
            }),
            defineField({
              name: "link",
              title: "Link",
              type: "string",
            }),
            defineField({
              name: "icon",
              title: "Icon",
              type: "image",
            }),
          ],
        },
      ],
    }),
    defineField({
      name: "companyTitle",
      title: "Company title",
      type: "string",
    }),
    defineField({
      name: "companyParagraphs",
      title: "Company paragraphs",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            defineField({
              name: "paragraph",
              title: "Paragraph",
              type: "string",
            }),
          ],
        },
      ],
    }),
    defineField({
      name: "vatNumber",
      title: "VAT number",
      type: "string",
    }),
    defineField({
      name: "contactTitle",
      title: "Contact title",
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
      name: "newsletterTitle",
      title: "Newsletter Title",
      type: "string",
    }),
    defineField({
      name: "newsletterButtonLabel",
      title: "Newsletter Button Label",
      type: "string",
    }),
    defineField({
      name: "copyright",
      title: "Copyright",
      type: "string",
    }),
    defineField({
      name: "policyLinks",
      title: "Policy links",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            defineField({
              name: "label",
              title: "Label",
              type: "string",
            }),
            defineField({
              name: "link",
              title: "Link",
              type: "string",
            }),
          ],
        },
      ],
    }),
    defineField({
      name: "footerColumns",
      title: "Footer SEO Columns",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            defineField({
              name: "title",
              title: "Column title",
              type: "string",
            }),

            defineField({
              name: "links",
              title: "Links",
              type: "array",
              of: [
                {
                  type: "object",
                  fields: [
                    defineField({
                      name: "label",
                      title: "Label",
                      type: "string",
                    }),

                    defineField({
                      name: "url",
                      title: "URL",
                      type: "string",
                    }),
                  ],
                },
              ],
            }),
          ],
        },
      ],
    }),
    defineField({
      name: "discklaimer",
      title: "Discklaimer",
      type: "string",
    }),
    defineField({
      name: "language",
      type: "string",
      initialValue: "id",
      readOnly: true,
    }),
  ],
};

export default footer;
