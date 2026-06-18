export type Seo = {
  metaTitle: string;
  metaDescription: string;
};

export type ProjectsPage = {
  _type: "projectsPage";
  _id: string;
  _rev: string;
  seo: Seo;
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
