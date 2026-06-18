import { Seo } from "./blog";

export type NotFoundPage = {
  _type: "notFoundPage";
  _id: string;
  _rev: string;
  title: string;
  seo: Seo;
  textStart: string;
  textEnd: string;
  description: string;
  buttonText: string;
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
