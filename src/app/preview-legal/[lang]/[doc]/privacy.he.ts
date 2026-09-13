import type { LegalDoc } from "./types";
import { bidiIsolate, ltrIsolate } from "@/lib/locale";

/* Privacy Policy - Hebrew (Phase 5b).

   Source is privacy.en.ts, section for section: the same ten section ids, the
   same block kinds in the same order, the same number of paragraphs and list
   items. Nothing was added and nothing was dropped; where the English text
   uses an em dash as a parenthesis, the Hebrew splits the sentence instead
   (style guide section 3).

   Register: formal, impersonal, no marketing vocabulary. Address forms follow
   style guide section 2 - nominal and infinitive constructions first, male
   plural only where an address is unavoidable.

   Latin runs are isolated, never transliterated: brand and company names and
   the vendor names via bidiIsolate(), e-mail, phone, street address and the
   https scheme via ltrIsolate(). GDPR article citations stay Latin on purpose
   (style guide section 4: legal designations are not transliterated) - a
   Hebrew letter for the sub-paragraph "(f)" would be unresolvable against the
   regulation itself.

   The English version is the binding one; bindingNote says so under the H1.

   NOT legal advice, and the Hebrew adds no assertion the English does not
   make. Review by a Cyprus-qualified lawyer is still required, as for every
   other locale of this document. */

