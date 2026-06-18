import { defineType, defineField, defineArrayMember } from "sanity";

const locationBlock = defineType({
  name: "locationBlock",
  title: "Location Block",
  type: "object",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
    }),
    defineField({
      name: "location",
      title: "Location",
      type: "geopoint",
      validation: (Rule) => Rule.required(),
    }),
  ],
});

export default locationBlock;
