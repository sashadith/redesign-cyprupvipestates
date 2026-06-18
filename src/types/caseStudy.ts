import {
  Seo,
  TextContent,
  ImageFullBlock,
  DoubleTextBlock,
  FormMinimalBlock,
} from "./blog";
import { ImageAlt, Project } from "./project";

export type ContentBlock =
  | TextContent
  | DoubleTextBlock
  | ImageFullBlock
  | FormMinimalBlock;

export type CaseStudyCategory =
  | "luxury-villa"
  | "apartment"
  | "investment"
  | "relocation"
  | "permanent-residency"
  | "new-development";

export type PropertyType =
  | "villa"
  | "apartment"
  | "penthouse"
  | "townhouse"
  | "plot";

export type ClientOverview = {
  propertyType: PropertyType;
  location: string;
  budget: string;
  purchaseTimeline: string;
};

export type CaseDetails = {
  clientSituation?: ContentBlock;
  requirements?: ContentBlock;
  solution?: ContentBlock;
  selectedProperty?: ContentBlock;
  result?: ContentBlock;
};

export type CaseStudy = {
  _id: string;
  _type: "caseStudy";
  title: string;
  seo: Seo;
  category: CaseStudyCategory;
  fullTitle?: string;
  excerpt: string;
  clientOverview?: ClientOverview;
  previewImage?: ImageAlt;
  caseDetails?: CaseDetails;
  mainContent?: ContentBlock[];
  relatedProjects?: Project[];
  publishedAt?: string;
  _updatedAt?: string;
  language: string;
  slug: {
    [lang: string]: {
      current: string;
    };
  };
  _translations?: Array<{
    slug: {
      [lang: string]: {
        current: string;
      };
    };
  }>;
};
