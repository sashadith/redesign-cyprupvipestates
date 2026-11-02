import type { LegalDoc } from "./types";

/* Privacy Policy — English (the binding original; de/pl/ru/he follow it section by section).

   Rewritten 2026-08-21 from the stored singlepages text, which was missing
   several Art. 13/14 GDPR mandatory disclosures (retention, third-country
   transfers, complaint right, Arts. 18/20/21, withdrawal of consent, cookies,
   Art. 22, first-party analytics, CRM and booking flow), and revised the same
   day after auditing which tags the site actually loads. Retention figures
   that could not be verified were replaced by purpose-based wording; a wrong
   figure in a privacy notice is a promise that has to be kept.

   Revised 2026-11-02 after a second audit of the code and the server:
     + Meta Conversions API (server-side copy of Lead/Contact, live 2026-11-01)
     + the banner offers one choice (accept all / only necessary), withdrawal via
       the "Cookie settings" footer link — the old text described three
       categories to choose from and a language cookie that does not exist
     + cookie names and lifetimes that are set in our own code (cookieConsent
       180 days, cve_attr 90 days) and the tab-only attribution storage
     + the first-party analytics description was too strong: the daily hash is
       pseudonymous, not anonymous, and the full browser string, country and
       campaign parameters are stored with each page view
     + sources other than our own forms (Meta lead forms, partner
       introductions, WhatsApp/e-mail correspondence) — Art. 14
     + personal presentation links and what they record
     + internal notifications via Telegram (UAE) and WhatsApp — since T3
       (src/lib/chatPrivacy.ts) they carry the client's name (operator,
       2026-11-02; Art. 49 (1) (b)), never contact details or a message — Hostinger, Anthropic (AI assistance),
       Zoom, map tiles / embedded content
     + the visitor code is keyed with a secret (ANALYTICS_SALT, privacy T1)
     + verified figures only: server logs 14 days (logrotate), deleted enquiries
       purged 90 days after deletion, links valid 30 days, consent cookie 180 days
   The legal basis for the tab-only attribution storage is marked for the lawyer's review in the change list given to the
   operator; the wording here describes what happens, it does not settle that.

   NOT legal advice — needs review by a Cyprus-qualified lawyer. */