// REVIEW(he)
export const PRIVACY_HE: LegalDoc = {
  metaTitle: `מדיניות פרטיות | ${bidiIsolate("Cyprus VIP Estates")}`,
  metaDescription:
    `כיצד ${bidiIsolate("Cyprus VIP Estates")} אוספת נתונים אישיים, משתמשת בהם, למי הם נמסרים, כמה זמן הם נשמרים ואילו זכויות עומדות לכם לפי ${bidiIsolate("GDPR")}.`,
  eyebrow: "מידע משפטי",
  title: "מדיניות פרטיות",
  bindingNote: "הנוסח האנגלי של מסמך זה הוא הנוסח המחייב; התרגום לעברית נועד לנוחות בלבד.",
  intro:
    "מדיניות זו מסבירה אילו נתונים אישיים נאספים בעת שימוש באתר או פנייה אלינו, לשם מה הם מעובדים, מי מקבל אותם, כמה זמן הם נשמרים ואילו זכויות עומדות לכם בכל עת.",
  updatedLabel: "עדכון אחרון",
  updated: "2026-08-21",
  tocLabel: "בעמוד זה",

  sections: [
    {
      id: "controller",
      title: "1. מי אחראי לעיבוד",
      blocks: [
        { kind: "p", text: "הגורם האחראי לעיבוד הנתונים האישיים באתר זה הוא:" },
        {
          kind: "list",
          items: [
            `${bidiIsolate("SecretBrand Solutions LTD")}, הפועלת תחת השם "${bidiIsolate("Cyprus VIP Estates")}"`,
            `${ltrIsolate("Palaion Patron Germanou 11, 8011")} פאפוס, קפריסין`,
            `אימייל: ${ltrIsolate("office@cyprusvipestates.com")}`,
            `טלפון: ${ltrIsolate("+357 99 278 285")}`,
          ],
        },
        {
          kind: "p",
          text: "בכל שאלה על הנתונים שלכם, לרבות עיון, תיקון, מחיקה או כל נושא אחר במדיניות זו, יש להשתמש בפרטי הקשר שלמעלה. הבקשה תגיע לגורם האחראי.",
        },
      ],
    },
    {
      id: "data-we-collect",
      title: "2. מה נאסף ולשם מה",
      blocks: [
        {
          kind: "definitions",
          items: [
            {
              term: "קובצי יומן של השרת",
              text: `בכל בקשה לטעינת עמוד השרת רושם את סוג הדפדפן וגרסתו, את מערכת ההפעלה, את כתובת ההפניה, את שם המארח של המכשיר הפונה, את מועד הבקשה ואת כתובת ה-${bidiIsolate("IP")}. הרישום נחוץ מבחינה טכנית להצגת האתר ולזיהוי שימוש לרעה, ואינו מצטלב עם מקורות נתונים אחרים. הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (f) GDPR")} (אינטרס לגיטימי באתר מאובטח ותקין).`,
            },
            {
              term: "טפסי יצירת קשר ופניות",
              text: `כאשר נשלחת אלינו פנייה, אנחנו שומרים את הפרטים שנמסרו בה: בדרך כלל שם, פרטי קשר, דרך ההתקשרות המועדפת ותוכן ההודעה. הפרטים משמשים למתן מענה ולטיפול בהמשך, ונשמרים במערכת ניהול הלקוחות שלנו, כדי שהיועץ המלווה אתכם יראה את היסטוריית הבקשה. הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (b) GDPR")} (פעולות טרום חוזיות לבקשתכם).`,
            },
            {
              term: "תיאום פגישות",
              text: `כאשר מוצע או מאושר מועד דרך עמוד תיאום הפגישות, אנחנו מעבדים את השעות שהוצעו, את אזור הזמן ואת פרטי הקשר שלכם, כדי לקבוע את הפגישה ולאשר אותה. הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (b) GDPR")}.`,
            },
            {
              term: "ניוזלטר",
              text: `בהרשמה לניוזלטר אנחנו מעבדים את כתובת האימייל שלכם כדי לשלוח אותו. הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (a) GDPR")} (הסכמה), שאפשר לבטל בכל עת.`,
            },
            {
              term: "מדידת שימוש באתר (ללא עוגיות)",
              text: `צפיות בעמודים נספרות באמצעות ערך גיבוב חד כיווני שמתחלף מדי יום ונגזר מכתובת ה-${bidiIsolate("IP")} וממחרוזת הדפדפן. הערך משתנה בכל יום, אינו נשמר לצד כתובת ה-${bidiIsolate("IP")}, ואי אפשר לזהות באמצעותו אדם או לזהות אותו שוב בימים אחרים. הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (f) GDPR")} (אינטרס לגיטימי בהבנה אילו תכנים מועילים), לצד העובדה שלא נשמר מזהה קבוע.`,
            },
            {
              term: `${bidiIsolate("Google Tag Manager")}, ${bidiIsolate("Google Analytics")} ו-${bidiIsolate("Google Ads")}`,
              text: `רק בכפוף להסכמה לעוגיות אנליטיקה ושיווק נטען ${bidiIsolate("Google Tag Manager")} (${bidiIsolate("Google Ireland Limited")}), והוא מפעיל את ${bidiIsolate("Google Analytics 4")} למדידת חשיפה ואת ${bidiIsolate("Google Ads")} למדידת המרות ולשיווק מחדש. הכלי עצמו רק מנהל את התגים; התגים שהוא טוען הם שמעבדים את הנתונים שלכם. הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (a) GDPR")} (הסכמה).`,
            },
            {
              term: bidiIsolate("Meta Pixel"),
              text: `רק בכפוף להסכמתכם. הספק: ${bidiIsolate("Meta Platforms Ireland Limited")}. הכלי מודד אם ביקור הגיע בעקבות אחת המודעות שלנו, ומאפשר לפנות לקהלים דומים. הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (a) GDPR")} (הסכמה).`,
            },
            {
              term: bidiIsolate("LinkedIn Insight Tag"),
              text: `רק בכפוף להסכמתכם. הספק: ${bidiIsolate("LinkedIn Ireland Unlimited Company")}. הכלי מודד את ביצועי הקמפיינים שלנו ב-${bidiIsolate("LinkedIn")} ומאפשר פילוח קהלים שם. הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (a) GDPR")} (הסכמה).`,
            },
            {
              term: `${bidiIsolate("Microsoft Clarity")}, לרבות הקלטת גלישה`,
              text: `${bidiIsolate("Clarity")} (${bidiIsolate("Microsoft Ireland Operations Limited")}) מראה לנו כיצד נעשה שימוש בעמודים בפועל: תנועת עכבר, גלילה, הקלקות ופעולות בעמוד. הכלי יכול לשחזר אותן כהקלטה אנונימית ולרכז אותן במפות חום. מדובר בפעולה מרחיקת לכת יותר מספירת ביקורים, ולכן היא מפורטת כאן בנפרד. הסקריפט נטען בכל עמוד, אך נמסר לו האם ניתנה הסכמה: בלעדיה הוא פועל במצב המוגבל של ${bidiIsolate("Microsoft")}, שאינו מציב עוגיות ואינו בונה פרופיל; עם הסכמה הוא מתעד את הביקור במלואו. הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (a) GDPR")} (הסכמה) למצב המלא, ו-${bidiIsolate("Art. 6 (1) (f) GDPR")} (אינטרס לגיטימי בזיהוי מקומות שבהם האתר מבלבל) למצב המוגבל. אפשר להתנגד למצב המוגבל בכל עת לפי ${bidiIsolate("Art. 21")}.`,
            },
          ],
        },
      ],
    },
    {
      id: "recipients",
      title: "3. מי מקבל את הנתונים",
      blocks: [
        {
          kind: "callout",
          text: "העברת הפרטים שלכם ליזם או לעורך דין היא חלק מהותי מהשירות. היא נעשית אך ורק עבור הנכס הספציפי שהבעתם בו עניין.",
        },
        { kind: "p", text: "בהתאם לפנייה, פרטי הקשר שלכם עשויים להימסר לגורמים האלה:" },
        {
          kind: "list",
          items: [
            `יזמי נדל"ן בקפריסין, לצורך תיאום סיורים והכנת הצעות לנכסים שמעניינים אתכם. הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (b) GDPR")}.`,
            "עורכי דין עצמאיים, לבדיקות משפטיות ולניסוח חוזים, כאשר אתם מבקשים שנקשר ביניכם. הם פועלים כבעלי שליטה נפרדים בנתונים וכפופים לחובת הסודיות המקצועית שלהם.",
            `ספקי שירותי מחשוב, לאחסון האתר, למשלוח דואר אלקטרוני ולמערכות שבהן מנוהלות הפניות. הם פועלים כמעבדי נתונים לפי ${bidiIsolate("Art. 28 GDPR")} ורק לפי הנחיותינו המתועדות.`,
          ],
        },
        {
          kind: "p",
          text: "איננו מוכרים נתונים אישיים ואיננו מעבירים אותם לצורכי פרסום של גורם אחר.",
        },
      ],
    },
    {
      id: "transfers",
      title: "4. העברות מחוץ לאזור הכלכלי האירופי",
      blocks: [
        {
          kind: "p",
          text: `${bidiIsolate("Google")}, ${bidiIsolate("Meta")}, ${bidiIsolate("Microsoft")} ו-${bidiIsolate("LinkedIn")} מתקשרות איתנו דרך הישויות האיריות שלהן, אך עיבוד בתשתיות שלהן עשוי לכלול העברה לארצות הברית. העברות אלה נשענות על החלטת הנאותות של הנציבות האירופית בעניין ${bidiIsolate("EU-US Data Privacy Framework")} כאשר המקבל מוסמך לפיה, ואחרת על תניות חוזיות סטנדרטיות לפי ${bidiIsolate("Art. 46 (2) (c) GDPR")}.`,
        },
        {
          kind: "p",
          text: "אפשר לבקש מאיתנו עותק של אמצעי ההגנה החלים, באמצעות פרטי הקשר שבסעיף 1.",
        },
      ],
    },
    {
      id: "retention",
      title: "5. כמה זמן נשמרים הנתונים",
      blocks: [
        {
          kind: "p",
          text: "נתונים אישיים נשמרים רק כל עוד המטרה שלשמה נאספו מחייבת זאת, ולאחר מכן רק כאשר חלה חובת שמירה על פי דין.",
        },
        {
          kind: "list",
          items: [
            "קובצי יומן של השרת: רק כל עוד הם נדרשים להפעלה מאובטחת של האתר ולבירור תקלות או שימוש לרעה, ולאחר מכן הם נמחקים או הופכים לאנונימיים.",
            "פניות והתכתבות נלווית: כל עוד אנחנו בקשר איתכם בעניין, ולאחר מכן רק כל עוד הדבר עשוי להוביל לשיחת המשך.",
            "נתונים הקשורים לעסקה שהושלמה: למשך התקופה שדיני המסחר והמס בקפריסין מחייבים לשמור אותם.",
            "הרשמות לניוזלטר: עד להסרה מהרשימה.",
            "תיעוד הסכמות: כל עוד עלינו להיות מסוגלים להוכיח שההסכמה ניתנה.",
            "מדידה ללא עוגיות: ספירות מצטברות בלבד, וערך הגיבוב היומי אינו ניתן לייחוס לאדם בשום שלב.",
          ],
        },
        {
          kind: "p",
          text: "אפשר לשאול אותנו כמה זמן נשמרת אצלנו קטגוריה מסוימת של נתונים, ונמסור את המידע.",
        },
      ],
    },
    {
      id: "cookies",
      title: "6. עוגיות והסכמה",
      blocks: [
        {
          kind: "p",
          text: "באנר העוגיות שלנו מציע את אותן שלוש קטגוריות שמופיעות לאורך מדיניות זו:",
        },
        {
          kind: "definitions",
          items: [
            {
              term: "הכרחיות",
              text: `נדרשות כדי שהאתר יעבוד, למשל שמירת השפה שנבחרה ושמירת בחירת העוגיות עצמה. הן מוצבות על בסיס ${bidiIsolate("Art. 6 (1) (f) GDPR")} ואי אפשר לכבות אותן.`,
            },
            {
              term: "אנליטיקה",
              text: `${bidiIsolate("Google Analytics 4")} (דרך ${bidiIsolate("Google Tag Manager")}) ו-${bidiIsolate("Microsoft Clarity")} במצב המלא. מוצבות רק לאחר אישורכם.`,
            },
            {
              term: "שיווק",
              text: `${bidiIsolate("Google Ads")}, ${bidiIsolate("Meta Pixel")} ו-${bidiIsolate("LinkedIn Insight Tag")}. מוצבות רק לאחר אישורכם.`,
            },
          ],
        },
        {
          kind: "p",
          text: "אפשר לשנות את הבחירה או לבטל אותה בכל עת דרך באנר העוגיות; הביטול אינו פוגע בחוקיות העיבוד שנעשה קודם לכן. אפשר גם לחסום או למחוק עוגיות בהגדרות הדפדפן, אך אז חלקים מהאתר עלולים שלא לפעול כמתוכנן.",
        },
      ],
    },
    {
      id: "rights",
      title: "7. הזכויות שלכם",
      blocks: [
        { kind: "p", text: `לפי ${bidiIsolate("GDPR")} עומדות לכם הזכויות האלה:` },
        {
          kind: "list",
          items: [
            `עיון: לברר אם הנתונים שלכם מעובדים ולקבל עותק שלהם (${bidiIsolate("Art. 15")}).`,
            `תיקון: לתקן נתונים שגויים או חסרים (${bidiIsolate("Art. 16")}).`,
            `מחיקה: למחוק את הנתונים כאשר מתקיימת אחת העילות שב-${bidiIsolate("Art. 17")}.`,
            `הגבלה: לדרוש שהנתונים יישמרו בלבד, כל עוד מחלוקת לגביהם לא הוכרעה (${bidiIsolate("Art. 18")}).`,
            `ניידות: לקבל את הנתונים שמסרתם בפורמט מובנה וקריא במכונה, או להעביר אותם לבעל שליטה אחר (${bidiIsolate("Art. 20")}).`,
            `התנגדות: להתנגד בכל עת לעיבוד המבוסס על אינטרס לגיטימי, ובאופן מוחלט לעיבוד לצורכי שיווק ישיר (${bidiIsolate("Art. 21")}).`,
            `ביטול הסכמה: בכל עת, עם תוקף לעתיד (${bidiIsolate("Art. 7 (3)")}).`,
          ],
        },
        {
          kind: "p",
          text: `למימוש אחת מהזכויות האלה יש לכתוב לכתובת ${ltrIsolate("office@cyprusvipestates.com")}. אנחנו משיבים בתוך חודש; בבקשה מורכבת נוכל להאריך את המועד בחודשיים נוספים, ונסביר מדוע.`,
        },
        {
          kind: "callout",
          text: `עומדת לכם גם הזכות להגיש תלונה לרשות פיקוח. בקפריסין זהו משרד נציב הגנת הנתונים האישיים, ${ltrIsolate("Iasonos 1, 1082")} ניקוסיה (${ltrIsolate("commissioner@dataprotection.gov.cy")}). אפשר להגיש תלונה גם לרשות במקום המגורים או העבודה שלכם.`,
        },
      ],
    },
    {
      id: "security",
      title: "8. אבטחת מידע",
      blocks: [
        {
          kind: "p",
          text: `האתר מוגש בפרוטוקול ${bidiIsolate("TLS")}, ולכן התוכן שנשלח אלינו מוצפן בדרך, והדפדפן מציג "${ltrIsolate("https://")}" ומנעול. אנחנו נוקטים אמצעים טכניים וארגוניים שמתאימים לרמת הסיכון, ומגבילים את הגישה לנתוני הפניות לעובדים שזקוקים להם כדי לטפל בכם.`,
        },
      ],
    },
    {
      id: "automated-decisions",
      title: "9. קבלת החלטות אוטומטית",
      blocks: [
        {
          kind: "p",
          text: `איננו עושים שימוש בקבלת החלטות אוטומטית או בפרופיילינג שיש להם השפעה משפטית עליכם או השפעה משמעותית דומה, כמשמעותם ב-${bidiIsolate("Art. 22 GDPR")}. כאשר תוכנה מסייעת במיון פניות או בסיכומן, אדם הוא שמחליט מה נעשה בהמשך.`,
        },
      ],
    },
    {
      id: "changes",
      title: "10. שינויים במדיניות זו",
      blocks: [
        {
          kind: "p",
          text: "מדיניות זו מתעדכנת כאשר השירותים שלנו או הדרישות המשפטיות משתנים. הגרסה הנוכחית היא הקובעת, והתאריך שבראש העמוד מציין מתי היא עודכנה לאחרונה.",
        },
      ],
    },
  ],

  contactTitle: "שאלות על הנתונים שלכם?",
  contactText:
    `אפשר לכתוב לכתובת ${ltrIsolate("office@cyprusvipestates.com")} או להתקשר למספר ${ltrIsolate("+357 99 278 285")}. נשמח להסביר כל סעיף במדיניות זו בשפה פשוטה.`,
};
