type ContactType = "Email" | "Phone" | "Link";

type Image = {
  _key: string;
  _ref: string;
  _type: string;
  url: string;
};

export type Link = {
  _key: string;
  label: string;
  link: string;
};

export type SocialLink = {
  _key: string;
  label: string;
  link: string;
  icon: Image;
};

export type Paragraph = {
  _key: string;
  paragraph: string;
};

export type Contact = {
  _key: string;
  _type: string;
  icon: Image;
  label: string;
  type: ContactType;
};

export type FooterColumnLink = {
  _key: string;
  label: string;
  url: string;
};

export type FooterColumn = {
  _key: string;
  title: string;
  links: FooterColumnLink[];
};

export type Footer = {
  _type: "footer";
  _id: string;
  _rev: string;
  logo: Image;
  socialLinks: SocialLink[];
  companyTitle: string;
  companyParagraphs: Paragraph[];
  vatNumber: string;
  contactTitle: string;
  contacts: Contact[];
  newsletterTitle: string;
  newsletterButtonLabel: string;
  copyright: string;
  policyLinks: Link[];
  footerColumns: FooterColumn[];
  discklaimer: string;
};
