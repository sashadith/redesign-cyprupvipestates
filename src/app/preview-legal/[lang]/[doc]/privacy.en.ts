import type { LegalDoc } from "./types";

/* Privacy Policy — English.

   Rewritten 2026-08-21 from the stored singlepages text, which was missing
   several Art. 13/14 GDPR mandatory disclosures. What changed, and why:
     + retention periods (Art. 13(2)(a)) — absent entirely before
     + third-country transfers for Google/Meta (Art. 13(1)(f)) — the old text
       named only the Irish entities and stopped there
     + right to lodge a complaint with a supervisory authority (Art. 13(2)(d))
     + portability / objection / restriction (Arts. 18, 20, 21) — the old text
       offered only "information, correction, blocking, deletion", and
       "blocking" is pre-GDPR BDSG vocabulary
     + right to withdraw consent generally (Art. 7(3)), not just for the newsletter
     + cookies and consent management
     + a statement that no automated decision-making takes place (Art. 13(2)(f))
     + first-party, cookieless site analytics — genuinely running on this site
       (see src/lib/visitorHash.ts) and previously undisclosed
     + CRM storage of enquiries, and the booking/appointment flow
     + a "last updated" date and a changes clause
   Also fixed: a duplicated server-log paragraph, and "Lawyersnecessary".

   Revised again 2026-08-21 after auditing what the site actually loads
   (src/app/[lang]/layout.tsx): the first version named only Google Analytics
   and the Meta Pixel. Google Tag Manager, Google Ads, the LinkedIn Insight
   Tag and Microsoft Clarity were all live and undisclosed — Clarity in
   particular does session recording, which is materially more intrusive than
   visit counting and is now called out by name. Retention figures that had
   been written as concrete periods (30 days / 3 years / 6 years) were NOT
   verified against the server config or the company's actual practice, so
   they are replaced by purpose-based wording; a wrong figure in a privacy
   notice is a promise that has to be kept. The claim that no DPO has been
   appointed was likewise unverified and is gone. Cookie categories now match
   the banner's own three (necessary / analytics / marketing).

   NOT legal advice. This is a substantially more complete draft than what it
   replaces, but it still needs review by a Cyprus-qualified lawyer before it
   goes live. */

