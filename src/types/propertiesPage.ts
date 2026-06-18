export type PropertiesPage = {
  _type: "propertiesPage";
  _id: string;
  _rev: string;
  metaTitle: string;
  metaDescription: string;
  title: string;
  language: string;
  slug: {
    [lang: string]: {
      current: string;
    };
  };
  _translations: [
    {
      slug: {
        [lang: string]: {
          current: string;
        };
      };
    },
  ];
};
