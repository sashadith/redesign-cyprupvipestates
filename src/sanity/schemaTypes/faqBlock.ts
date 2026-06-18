import { defineType, defineField, defineArrayMember } from "sanity";

const faqBlock = defineType({
  name: "faqBlock",
  title: "FAQ Block",
  type: "object",
  fields: [
    defineField({
      name: "faq",
      title: "FAQ",
      type: "accordionBlock",
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

export default faqBlock;
