import { defineType, defineField, defineArrayMember } from "sanity";

const benefitsBlock = defineType({
  name: "benefitsBlock",
  title: "Benefits Block",
  type: "object",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
    }),
    defineField({
      name: "benefits",
      title: "Benefits",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            defineField({
              name: "counting",
              title: "Counting",
              type: "object",
              fields: [
                defineField({
                  name: "conuntNumber",
                  title: "Count Number",
                  type: "number",
                }),
                defineField({
                  name: "sign",
                  title: "Sign",
                  type: "string",
                }),
              ],
            }),
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
          ],
        },
      ],
    }),
  ],
});

export default benefitsBlock;
