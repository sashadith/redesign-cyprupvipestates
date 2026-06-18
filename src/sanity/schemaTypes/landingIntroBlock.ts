import { defineType, defineField, defineArrayMember } from "sanity";

const landingIntroBlock = defineType({
  name: "landingIntroBlock",
  title: "Landing Intro Block",
  type: "object", // Change to object
  fields: [
    defineField({
      name: "subtitle",
      title: "Subtitle",
      type: "string",
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
    defineField({
      name: "buttonLabel",
      title: "Button Label",
      type: "string",
    }),
    defineField({
      name: "image",
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
  ],
});

export default landingIntroBlock;
