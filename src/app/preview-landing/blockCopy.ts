/* Copy and icons for the two fixed-content blocks.

   bulletsBlock and howWeWorkBlock carry only a title in the CMS — their
   items have always lived in the component, one list per language. Moved
   here so the old renderer and the redesigned one read the same source
   instead of the copy being typed out a second time; when the old
   components go, this file stays.
   ===================================================================== */

export const BULLETS_ICONS: string[] = [
  "/uploads/files/ba3f4d2b7dfab88f974568c6e48bfeb05887cc62.png",
  "/uploads/files/6b42b682c9ad5404806c7076b27c570cf6f6aaee.png",
  "/uploads/files/df9081dc26b9a47b1f91875c3d202a8f2312ed0e.png",
  "/uploads/files/d69fd9657c815c5f89b217219f6a11f28ef08845.png",
  "/uploads/files/7f24ab0216a613135e82ce4af1781546f1aceadc.png",
  "/uploads/files/ee54c07265e200b7e25ae8586e474a337c225870.png",
];

export const BULLETS_TEXT: Record<string, string[]> = {
  de: [
    "340 SONNENTAGE IM JAHR",
    "MITGLIED DER EUROPÄISCHEN UNION",
    "EINES DER BESTEN STEUERSYSTEME",
    "ausgezeichnete Lebensqualität",
    "SEHR HOHER BILDUNGSSTANDARD",
    "MOdernes gesundheitssystem",
  ],
  en: [
    "340 SUNNY DAYS A YEAR",
    "MEMBER OF THE EUROPEAN UNION",
    "ONE OF THE BEST TAX SYSTEMS",
    "excellent quality of life",
    "VERY HIGH STANDARD OF EDUCATION",
    "MODERN healthcare system",
  ],
  pl: [
    "340 SŁONECZNYCH DNI W ROKU",
    "CZŁONEK UNII EUROPEJSKIEJ",
    "JEDEN Z NAJLEPSZYCH SYSTEMÓW KONTROLI",
    "doskonała jakość życia",
    "BARDZO WYSOKIE STANDARDY EDUKACYJNE",
    "NOWOCZESNY system opieki zdrowotnej",
  ],
  ru: [
    "340 СОЛНЕЧНЫХ ДНЕЙ В ГОДУ",
    "Расположение в ЕС",
    "Комфортная налоговая система",
    "отличное качество жизни",
    "ВЫСОКИЕ стандарты образования",
    "СОВРЕМЕННАЯ система здравоохранения",
  ],
};

export const STEPS_ICONS: string[] = [
  "/uploads/images/010e554d53e8a2f99f7d779b88ad4802ea879931-500x500.svg",
  "/uploads/images/ea98b4b1814fb2a981c5db0f004a959d3df14989-500x500.svg",
  "/uploads/images/34191203d1e6add0437bc90f08afd32a2bb00102-500x500.svg",
  "/uploads/images/fddcb74dc9aa266cf6c1fa5bbafddc4f09f037ad-500x500.svg",
  "/uploads/images/01fd70faab96a48e121b9588c547e3a711cce430-500x500.svg",
  "/uploads/images/b2beb1ac8dbcd8bbcc7ce08387c37268c8c162be-500x500.svg",
];

export const STEPS_TEXT: Record<string, string[]> = {
  de: [
    "Sie kontaktieren uns über das Formular auf unserer Website",
    "Wir melden uns bei Ihnen und gehen Ihre Wünsche durch",
    "Sie planen mit uns zusammen Ihre Reise nach Zypern",
    "Wir besichtigen gemeinsam alle passenden Projekte",
    "Sie unterzeichnen den Kaufvertrag mit dem Bauunternehmer",
    "Nach Fertigstellung übergeben wir Ihnen feierlich die Schlüssel",
  ],
  en: [
    "You contact us via the form on our website",
    "We will contact you and discuss your requirements",
    "You plan your trip to Cyprus with us",
    "We visit all suitable projects together",
    "You sign the purchase agreement with the developer",
    "After completion, we will ceremoniously hand over the keys to you",
  ],
  pl: [
    "Skontaktuj się z nami za pomocą formularza na naszej stronie internetowej",
    "Wizyta na mieSkontaktujemy się z Tobą i omówimy Twoje życzeniajscu",
    "Zaplanuj z nami swoją podróż na Cypr",
    "Wspólnie odwiedzimy wszystkie odpowiednie projekty",
    "Podpisujesz umowę kupna z wykonawcą",
    "Po zakończeniu prac uroczyście przekażemy Państwu klucze",
  ],
  ru: [
    "Вы связываетесь с нами через форму на нашем сайте",
    "Мы быстро ответим вам и обсудим ваши пожелания",
    "Вы планируете свою поездку на Кипр вместе с нами",
    "Мы посетим все подходящие объекты вместе",
    "Вы подписываете договор купли-продажи с подрядчиком",
    "После завершения строительства мы торжественно передадим вам ключи",
  ],
};

/* Fallback heading for the FAQ section. Most of these pages never filled the
   block's title field — they authored the heading as a prose block just above
   the FAQ instead (26 of 45). That one is lifted into the section; the rest
   fall back to this, the wording the CMS uses everywhere it was filled in. */
export const FAQ_TITLE: Record<string, string> = {
  en: "Frequently asked questions",
  de: "Häufig gestellte Fragen",
  pl: "Najczęściej zadawane pytania",
  ru: "Часто задаваемые вопросы",
};
