import { defineType, defineField, defineArrayMember } from "sanity";

const imageFullBlock = defineType({
  name: "imageFullBlock",
  title: "Image Full Block",
  type: "object", // Change to object
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
    }),
    defineField({
      name: "imageMain",
      title: "Image Main",
      type: "object",
      fields: [
        defineField({
          name: "picture",
          title: "Picture",
          type: "image",
          options: { hotspot: true },
          fields: [
            {
              name: "alt",
              title: "Alt Text",
              type: "string",
            },
          ],
        }),
        defineField({
          name: "aspectRatio",
          title: "Aspect Ratio",
          type: "string",
          options: {
            list: [
              { title: "16:9", value: "16:9" },
              { title: "10:5", value: "10:5" },
              { title: "10:4", value: "10:4" },
              { title: "5:4", value: "5:4" },
              { title: "4:3", value: "4:3" },
              { title: "3:2", value: "3:2" },
              { title: "2:1", value: "2:1" },
              { title: "1:1", value: "1:1" },
            ],
          },
          initialValue: "16:9",
        }),
      ],
    }),
    defineField({
      name: "hasDescription",
      title: "Has Description",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "object",
      hidden: ({ parent }) => !parent?.hasDescription,
      fields: [
        defineField({
          name: "textItems",
          title: "Text Items",
          type: "array",
          of: [
            {
              type: "object",
              name: "textItem",
              title: "Text Item",
              fields: [
                defineField({
                  name: "text",
                  title: "Text",
                  type: "string",
                }),
                defineField({
                  name: "highlighted",
                  title: "Highlight this part",
                  type: "boolean",
                  initialValue: false,
                }),
              ],
              preview: {
                select: { title: "text", highlighted: "highlighted" },
                prepare({ title, highlighted }) {
                  return {
                    title,
                    subtitle: highlighted ? "🔆 highlighted" : "",
                  };
                },
              },
            },
          ],
        }),
        defineField({
          name: "tag",
          title: "Tag",
          type: "string",
          options: {
            list: [
              { title: "Heading 1", value: "h1" },
              { title: "Heading 2", value: "h2" },
              { title: "Heading 3", value: "h3" },
              { title: "Paragraph", value: "p" },
            ],
          },
          initialValue: "p",
        }),
      ],
    }),
  ],
});

export default imageFullBlock;
