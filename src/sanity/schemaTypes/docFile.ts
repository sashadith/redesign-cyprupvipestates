// schemaTypes/file.ts
import { defineField, defineType } from "sanity";

const docFile = defineType({
  name: "docFile",
  title: "Document File",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: {
        source: "title",
        maxLength: 96,
      },
    }),
    defineField({
      name: "file",
      title: "File",
      type: "file",
      options: {
        accept: ".pdf,.jpg,.jpeg,.png,.gif,.webp", // Разрешённые типы
      },
    }),
  ],
});

export default docFile;
