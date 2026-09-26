import type { LegalDoc } from "./types";
import { bidiIsolate, ltrIsolate } from "@/lib/locale";

/* Terms and Conditions - Hebrew (Phase 5b).

   Source is terms.en.ts, section for section: the same thirteen section ids,
   the same block kinds in the same order, the same number of paragraphs and
   list items. Section 12 mirrors the English list of published language
   versions exactly (five since the 2026-09-26 launch); Hebrew was added to all five files together at
   launch, never here first - a translation must not be the first place a
   fact about the product changes (Pass B M4, docs/i18n/reviews/c-legal.md).

   The document title is definite (תנאי השימוש) because every link label on
   the site that points here is definite (Pass B M10).

   Register: formal, impersonal, no marketing vocabulary. The callout in
   section 2 (not a licensed brokerage) is the single most important sentence
   on the page and is kept as blunt in Hebrew as it is in English.

   Latin runs are isolated, never transliterated: company and brand names via
   bidiIsolate(), e-mail and street address via ltrIsolate().

   The English version is the binding one; bindingNote says so under the H1,
   and section 12 repeats it as the operative clause.

   NOT legal advice. Review by a Cyprus-qualified lawyer is still required, as
   for every other locale of this document. */

// REVIEW(he)
export const TERMS_HE: LegalDoc = {
  metaTitle: `תנאי השימוש | ${bidiIsolate("Cyprus VIP Estates")}`,
  metaDescription:
    `התנאים החלים על השימוש באתר ובשירותים של ${bidiIsolate("Cyprus VIP Estates")}, המופעלים בידי ${bidiIsolate("SecretBrand Solutions LTD")}, פאפוס, קפריסין.`,
  eyebrow: "מידע משפטי",
  title: "תנאי השימוש",
  bindingNote: "הנוסח האנגלי של מסמך זה הוא הנוסח המחייב; התרגום לעברית נועד לנוחות בלבד.",
  intro:
    "תנאים אלה חלים על השימוש באתר ועל השירותים שאנחנו מספקים. חשוב לקרוא בעיון דווקא את סעיף 2, שמסביר בדיוק מה אנחנו עושים, ולא פחות חשוב מכך, מה איננו עושים.",
  updatedLabel: "עדכון אחרון",
  updated: "2026-08-21",
  tocLabel: "בעמוד זה",

  sections: [
    {
      id: "scope",
      title: "1. תחולה וספק השירות",
      blocks: [
        { kind: "p", text: "תנאי שימוש אלה חלים על השימוש באתר ובשירותים של:" },
        {
          kind: "list",
          items: [
            `${bidiIsolate("SecretBrand Solutions LTD")}, הפועלת תחת השם "${bidiIsolate("Cyprus VIP Estates")}"`,
            `${ltrIsolate("Palaion Patron Germanou 11, 8011")} פאפוס, קפריסין`,
            `אימייל: ${ltrIsolate("office@cyprusvipestates.com")}`,
          ],
        },
        {
          kind: "p",
          text: "שימוש באתר מהווה הסכמה לתנאים בנוסח התקף במועד הביקור.",
        },
      ],
    },
    {
      id: "nature-of-service",
      title: "2. מה אנחנו עושים ומה איננו",
      blocks: [
        {
          kind: "callout",
          text: `לפי הדין הקפריסאי איננו סוכנות תיווך נדל"ן מורשית. ${bidiIsolate("SecretBrand Solutions LTD")} פועלת אך ורק כסוכנות שיווק וייעוץ.`,
        },
        { kind: "p", text: "בפועל, המשמעות היא:" },
        {
          kind: "list",
          items: [
            `אנחנו מציגים פרויקטים של נדל"ן ומקשרים בין רוכשים פוטנציאליים ליזמים ולעורכי דין עצמאיים.`,
            "איננו פועלים כמתווכים ואיננו כורתים הסכמי רכישה בשם אף אחד.",
            "איננו מספקים ייעוץ משפטי, ייעוץ מס או ייעוץ פיננסי. כאשר נדרשת עצה מקצועית כזו, אנחנו מפנים אתכם לאנשי מקצוע עצמאיים, והם נושאים באחריות לעצה שהם נותנים.",
            "כל הסכם רכישה נכרת אך ורק בינכם לבין היזם או המוכר. איננו צד לו.",
          ],
        },
      ],
    },
    {
      id: "website-use",
      title: "3. השימוש באתר",
      blocks: [
        {
          kind: "p",
          text: "האתר מיועד למסירת מידע. אנחנו שואפים לזמינות רציפה, אך איננו מתחייבים לה, שכן תחזוקה, תקלות טכניות או נסיבות שאינן בשליטתנו עלולות לגרום להפסקות.",
        },
        {
          kind: "p",
          text: "אתם מתחייבים שלא לעשות באתר שימוש בלתי חוקי, שלא לנסות להשיג אליו גישה בלתי מורשית ושלא לחלץ ממנו תוכן באמצעים אוטומטיים למטרות מסחריות מתחרות.",
        },
      ],
    },
    {
      id: "property-information",
      title: "4. מידע על נכסים",
      blocks: [
        {
          kind: "p",
          text: "כל המידע על הנכסים באתר זה, לרבות מחירים, שטחים, תוכניות דירה, זמינות ומועדי מסירה, מגיע מהיזם או מהבעלים הרלוונטי.",
        },
        {
          kind: "list",
          items: [
            "איננו אחראים לדיוק המידע, לשלמותו או לעדכניותו.",
            "תמונות, הדמיות ותצוגות תלת-ממד נועדו להמחשה בלבד ואינן מחייבות מבחינה חוזית.",
            "הזמינות והמחירים עשויים להשתנות בכל עת ובלי הודעה מוקדמת. שום דבר באתר זה אינו מהווה הצעה מחייבת.",
          ],
        },
        {
          kind: "p",
          text: "לפני כל התחייבות יש לאמת את הפרטים המהותיים להחלטה ישירות מול היזם ומול עורך דין מטעמכם.",
        },
      ],
    },
    {
      id: "third-parties",
      title: "5. צדדים שלישיים ואחריות",
      blocks: [
        { kind: "p", text: "אנחנו מקשרים בינכם לבין צדדים שלישיים, ולכן איננו נושאים באחריות בגין:" },
        {
          kind: "list",
          items: [
            "הפרת חוזה, עיכובים בבנייה, ליקויים או חדלות פירעון מצד יזם.",
            "ייעוץ שניתן בידי עורכי דין, יועצי מס או נותני שירותים פיננסיים שהפנינו אתכם אליהם.",
            "תוכן של אתרים חיצוניים שאנחנו מקשרים אליהם (ראו סעיף 7).",
          ],
        },
        {
          kind: "p",
          text: "אין בתנאים אלה כדי לשלול או להגביל את אחריותנו למוות או לנזק גוף שנגרמו ברשלנות, את אחריותנו למרמה, או כל אחריות אחרת שלא ניתן לשלול על פי דין. זכויותיכם הצרכניות על פי חוק אינן נפגעות.",
        },
      ],
    },
    {
      id: "intellectual-property",
      title: "6. קניין רוחני",
      blocks: [
        {
          kind: "p",
          text: "תוכן האתר, לרבות טקסטים, צילומים, סרטונים, גרפיקה ועיצוב, מוגן בזכויות יוצרים ושייך לנו או למי שהעניק לנו רישיון להשתמש בו. שכפול, הפצה או כל שימוש אחר מעבר למותר בדיני זכויות יוצרים מחייבים את הסכמתנו מראש ובכתב.",
        },
      ],
    },
    {
      id: "external-links",
      title: "7. קישורים חיצוניים",
      blocks: [
        {
          kind: "p",
          text: "אתרים חיצוניים שאנחנו מקשרים אליהם אינם בשליטתנו, והתוכן שלהם עשוי להשתנות בכל עת. איננו אחראים לו ואיננו מאמצים אותו. אם קישור מוביל לתוכן בלתי חוקי או בלתי הולם, אפשר להודיע לנו ואנחנו נסיר אותו.",
        },
      ],
    },
    {
      id: "changes",
      title: "8. שינויים בתנאים אלה",
      blocks: [
        {
          kind: "p",
          text: "אנחנו רשאים לתקן תנאים אלה כאשר השירותים שלנו או המסגרת המשפטית משתנים. הנוסח שמפורסם כאן במועד הביקור הוא התקף. התאריך שבראש העמוד מציין מתי הוא עודכן לאחרונה.",
        },
      ],
    },
    {
      id: "severability",
      title: "9. הפרדת סעיפים",
      blocks: [
        {
          kind: "p",
          text: "אם הוראה מהוראות תנאים אלה בטלה או תתבטל, תוקפן של יתר ההוראות אינו נפגע. במקום ההוראה הבטלה תבוא ההוראה החוקית הקרובה ביותר לתכליתה המסחרית.",
        },
      ],
    },
    {
      id: "data-protection",
      title: "10. הנתונים שלכם",
      blocks: [
        {
          kind: "p",
          text: "אופן הטיפול בנתונים האישיים שאתם מוסרים, לרבות מה נאסף, מי מקבל אותם, כמה זמן הם נשמרים ואילו זכויות עומדות לכם, מפורט במדיניות הפרטיות שלנו, שמהווה חלק מתנאים אלה בדרך של הפניה.",
        },
      ],
    },
    {
      id: "dispute-resolution",
      title: "11. יישוב סכסוכים צרכניים",
      blocks: [
        {
          kind: "p",
          text: "איננו חייבים להשתתף בהליכי יישוב סכסוכים בפני גוף בוררות צרכני, ואיננו עושים זאת כיום. אין בכך כדי לפגוע בזכותכם להגיש תביעה לערכאות המוסמכות.",
        },
      ],
    },
    {
      id: "language",
      title: "12. גרסאות שפה",
      blocks: [
        {
          kind: "p",
          text: "תנאים אלה מתפרסמים באנגלית, בגרמנית, בפולנית, ברוסית ובעברית. התרגומים ניתנים לנוחותכם, ובמקרה של הבדל במשמעות בין הנוסחים, הנוסח האנגלי הוא המחייב.",
        },
      ],
    },
    {
      id: "jurisdiction",
      title: "13. הדין החל וסמכות השיפוט",
      blocks: [
        {
          kind: "p",
          text: "הדין החל הוא דין הרפובליקה של קפריסין. סמכות השיפוט הבלעדית בכל מחלוקת נתונה לבתי המשפט בפאפוס, קפריסין.",
        },
        {
          kind: "p",
          text: "אם אתם צרכנים המתגוררים באיחוד האירופי, בחירת דין זו אינה שוללת מכם את ההגנה של הוראות קוגנטיות בדין מדינת מגוריכם, ואתם רשאים גם לנקוט הליכים בבתי המשפט של אותה מדינה.",
        },
      ],
    },
  ],

  contactTitle: "שאלות על התנאים?",
  contactText:
    `אפשר לכתוב לכתובת ${ltrIsolate("office@cyprusvipestates.com")}. נשמח להבהיר כל נקודה לפני שתסתמכו עליה.`,
};
