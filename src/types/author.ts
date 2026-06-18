import { ImageAlt } from "./project";

export type Author = {
  _id: string;
  name: string;
  position?: string;
  specialization?: string[];
  bio?: string;
  linkedin?: string;
  image?: ImageAlt;
  language: string;
};
