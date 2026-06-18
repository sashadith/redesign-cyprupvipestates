import { defineType, defineField, defineArrayMember } from "sanity";

const teamBlock = defineType({
  name: "teamBlock",
  title: "Team Block",
  type: "object", // Change to object
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
    }),
    defineField({
      name: "members",
      title: "Members",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({
              name: "image",
              title: "Image",
              type: "image",
              options: {
                hotspot: true,
              },
              fields: [
                {
                  name: "alt",
                  title: "Alt Text",
                  type: "string",
                },
              ],
            }),
            defineField({
              name: "name",
              title: "Name",
              type: "string",
            }),
            defineField({
              name: "position",
              title: "Position",
              type: "string",
            }),
            defineField({
              name: "description",
              title: "Description",
              type: "string",
            }),
          ],
        }),
      ],
    }),
  ],
});

export default teamBlock;
