import { Author } from "./author";
import { FormStandardDocument } from "./formStandardDocument";
import { navLink } from "./header";
import { BenefitsBlock } from "./homepage";
import { GeoPoint, ImageAlt, Project } from "./project";

type ContactType = "Email" | "Phone" | "Link";

export type Image = {
  _key: string;
  _ref: string;
  _type: string;
  url: string;
};

export type Seo = {
  metaTitle: string;
  metaDescription: string;
};

export type UnknownBlock = {
  _key: string;
  _type: string;
};

export type VideoBlock = {
  _key: string;
  videoId: string;
  posterImage: ImageAlt;
};

export type TextContent = {
  _key: string;
  _type: string;
  content: any;
  backgroundColor: string;
  paddingVertical: "none" | "small" | "medium" | "large";
  paddingHorizontal: "none" | "small" | "medium" | "large";
  marginTop: "none" | "small" | "medium" | "large";
  marginBottom: "none" | "small" | "medium" | "large";
  textAlign: "left" | "center" | "right";
  textColor: string;
  backgroundFull: string;
};

export type LandingText = {
  _key: string;
  _type: string;
  content: any;
};

export type LandingIntroBlock = {
  _key: string;
  _type: "landingIntroBlock";
  subtitle: string;
  title: string;
  description: string;
  buttonLabel: string;
  image: ImageAlt;
};

export type LandingTextStart = LandingText;

export type LandingTextFirst = LandingText;

export type LandingTextSecond = LandingText;

export type DoubleImagesBlock = {
  _key: string;
  _type: string;
  leftImage: Image;
  rightImage: Image;
};

export type FullContact = {
  _key: string;
  _type: string;
  icon: Image;
  title: string;
  label: string;
  type: ContactType;
};

export type ContactFullBlock = {
  _key: string;
  _type: string;
  title: string;
  buttonText: string;
  description: string;
  contacts: FullContact[];
  form: FormStandardDocument;
};

export type FormMinimalBlock = {
  _key: string;
  _type: "formMinimalBlock";
  title: string;
  buttonText: string;
  form: FormStandardDocument;
  marginTop?: "small" | "medium" | "large";
  marginBottom?: "small" | "medium" | "large";
};

export type Member = {
  _key: string;
  image: ImageAlt;
  name: string;
  position: string;
  description: string;
};

export type TeamBlock = {
  _key: string;
  _type: string;
  title: string;
  members: Member[];
};

export type LocationBlock = {
  _key: string;
  _type: string;
  title: string;
  location: GeoPoint;
};

// === Типы для imageFullBlock ===

/** Элемент текста с флагом подсветки */
export type TextItem = {
  text: string;
  highlighted: boolean;
};

/** Описание блока: массив текстовых элементов и тег-обёртка */
export type DescriptionFull = {
  textItems: TextItem[];
  tag: "h1" | "h2" | "h3" | "p";
};

/** Основное изображение с альтернативным текстом и соотношением сторон */
export type ImageMain = {
  picture: ImageAlt;
  aspectRatio: "16:9" | "4:3" | "1:1";
};

/** Полный блок изображения с опциональным описанием */
export type ImageFullBlock = {
  _key: string;
  _type: "imageFullBlock";
  title: string;
  imageMain: ImageMain;
  hasDescription: boolean;
  description?: DescriptionFull;
};
// === Конец типов для imageFullBlock ===

// === Типы для DoubleTextBlock ===
export type BlockContentWithStyle = {
  _key: string;
  _type: string;
  content: any;
  backgroundColor: string;
};

export type ContentChoice = {
  type: "text" | "image";
  blockContent?: BlockContentWithStyle;
  image?: ImageAlt;
};

export type DoubleTextBlock = {
  _key: string;
  _type: string;
  doubleTextBlockTitle?: string;
  leftContent: ContentChoice;
  rightContent: ContentChoice;
  isDivider: boolean;
  marginTop?: "small" | "medium" | "large";
  marginBottom?: "small" | "medium" | "large";
  paddingTop?: "small" | "medium" | "large";
  paddingBottom?: "small" | "medium" | "large";
};
// === Конец типов для DoubleTextBlock ===

// === Типы для ButtonBlock ===
export type ButtonBlock = {
  _key: string;
  _type: "buttonBlock";
  buttonText: string;
  justifyContent: "start" | "center" | "end";
  alignItems: "start" | "center" | "end";
  marginTop?: "small" | "medium" | "large";
  marginBottom?: "small" | "medium" | "large";
};
// === Конец типов для ButtonBlock ===

// === Типы для ImageBulletsBlock ===
export type Bullet = {
  _key: string;
  title: string;
  description: string;
};