export const PRIVACY_EN: LegalDoc = {
  metaTitle: "Privacy Policy — Cyprus VIP Estates",
  metaDescription:
    "How Cyprus VIP Estates (SecretBrand Solutions LTD) collects, uses, shares and protects your personal data, and the rights you have under the GDPR.",
  eyebrow: "Legal",
  title: "Privacy Policy",
  intro:
    "This policy explains what personal data we collect when you use this website or contact us, why we process it, who receives it, how long we keep it, and the rights you can exercise at any time.",
  updatedLabel: "Last updated",
  updated: "2026-11-02",
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
              text: "Each time a page is requested, our server records the page requested, the browser type and version, the operating system, the referring URL, the time of the request and the IP address. This is technically necessary to deliver the site and to detect abuse. It is not combined with other data sources. Legal basis: Art. 6 (1) (f) GDPR (our legitimate interest in a secure, functioning website).",
            },
            {
              term: "Enquiries and forms",
              text: "When you send us an enquiry — through a contact form, the ROI calculator, a request for one of our free guides or the partner cooperation form — we store what you enter: typically name, email address, phone number, your preferred contact channel and your message, plus any optional answers you give (for example budget, timeline, property type or nationality). We also note the page you sent it from and how you reached our site (see “Campaign attribution”). We answer by email, phone or WhatsApp, send you the guide or calculation you asked for, and keep the enquiry in our customer relationship system so that the colleague looking after you can see its history. Legal basis: Art. 6 (1) (b) GDPR (pre-contractual measures at your request).",
            },
            {
              term: "Correspondence by email and WhatsApp",
              text: "Messages you exchange with us by email or WhatsApp are filed with your enquiry, so that whoever answers you knows what has already been discussed. Legal basis: Art. 6 (1) (b) GDPR, and Art. 6 (1) (f) GDPR (our legitimate interest in a complete record of our advice).",
            },
            {
              term: "Enquiries through Facebook and Instagram lead forms",
              text: "If you fill in a lead form inside one of our advertisements on Facebook or Instagram, Meta Platforms Ireland Limited passes us the details you entered there (typically name, contact details and your answers). We handle them like any other enquiry. Legal basis: Art. 6 (1) (b) GDPR.",
            },
            {
              term: "Introductions by our partners",
              text: "If a partner — for example another agent or adviser — introduced you to us, we received your details from that partner. The partner can follow the stage of their introduction and the property presentations we prepared in our partner portal. Legal basis: Art. 6 (1) (b) GDPR and Art. 6 (1) (f) GDPR (our legitimate interest in working with the partners who introduce clients to us).",
            },
            {
              term: "Personal property presentations",
              text: "We may send you a personal link to a selection of properties. When you open it we record when and for how long you looked at it and which properties you marked as favourites, and the colleague who prepared it is notified, so that we can follow up on what actually interests you. The link expires after 30 days unless we agree otherwise. Legal basis: Art. 6 (1) (b) GDPR and Art. 6 (1) (f) GDPR (our legitimate interest in tailoring our advice).",
            },
            {
              term: "Appointments",
              text: "If you propose or confirm an appointment through our booking page, we process the times you propose, your time zone and your contact details in order to arrange and confirm the meeting. If we agree to meet by video call, the provider of the video service we use (for example Zoom) processes the data needed to connect the call. Legal basis: Art. 6 (1) (b) GDPR.",
            },
            {
              term: "Newsletter",
              text: "If you subscribe, we process your email address to send you our newsletter. Legal basis: Art. 6 (1) (a) GDPR (consent), which you can withdraw at any time by writing to office@cyprusvipestates.com.",
            },
            {
              term: "Site analytics (our own, without cookies)",
              text: "We count page views on our own server, without cookies and without any third party. For each page view we store the page and language, the domain of the site that referred you, your browser string and device type, the country derived from your IP address, any campaign parameters in the link (utm_source, utm_medium, utm_campaign), whether you have answered the cookie banner, and a code computed from your IP address, your browser string, the date and a secret key held only on our server; that code changes every day, cannot be traced back to you without that key, and your IP address itself is not stored. On project pages we also note how far you scroll and which buttons you use. We use these statistics only in aggregate to see which content is useful, never to identify you. Legal basis: Art. 6 (1) (f) GDPR (our legitimate interest in understanding how the site is used).",
            },
            {
              term: "Campaign attribution",
              text: "If you arrive through an advertisement, a campaign link or a partner’s referral link, your browser keeps the source of the visit (campaign parameters, ad click identifiers such as gclid or fbclid, the referring address and a partner code) in the storage of the current browser tab, which is cleared when you close the tab. If you send an enquiry during that visit, the source is saved with it so that we know which campaign or partner brought you to us. Only if you accept cookies do we also keep it in a cookie (“cve_attr”) for 90 days, so that an enquiry you send later is attributed correctly. Legal basis: Art. 6 (1) (f) GDPR (our legitimate interest in knowing which partner or campaign an enquiry came from) for the tab storage, and Art. 6 (1) (a) GDPR (consent) for the cookie.",
            },
            {
              term: "Google Tag Manager, Google Analytics and Google Ads",
              text: "Only if you accept cookies, we load Google Tag Manager (Google Ireland Limited), which in turn activates Google Analytics 4 for reach measurement and Google Ads for conversion measurement and remarketing. Google Tag Manager itself only manages the other tags; it is the tags it loads that process your data. Legal basis: Art. 6 (1) (a) GDPR (consent).",
            },
            {
              term: "Meta Pixel",
              text: "Only with your consent. Provider: Meta Platforms Ireland Limited. It measures whether a visit followed one of our advertisements and lets us reach comparable audiences. Legal basis: Art. 6 (1) (a) GDPR (consent).",
            },
            {
              term: "Meta Conversions API",
              text: "Only if you have accepted cookies, we also report two events directly from our server to Meta Platforms Ireland Limited: sending an enquiry (“Lead”) and getting in touch by WhatsApp, phone or email (“Contact”). For an enquiry we send your email address and phone number in pseudonymised form (as SHA-256 hash values, never in plain text); for both events we send your IP address, your browser string, the address of the page and the Meta cookie identifiers (_fbp, _fbc). An event ID ensures that Meta counts an event only once, even when it arrives from both your browser and our server. Meta uses this data to measure and improve our advertising; we are jointly responsible with Meta for this processing (Art. 26 GDPR). Legal basis: Art. 6 (1) (a) GDPR (consent).",
            },
            {
              term: "LinkedIn Insight Tag",
              text: "Only with your consent. Provider: LinkedIn Ireland Unlimited Company. It measures the performance of our LinkedIn campaigns and allows audience targeting there. Legal basis: Art. 6 (1) (a) GDPR (consent).",
            },
            {
              term: "Microsoft Clarity — including session recording",
              text: "Clarity (Microsoft Ireland Operations Limited) shows us how pages are actually used: mouse movement, scrolling, clicks and page interactions, which it can replay as an anonymised session recording and aggregate into heatmaps. This is more far-reaching than plain visit counting, which is why we name it separately here. The Clarity script is loaded on every page, but it is told whether you have consented: without your consent it runs in Microsoft’s restricted mode, which does not set cookies and does not build a profile; with your consent it records the full session. Legal basis: Art. 6 (1) (a) GDPR (consent) for the full mode, and Art. 6 (1) (f) GDPR (our legitimate interest in seeing where the site confuses people) for the restricted mode. You can object to the latter at any time under Art. 21.",
            },
            {
              term: "Maps and other embedded content",
              text: "To display maps, some pages load map tiles directly from OpenFreeMap and the OpenStreetMap Foundation, and older map views load marker images from Cloudflare’s content network. The phone number field loads small country-flag images from GitHub Pages, and some pages embed videos from YouTube (Google). When your browser loads such content, the provider receives your IP address and browser information, as with any request on the internet. Legal basis: Art. 6 (1) (f) GDPR (our legitimate interest in showing locations and videos in a usable way).",
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
        { kind: "p", text: "Depending on your enquiry, your data may be received by:" },
        {
          kind: "list",
          items: [
            "Property developers in Cyprus — to register you as our client and to arrange viewings and offers for the properties you are interested in. For the registration we send your name, your property interest and budget and a partly masked phone number; if you go ahead with a viewing or an offer, the developer receives the contact details needed for it. Legal basis: Art. 6 (1) (b) GDPR.",
            "Independent lawyers — for legal checks and contract drafting, where you ask us to introduce you. They act as separate controllers and are bound by their own professional confidentiality.",
            "The partner who introduced you, if any — they see the stage of their introduction and the presentations we prepared (see section 2).",
            "Our team’s messaging services — when a new enquiry arrives, our team is alerted on Telegram (Telegram FZ-LLC, United Arab Emirates) and WhatsApp (WhatsApp Ireland Limited). These alerts, and the reminders our team receives on Telegram, show your first and last name, the type of enquiry, the options you selected (such as budget range or preferred way of contact) and a link to our customer database, which requires a login. They never contain your contact details or message. We correspond with you on WhatsApp if you choose it.",
            "Our IT service providers, acting as processors under Art. 28 GDPR and only on our documented instructions: Hostinger International Ltd. (server hosting and email), Anthropic (an AI assistant our team uses to summarise enquiries, draft replies and sort developers’ answers — it sees the content of the enquiry and its history), and the video-call provider for meetings you agree to.",
            "Meta, Google, LinkedIn and Microsoft — as described in section 2, and only with your consent where section 2 says so.",
          ],
        },
        {
          kind: "p",
          text: "We do not sell your personal data, and we do not pass it on for anyone else’s advertising purposes.",
        },
      ],
    },
    {
      id: "transfers",
      title: "4. Transfers outside the EEA",
      blocks: [
        {
          kind: "p",
          text: "Google, Meta, Microsoft and LinkedIn are contracted through their Irish entities, but processing on their infrastructure can involve transfers to the United States, as can our use of Anthropic, Zoom, Cloudflare and GitHub. Those transfers rely on the EU Commission’s adequacy decision for the EU–US Data Privacy Framework where the recipient is certified under it, and otherwise on Standard Contractual Clauses under Art. 46 (2) (c) GDPR.",
        },
        {
          kind: "p",
          text: "Our team alerts on Telegram, whose operator is based in the United Arab Emirates, a country without an EU adequacy decision, show your name but contain no contact details or message (see section 3). We pass your name to Telegram only to handle your enquiry promptly at your request (Art. 49 (1) (b) GDPR). Updates we send on Telegram to a partner who introduced you carry only a reference number and the stage of the introduction.",
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
            "Server log files: 14 days, then deleted.",
            "Enquiries, correspondence and presentation views: while we are in contact with you about your enquiry, and afterwards only for as long as it may still lead to a follow-up conversation. When we delete an enquiry, it is removed permanently from our system after 90 days.",
            "Data connected to a concluded transaction: for the period Cypriot commercial and tax law requires us to retain it.",
            "Newsletter subscriptions: until you unsubscribe.",
            "Your cookie choice: stored in your browser for 180 days, after which we ask again. The campaign-attribution cookie (only with consent): 90 days. The tab storage: until you close the tab.",
            "Links we send you: download links for our guides and personal presentation links expire after 30 days.",
            "Site statistics: kept only as the pseudonymous records described in section 2, and deleted once they are no longer needed for comparing the use of the site over time.",
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
          text: "Our cookie banner gives you one choice: accept all optional cookies, or allow only the necessary ones. Accepting covers the Analytics and Marketing categories below; declining leaves only what is necessary.",
        },
        {
          kind: "definitions",
          items: [
            {
              term: "Necessary",
              text: "Required for the site to work: the cookie “cookieConsent”, which remembers your choice for 180 days, and the tab storage for campaign attribution described in section 2. Your language is part of the page address, so no cookie is needed for it. Set on the basis of Art. 6 (1) (f) GDPR.",
            },
            {
              term: "Analytics",
              text: "Google Analytics 4 (via Google Tag Manager) and Microsoft Clarity in its full mode, which set their own cookies (for example _ga, _clck, _clsk). Only set once you have agreed.",
            },
            {
              term: "Marketing",
              text: "Google Ads, the Meta Pixel and Conversions API and the LinkedIn Insight Tag, which set their own cookies (for example _gcl_au, _fbp, _fbc and LinkedIn’s li_ cookies), and our campaign-attribution cookie “cve_attr” (90 days). Only set once you have agreed.",
            },
          ],
        },
        {
          kind: "p",
          text: "You can change or withdraw your choice at any time with the “Cookie settings” link at the bottom of every page; if you withdraw, the page reloads without the optional tools. Withdrawal does not affect the lawfulness of processing carried out beforehand. You can also block or delete cookies in your browser settings, though parts of the site may then not work as intended.",
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
          text: "We do not use automated decision-making or profiling that produces legal effects concerning you or similarly significantly affects you, within the meaning of Art. 22 GDPR. Our software suggests properties that match the preferences you gave us, and our team uses an AI assistant to summarise enquiries and draft replies (see section 3); a person always reviews the result and decides what happens next.",
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
