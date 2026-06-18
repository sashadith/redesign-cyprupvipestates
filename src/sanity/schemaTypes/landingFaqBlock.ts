import { defineType, defineField, defineArrayMember } from "sanity";

const landingFaqBlock = defineType({
  name: "landingFaqBlock",
  title: "Landing FAQ Block",
  type: "object",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
    }),
    defineField({
      name: "faq",
      title: "FAQ",
      type: "accordionBlock",
    }),
  ],
});

export default landingFaqBlock;