export type ImageBulletsBlock = {
  _key: string;
  _type: "imageBulletsBlock";
  title: string;
  image: ImageAlt;
  bullets: Bullet[];
};
// === Конец типов для ImageBulletsBlock ===

// === Типы для ReviewsFullBlock ===
export type ReviewFull = {
  _key: string;
  name: string;
  text: any;
  image: ImageAlt;
};
export type ReviewsFullBlock = {
  _key: string;
  _type: "reviewsFullBlock";
  title: string;
  reviews: ReviewFull[];
};
// === Конец типов для ReviewsFullBlock ===

// === Типы для ProjectsSectionBlick ===
export type ProjectsSectionBlock = {
  _key: string;
  _type: "projectsSectionBlock";
  title: string;
  filterCity?: "Paphos" | "Limassol" | "Larnaca";
  filterPropertyType?:
    | "Apartment"
    | "Villa"
    | "Townhouse"
    | "Semi-detached villa"
    | "Office"
    | "Shop";
  projects: Project[];
  filteredProjects?: Project[];
  marginTop?: "small" | "medium" | "large";
  marginBottom?: "small" | "medium" | "large";
};
// === Конец типов для ProjectsSectionBlick ===

// === Типы для LandingProjectsBlock ===
export type LandingProjectsBlock = {
  _key: string;
  _type: "landingProjectsBlock";
  title: string;
  filterCity?: "Paphos" | "Limassol" | "Larnaca";
  filterPropertyType?:
    | "Apartment"
    | "Villa"
    | "Townhouse"
    | "Semi-detached villa"
    | "Office"
    | "Shop";
  projects: Project[];
  filteredProjects?: Project[];
};
// === Конец типов для LandingProjectsBlock ===

export type AccordionBlock = {
  _key: string;
  _type: "accordionBlock";
  items: Array<{
    _key: string;
    question: string;
    answer: any; // Убедитесь, что поле называется 'answer', если оно содержит данные
  }>;
};

// === Типы для FAQBlock ===
export type FaqBlock = {
  _key: string;
  _type: "faqBlock";
  faq: AccordionBlock;
  marginTop?: "small" | "medium" | "large";
  marginBottom?: "small" | "medium" | "large";
};
// === Конец типов для FAQBlock ===

// === Типы для Landing FAQ Block ===
export type LandingFaqBlock = {
  _key: string;
  _type: "landingFaqBlock";
  title: string;
  faq: AccordionBlock;
};
// === Конец типов для Landing FAQ Block ===

// === Типы для HowWeWorkBlock ===
export type HowWeWorkBlock = {
  _key: string;
  _type: "howWeWorkBlock";
  title: string;
  marginTop?: "small" | "medium" | "large";
  marginBottom?: "small" | "medium" | "large";
};
// === Конец типов для HowWeWorkBlock ===

// === Типы для BulletsBlock ===
export type BulletsBlock = {
  _key: string;
  _type: "bulletsBlock";
  title: string;
  marginTop?: "small" | "medium" | "large";
  marginBottom?: "small" | "medium" | "large";
};
// === Конец типов для BulletsBlock ===

// === Типы для TableBlock ===
export type TableRow = {
  _key: string;
  _type: "tableRow";
  cells: string[];
};

export type TableBlock = {
  _key: string;
  _type: "tableBlock";
  columns: string[];
  rows: TableRow[];
  marginTop?: "small" | "medium" | "large";
  marginBottom?: "small" | "medium" | "large";
};
// === Конец типов для TableBlock ===

export type TabsBlock = {
  _key: string;
  _type: string;
  tabTitle: string;
  tabImage: Image;
  tabContent: any;
};

export type Category = {
  _id: string;
  _type: string;
  title: string;
  slug: string;
  language: string;
};

export type RelatedArticle = {
  _id: string;
  title: string;
  category: Category;
  slug: {
    [lang: string]: {
      current: string;
    };
  };
  publishedAt: string;
  previewImage: Image;
};

export type Blog = {
  _id: string;
  _type: string;
  title: string;
  seo: Seo;
  publishedAt: string;
  category: Category;
  author: Author;
  previewImage: ImageAlt;
  excerpt: string;
  contentBlocks: Array<
    | TextContent
    | AccordionBlock
    | ImageFullBlock
    | ButtonBlock
    | FaqBlock
    | FormMinimalBlock
    | ProjectsSectionBlock
    | TableBlock
  >;
  videoBlock: VideoBlock;
  popularProperties: navLink[];
  _updatedAt?: string;
  relatedArticles: RelatedArticle[];
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
