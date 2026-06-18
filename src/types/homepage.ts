import {
  DoubleTextBlock,
  FaqBlock,
  ReviewsFullBlock,
  TextContent,
} from "./blog";
import { ImageAlt } from "./project";
import { CaseStudy } from "./caseStudy";

export type City = "Paphos" | "Limassol" | "Larnaca";
export type PropertyType = "Apartment" | "Villa";

export type Translation = {
  path: string;
  language: string;
};

export type Seo = {
  metaTitle: string;
  metaDescription: string;
};

export type Image = {
  _key: string;
  _ref: string;
  _type: string;
  url: string;
};

export type ListItem = {
  _key: string;
  _type: string;
  listItem: string;
};

export type File = {
  _key: string;
  _ref: string;
  _type: string;
  url: string;
};

export type Brochure = {
  _key: string;
  _type: string;
  logo: Image;
  title: string;
  subtitle: string;
  description: string;
  list: ListItem[];
  buttonLabel: string;
  image: Image;
};

export type HeroBlock = {
  _key?: string;
  _type: "heroBlock";
  video: {
    _type: "file";
    asset?: {
      _ref: string;
      url: string;
    };
  };
  posterImage?: Image;
  heroTitle: string;
  heroDescription?: string;
  type?: "link" | "button";
  linkLabel?: string;
  linkDestination?: string;
  buttonLabel?: string;
};

export type Slide = {
  _key: string;
  _type: string;
  image: Image;
  title: string;
  description: string;
  type: "link" | "button";
  linkLabel?: string;
  linkDestination?: string;
  buttonLabel?: string;
};

export type Bullet = {
  _key: string;
  _type: string;
  image: Image;
  description: string;
};

export type DescriptionField = any;

export type AboutBlock = {
  _key: string;
  _type: string;
  title: string;
  description: string;
  bullets: Bullet[];
};

export type DescriptionBlock = {
  _key: string;
  _type: string;
  title: string;
  descriptionFields: {
    _key: string;
    _type: string;
    descriptionField: DescriptionField;
  }[];
};

export type Logo = {
  _key: string;
  _type: string;
  image: ImageAlt;
};

export type Counting = {
  _key: string;
  _type: "counting";
  conuntNumber: number;
  sign: string;
};

export type Benefit = {
  _key: string;
  _type: "benefits";
  counting: Counting;
  title: string;
  description: string;
};

export type BenefitsBlock = {
  _key: string;
  _type: "benefitsBlock";
  title: string;
  benefits: Benefit[];
};

export type Step = {
  _key: string;
  _type: "steps";
  icon: Image;
  text: string;
};

export type HowWeWorkBlock = {
  _key: string;
  _type: "howWeWorkBlock";
  title: string;
  steps: Step[];
  description: string;
};

export type Review = {
  _key: string;
  _type: string;
  reviewText: any;
  name: string;
};

export type ReviewsBlock = {
  _key: string;
  _type: string;
  title: string;
  reviews: Review[];
};

export type LogosBlock = {
  _key: string;
  _type: string;
  title: string;
  logos: Logo[];
};

export type Project = {
  _key: string;
  _type: string;
  title: string;
  description: string;
  image: Image;
  city: City;
  propertyType: PropertyType;
  adress: string;
  flatsAmount: string;
  area: string;
  price: string;
  buttonLabel: string;
  buttonAltLabel: string;
};

export type ProjectsBlock = {
  _key: string;
  _type: string;
  title: string;
  projects: Project[];
};

export type FeaturedProjectReference = {
  _key: string;
  _type: "reference";
  _ref: string;
};

export type FeaturedProject = {
  _id: string;
  _type: string;
  title: string;
  slug: string;
  previewImage: ImageAlt;
  isSold: boolean;
  keyFeatures: {
    price: number;
    bedrooms: number;
    coveredArea: number;
    plotSize: number;
  };
};

export type FeaturedProjectsBlock = {
  _key?: string;
  _type?: string;
  title: string;
  description: string;
  projects: FeaturedProject[];
};

export type FaqSection = {
  faqTitle?: string;
  faq?: FaqBlock;
};

export type CitiesBlockItem = {
  _key: string;
  _type: string;
  image: ImageAlt;
  city: string;
  link: string;
};

export type CitiesBlock = {
  _key?: string;
  _type?: string;
  title: string;
  cities: CitiesBlockItem[];
};

export type FeaturedCaseStudiesBlock = {
  title?: string;
  description?: string;
  caseStudies?: CaseStudy[];
  button?: {
    label?: string;
    url?: string;
  };
};

export type Homepage = {
  _type: "homepage";
  _id: string;
  _rev: string;
  title: string;
  seo: Seo;
  heroBlock: HeroBlock;
  sliderMain: Slide[];
  homepageTitle: string;
  brochureBlock: Brochure;
  featuredProjectsBlock: FeaturedProjectsBlock;
  citiesBlock: CitiesBlock;
  aboutBlock: AboutBlock;
  descriptionBlock: DescriptionBlock;
  projectsBlock: ProjectsBlock;
  logosBlock: LogosBlock;
  parallaxImage: Image;
  benefitsBlock: BenefitsBlock;
  contentBlocks?: Array<TextContent | DoubleTextBlock>;
  howWeWorkBlock: HowWeWorkBlock;
  faqSection?: FaqSection;
  featuredCaseStudiesBlock?: FeaturedCaseStudiesBlock;
  reviewsFullBlock: ReviewsFullBlock;
  reviewsBlock: ReviewsBlock;
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
