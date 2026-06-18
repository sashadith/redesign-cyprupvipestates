import { defineType, defineField } from "sanity";

const doubleTextBlock = defineType({
  name: "doubleTextBlock",
  title: "Double Text Block",
  type: "object",
  fields: [
    defineField({
      name: "doubleTextBlockTitle",
      title: "Title of the block",
      type: "string",
    }),
    defineField({
      name: "leftContent",
      title: "Left Content",
      type: "object",
      fields: [
        defineField({
          name: "type",
          title: "Type",
          type: "string",
          options: {
            list: [
              { title: "Text", value: "text" },
              { title: "Image", value: "image" },
            ],
          },
        }),
        defineField({
          name: "blockContent",
          title: "Block Content",
          type: "blockContentWithStyle",
          hidden: ({ parent }) => parent?.type !== "text",
        }),
        defineField({
          name: "image",
          title: "Image",
          type: "image",
          hidden: ({ parent }) => parent?.type !== "image",
          fields: [
            {
              name: "alt",
              title: "Alt Text",
              type: "string",
            },
          ],
        }),
      ],
    }),
    defineField({
      name: "rightContent",
      title: "Right Content",
      type: "object",
      fields: [
        defineField({
          name: "type",
          title: "Type",
          type: "string",
          options: {
            list: [
              { title: "Text", value: "text" },
              { title: "Image", value: "image" },
            ],
          },
        }),
        defineField({
          name: "blockContent",
          title: "Block Content",
          type: "blockContentWithStyle",
          hidden: ({ parent }) => parent?.type !== "text",
        }),
        defineField({
          name: "image",
          title: "Image",
          type: "image",
          hidden: ({ parent }) => parent?.type !== "image",
          fields: [
            {
              name: "alt",
              title: "Alt Text",
              type: "string",
            },
          ],
        }),
      ],
    }),
    defineField({
      name: "isDivider",
      title: "Is Divider",
      type: "boolean",
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
    defineField({
      name: "paddingTop",
      title: "Padding Top",
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
      name: "paddingBottom",
      title: "Padding Bottom",
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

export default doubleTextBlock;
