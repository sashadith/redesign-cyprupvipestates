import { defineType, defineField, defineArrayMember } from "sanity";

const buttonBlock = defineType({
  name: "buttonBlock",
  title: "Button Block",
  type: "object", // Change to object
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
    }),
    defineField({
      name: "buttonText",
      title: "Button Text",
      type: "string",
    }),
    defineField({
      name: "justifyContent",
      title: "Horizontal Justification",
      type: "string",
      options: {
        list: [
          { title: "Start", value: "start" },
          { title: "Center", value: "center" },
          { title: "End", value: "end" },
        ],
      },
    }),
    defineField({
      name: "alignItems",
      title: "Vertical Justification",
      type: "string",
      options: {
        list: [
          { title: "Start", value: "start" },
          { title: "Center", value: "center" },
          { title: "End", value: "end" },
        ],
      },
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

export default buttonBlock;
