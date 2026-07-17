export type FaqItem = { id: string; question: string; answer: string[] };
export type FaqCategory = { slug: string; label: string; description: string; items: FaqItem[] };

export type FaqPage = {
  categories: FaqCategory[];
  language?: string;
  _translations?: { language: string }[];
};
