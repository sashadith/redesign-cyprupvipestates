import type { LegalDoc } from "./types";

/* Terms & Conditions — English.

   Rewritten 2026-08-21 from the stored singlepages text. The substance of the
   original is preserved in full — in particular the "not a licensed
   brokerage" position, which is the single most important statement on the
   page and is now given its own prominent callout rather than a bullet.

   Added: website use and availability, external links, a changes clause, a
   severability clause, consumer-rights wording (the old text had none, and
   these terms are read by EU consumers), and a "last updated" date.

   NOT legal advice — review by a Cyprus-qualified lawyer is still required. */

export const TERMS_EN: LegalDoc = {
  metaTitle: "Terms and Conditions — Cyprus VIP Estates",
  metaDescription:
    "The terms governing the use of the Cyprus VIP Estates website and services, operated by SecretBrand Solutions LTD, Paphos, Cyprus.",
  eyebrow: "Legal",
  title: "Terms and Conditions",
  intro:
    "These terms govern your use of this website and the services we provide. Please read section 2 in particular — it explains exactly what we do and, just as importantly, what we do not do.",
  updatedLabel: "Last updated",
  updated: "2026-08-21",
  tocLabel: "On this page",

  sections: [
    {
      id: "scope",
      title: "1. Scope and provider",
      blocks: [
        { kind: "p", text: "These Terms and Conditions apply to the use of the website and the services of:" },
        {
          kind: "list",
          items: [
            "SecretBrand Solutions LTD, trading as “Cyprus VIP Estates”",
            "Palaion Patron Germanou 11, 8011 Paphos, Cyprus",
            "Email: office@cyprusvipestates.com",
          ],
        },
        {
          kind: "p",
          text: "By using this website you accept these terms in the version current at the time of your visit.",
        },
      ],
    },
    {
      id: "nature-of-service",
      title: "2. What we do — and what we are not",
      blocks: [
        {
          kind: "callout",
          text: "We are not a licensed real estate brokerage under Cyprus law. SecretBrand Solutions LTD operates strictly as a marketing and consulting agency.",
        },
        { kind: "p", text: "Concretely, this means:" },
        {
          kind: "list",
          items: [
            "We present real estate projects and introduce prospective buyers to developers and to independent lawyers.",
            "We do not act as a broker, and we do not conclude purchase agreements on anyone's behalf.",
            "We do not provide legal, tax or financial advice. Where such advice is needed, we introduce you to independent professionals who advise you on their own responsibility.",
            "Any purchase agreement is concluded exclusively between you and the developer or seller. We are not a party to it.",
          ],
        },
      ],
    },
    {
      id: "website-use",
      title: "3. Use of this website",
      blocks: [
        {
          kind: "p",
          text: "The website is provided for information purposes. We aim to keep it available continuously, but we do not warrant uninterrupted availability — maintenance, technical faults or circumstances beyond our control may cause interruptions.",
        },
        {
          kind: "p",
          text: "You agree not to use the site unlawfully, not to attempt to gain unauthorised access to it, and not to extract its content by automated means for competing commercial purposes.",
        },
      ],
    },
    {
      id: "property-information",
      title: "4. Information about properties",
      blocks: [
        {
          kind: "p",
          text: "All property information on this site — prices, sizes, floor plans, availability, completion dates — originates from the respective developer or owner.",
        },
        {
          kind: "list",
          items: [
            "We assume no liability for the accuracy, completeness or timeliness of that information.",
            "Images, renderings and visualisations are illustrative and are not contractually binding.",
            "Availability and prices can change at any time without notice. Nothing on this website constitutes a binding offer.",
          ],
        },
        {
          kind: "p",
          text: "Always verify the details that matter to your decision directly with the developer and with your own lawyer before entering into any commitment.",
        },
      ],
    },
    {
      id: "third-parties",
      title: "5. Third parties and liability",
      blocks: [
        { kind: "p", text: "We act as a connecting bridge between you and third parties. We are therefore not liable for:" },
        {
          kind: "list",
          items: [
            "Breach of contract, construction delays, defects or insolvency on the part of a developer.",
            "Advice given by lawyers, tax advisers or financial service providers we introduce you to.",
            "The content of external websites we link to (see section 7).",
          ],
        },
        {
          kind: "p",
          text: "Nothing in these terms excludes or limits our liability for death or personal injury caused by negligence, for fraud, or for any other liability that cannot lawfully be excluded. Your statutory rights as a consumer are unaffected.",
        },
      ],
    },
    {
      id: "intellectual-property",
      title: "6. Intellectual property",
      blocks: [
        {
          kind: "p",
          text: "The content of this website — text, photographs, videos, graphics and layout — is protected by copyright and belongs to us or to our licensors. Reproduction, distribution or any other use beyond what copyright law permits requires our prior written consent.",
        },
      ],
    },
    {
      id: "external-links",
      title: "7. External links",
      blocks: [
        {
          kind: "p",
          text: "Where we link to external websites, those sites are outside our control. We check links at the time of setting them, but we are not responsible for their content and do not adopt it as our own.",
        },
      ],
    },
    {
      id: "changes",
      title: "8. Changes to these terms",
      blocks: [
        {
          kind: "p",
          text: "We may amend these terms where our services or the legal framework change. The version published here at the time of your visit applies. The date at the top shows when they were last revised.",
        },
      ],
    },
    {
      id: "severability",
      title: "9. Severability",
      blocks: [
        {
          kind: "p",
          text: "If any provision of these terms is or becomes invalid, the validity of the remaining provisions is unaffected. The invalid provision is replaced by the lawful provision that comes closest to its commercial purpose.",
        },
      ],
    },
    {
      id: "jurisdiction",
      title: "10. Governing law and jurisdiction",
      blocks: [
        {
          kind: "p",
          text: "The laws of the Republic of Cyprus apply. The exclusive place of jurisdiction for all disputes is Paphos, Cyprus.",
        },
        {
          kind: "p",
          text: "If you are a consumer resident in the EU, this choice of law does not deprive you of the protection of mandatory provisions of the law of your country of residence, and you may also bring proceedings in the courts of that country.",
        },
      ],
    },
  ],

  contactTitle: "Questions about these terms?",
  contactText:
    "Write to office@cyprusvipestates.com. We will gladly clarify any point before you rely on it.",
};