export const PRIVACY_EN: LegalDoc = {
  metaTitle: "Privacy Policy — Cyprus VIP Estates",
  metaDescription:
    "How Cyprus VIP Estates (SecretBrand Solutions LTD) collects, uses, shares and protects your personal data, and the rights you have under the GDPR.",
  eyebrow: "Legal",
  title: "Privacy Policy",
  intro:
    "This policy explains what personal data we collect when you use this website or contact us, why we process it, who receives it, how long we keep it, and the rights you can exercise at any time.",
  updatedLabel: "Last updated",
  updated: "2026-08-21",
  tocLabel: "On this page",

  sections: [
    {
      id: "controller",
      title: "1. Who is responsible",
      blocks: [
        { kind: "p", text: "The controller responsible for processing your personal data on this website is:" },
        {
          kind: "list",
          items: [
            "SecretBrand Solutions LTD, trading as “Cyprus VIP Estates”",
            "Palaion Patron Germanou 11, 8011 Paphos, Cyprus",
            "Email: office@cyprusvipestates.com",
            "Phone: +357 99 278 285",
          ],
        },
        {
          kind: "p",
          text: "For any question about your data — access, correction, deletion or anything else in this policy — write to the address above and your request will reach the person responsible.",
        },
      ],
    },
    {
      id: "data-we-collect",
      title: "2. What we collect and why",
      blocks: [
        {
          kind: "definitions",
          items: [
            {
              term: "Server log files",
              text: "Each time a page is requested, our server records the browser type and version, the operating system, the referring URL, the hostname of the requesting device, the time of the request and the IP address. This is technically necessary to deliver the site and to detect abuse. It is not combined with other data sources. Legal basis: Art. 6 (1) (f) GDPR (our legitimate interest in a secure, functioning website).",
            },
            {
              term: "Contact forms and enquiries",
              text: "When you send us an enquiry, we store the details you provide — typically name, contact details, your preferred contact channel and your message — in order to answer you and to handle any follow-up. Enquiries are stored in our customer relationship system so that the colleague looking after you can see the history of your request. Legal basis: Art. 6 (1) (b) GDPR (pre-contractual measures at your request).",
            },
            {
              term: "Appointments",
              text: "If you propose or confirm an appointment through our booking page, we process the times you propose, your time zone and your contact details in order to arrange and confirm the meeting. Legal basis: Art. 6 (1) (b) GDPR.",
            },
            {
              term: "Newsletter",
              text: "If you subscribe, we process your email address to send you our newsletter. Legal basis: Art. 6 (1) (a) GDPR (consent), which you can withdraw at any time.",
            },
            {
              term: "Site analytics (cookieless)",
              text: "We count page views using a daily-rotating, irreversible hash derived from your IP address and browser string. The hash changes every day, is never stored alongside your IP address, and cannot be used to identify you or to recognise you across days. Legal basis: Art. 6 (1) (f) GDPR (our legitimate interest in understanding which content is useful), balanced by the fact that no identifier persists.",
            },
            {
              term: "Google Tag Manager, Google Analytics and Google Ads",
              text: "Only if you consent to analytics and marketing cookies, we load Google Tag Manager (Google Ireland Limited), which in turn activates Google Analytics 4 for reach measurement and Google Ads for conversion measurement and remarketing. Google Tag Manager itself only manages the other tags; it is the tags it loads that process your data. Legal basis: Art. 6 (1) (a) GDPR (consent).",
            },
            {
              term: "Meta Pixel",
              text: "Only with your consent. Provider: Meta Platforms Ireland Limited. It measures whether a visit followed one of our advertisements and lets us reach comparable audiences. Legal basis: Art. 6 (1) (a) GDPR (consent).",
            },
            {
              term: "LinkedIn Insight Tag",
              text: "Only with your consent. Provider: LinkedIn Ireland Unlimited Company. It measures the performance of our LinkedIn campaigns and allows audience targeting there. Legal basis: Art. 6 (1) (a) GDPR (consent).",
            },
            {
              term: "Microsoft Clarity — including session recording",
              text: "Clarity (Microsoft Ireland Operations Limited) shows us how pages are actually used: mouse movement, scrolling, clicks and page interactions, which it can replay as an anonymised session recording and aggregate into heatmaps. This is more far-reaching than plain visit counting, which is why we name it separately here. The Clarity script is loaded on every page, but it is told whether you have consented: without your consent it runs in Microsoft's restricted mode, which does not set cookies and does not build a profile; with your consent it records the full session. Legal basis: Art. 6 (1) (a) GDPR (consent) for the full mode, and Art. 6 (1) (f) GDPR (our legitimate interest in seeing where the site confuses people) for the restricted mode. You can object to the latter at any time under Art. 21.",
            },
          ],
        },
      ],
    },
    {
      id: "recipients",
      title: "3. Who receives your data",
      blocks: [
        {
          kind: "callout",
          text: "Passing your details to a developer or a lawyer is a core part of what we do. It only ever happens for the specific property interest you have told us about.",
        },
        { kind: "p", text: "Depending on your enquiry, your contact details may be shared with:" },
        {
          kind: "list",
          items: [
            "Property developers in Cyprus — to arrange viewings and prepare offers for the properties you are interested in. Legal basis: Art. 6 (1) (b) GDPR.",
            "Independent lawyers — for legal checks and contract drafting, where you ask us to introduce you. They act as separate controllers and are bound by their own professional confidentiality.",
            "Our IT service providers — hosting, email delivery and the systems we use to manage enquiries. These act as processors under Art. 28 GDPR and only on our documented instructions.",
          ],
        },
        {
          kind: "p",
          text: "We do not sell your personal data, and we do not pass it on for anyone else's advertising purposes.",
        },
      ],
    },
    {
      id: "transfers",
      title: "4. Transfers outside the EEA",
      blocks: [
        {
          kind: "p",
          text: "Google, Meta, Microsoft and LinkedIn are contracted through their Irish entities, but processing on their infrastructure can involve transfers to the United States. Those transfers rely on the EU Commission's adequacy decision for the EU–US Data Privacy Framework where the recipient is certified under it, and otherwise on Standard Contractual Clauses under Art. 46 (2) (c) GDPR.",
        },
        {
          kind: "p",
          text: "You can ask us for a copy of the safeguards that apply, using the contact details in section 1.",
        },
      ],
    },
    {
      id: "retention",
      title: "5. How long we keep it",
      blocks: [
        {
          kind: "p",
          text: "We keep personal data only for as long as the purpose it was collected for requires, and after that only where a legal retention duty applies.",
        },
        {
          kind: "list",
          items: [
            "Server log files: only as long as needed to operate the site securely and to investigate faults or abuse, then deleted or anonymised.",
            "Enquiries and the related correspondence: while we are in contact with you about your enquiry, and afterwards only for as long as it may still lead to a follow-up conversation.",
            "Data connected to a concluded transaction: for the period Cypriot commercial and tax law requires us to retain it.",
            "Newsletter subscriptions: until you unsubscribe.",
            "Consent records: for as long as we must be able to demonstrate that consent was given.",
            "Cookieless analytics: aggregate counts only — the daily hash cannot be traced back to a person at any point.",
          ],
        },
        {
          kind: "p",
          text: "If you want to know how long we are holding a particular category of your data, ask us and we will tell you.",
        },
      ],
    },
    {
      id: "cookies",
      title: "6. Cookies and consent",
      blocks: [
        {
          kind: "p",
          text: "Our cookie banner offers the same three categories used throughout this policy:",
        },
        {
          kind: "definitions",
          items: [
            {
              term: "Necessary",
              text: "Required for the site to work — for example remembering your language and your cookie choice itself. Set on the basis of Art. 6 (1) (f) GDPR; these cannot be switched off.",
            },
            {
              term: "Analytics",
              text: "Google Analytics 4 (via Google Tag Manager) and Microsoft Clarity in its full mode. Only set once you have agreed.",
            },
            {
              term: "Marketing",
              text: "Google Ads, the Meta Pixel and the LinkedIn Insight Tag. Only set once you have agreed.",
            },
          ],
        },
        {
          kind: "p",
          text: "You can change or withdraw your choice at any time through the cookie banner; withdrawal does not affect the lawfulness of processing carried out beforehand. You can also block or delete cookies in your browser settings, though parts of the site may then not work as intended.",
        },
      ],
    },
    {
      id: "rights",
      title: "7. Your rights",
      blocks: [
        { kind: "p", text: "Under the GDPR you have the right to:" },
        {
          kind: "list",
          items: [
            "Access — obtain confirmation of whether we process your data, and a copy of it (Art. 15).",
            "Rectification — have inaccurate or incomplete data corrected (Art. 16).",
            "Erasure — have your data deleted where one of the grounds in Art. 17 applies.",
            "Restriction — require that we only store your data while a dispute about it is resolved (Art. 18).",
            "Data portability — receive the data you gave us in a structured, machine-readable format, or have it sent to another controller (Art. 20).",
            "Object — object at any time to processing based on our legitimate interests, and absolutely to processing for direct marketing (Art. 21).",
            "Withdraw consent — at any time, with effect for the future (Art. 7 (3)).",
          ],
        },
        {
          kind: "p",
          text: "To exercise any of these, write to office@cyprusvipestates.com. We answer within one month; if a request is complex we may extend that by two further months and will tell you why.",
        },
        {
          kind: "callout",
          text: "You also have the right to complain to a supervisory authority. In Cyprus this is the Office of the Commissioner for Personal Data Protection, Iasonos 1, 1082 Nicosia (commissioner@dataprotection.gov.cy). You may also complain to the authority where you live or work.",
        },
      ],
    },
    {
      id: "security",
      title: "8. Security",
      blocks: [
        {
          kind: "p",
          text: "This site is served over TLS, so the content you send us is encrypted in transit — your browser shows “https://” and a padlock. We apply technical and organisational measures appropriate to the risk, and restrict access to enquiry data to the colleagues who need it to look after you.",
        },
      ],
    },
    {
      id: "automated-decisions",
      title: "9. Automated decision-making",
      blocks: [
        {
          kind: "p",
          text: "We do not use automated decision-making or profiling that produces legal effects concerning you or similarly significantly affects you, within the meaning of Art. 22 GDPR. Where we use software to help sort or summarise enquiries, a person always decides what happens next.",
        },
      ],
    },
    {
      id: "changes",
      title: "10. Changes to this policy",
      blocks: [
        {
          kind: "p",
          text: "We update this policy when our services or the legal requirements change. The current version always applies, and the date at the top tells you when it was last revised.",
        },
      ],
    },
  ],

  contactTitle: "Questions about your data?",
  contactText:
    "Write to office@cyprusvipestates.com or call +357 99 278 285. We are happy to explain anything in this policy in plain language.",
};
