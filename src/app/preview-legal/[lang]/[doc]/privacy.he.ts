import type { LegalDoc } from "./types";
import { bidiIsolate, ltrIsolate, HE_LANGUAGE_NOTE } from "@/lib/locale";

/* Privacy Policy - Hebrew (Phase 5b).
   Brought in line with the English revision of 2026-11-02; the new and changed passages (each marked REVIEW(he) below) need native review.

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

   One Hebrew form per defined GDPR term, glossed in Hebrew at first mention
   and recorded in docs/i18n/he-glossary.md section 3.2; the Art. 15/16/17/20
   rights are worded as entitlements against us, exactly as the English has
   them. The document title is definite (מדיניות הפרטיות) because every link
   label on the site that points here is definite (Pass B M2/M6/M7/M10).

   NOT legal advice, and the Hebrew adds no assertion the English does not
   make. Review by a Cyprus-qualified lawyer is still required, as for every
   other locale of this document. */

// REVIEW(he)
export const PRIVACY_HE: LegalDoc = {
  metaTitle: `מדיניות הפרטיות | ${bidiIsolate("Cyprus VIP Estates")}`,
  metaDescription:
    `מה נאסף באתר של ${bidiIsolate("Cyprus VIP Estates")}, לשם מה הנתונים משמשים, למי הם נמסרים, איך הם מוגנים ואילו זכויות עומדות לכם לפי ${bidiIsolate("GDPR")}.`,
  eyebrow: "מידע משפטי",
  title: "מדיניות הפרטיות",
  bindingNote: "הנוסח האנגלי של מסמך זה הוא הנוסח המחייב; התרגום לעברית נועד לנוחות בלבד.",
  intro:
    "מדיניות זו מסבירה אילו נתונים אישיים אנחנו אוספים כאשר אתם משתמשים באתר או פונים אלינו, לשם מה אנחנו מעבדים אותם, מי מקבל אותם, כמה זמן הם נשמרים ואילו זכויות אפשר לממש בכל עת.",
  updatedLabel: "עדכון אחרון",
  updated: "2026-11-02",
  tocLabel: "בעמוד זה",

  sections: [
    {
      id: "controller",
      title: "1. מי אחראי לעיבוד",
      blocks: [
        {
          kind: "p",
          text: `בעל השליטה בנתונים (${bidiIsolate("controller")}) האחראי לעיבוד הנתונים האישיים שלכם באתר זה הוא:`,
        },
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
          text: "בכל שאלה על הנתונים שלכם, לרבות עיון, תיקון, מחיקה או כל נושא אחר במדיניות זו, יש להשתמש בפרטי הקשר שלמעלה. הבקשה תגיע לגורם שאחראי לטפל בה.",
        },
      ],
    },
    {
      id: "data-we-collect",
      title: "2. מה אנחנו אוספים ולשם מה",
      blocks: [
        {
          kind: "definitions",
          items: [
            // REVIEW(he) 2026-11-02: "the page requested" added, hostname removed
            {
              term: "קובצי יומן של השרת",
              text: `בכל בקשה לטעינת עמוד השרת רושם את העמוד המבוקש, את סוג הדפדפן וגרסתו, את מערכת ההפעלה, את כתובת ה-${bidiIsolate("URL")} שממנה הגעתם, את מועד הבקשה ואת כתובת ה-${bidiIsolate("IP")}. הרישום נחוץ מבחינה טכנית להצגת האתר ולזיהוי שימוש לרעה, ואיננו מצליבים אותו עם מקורות נתונים אחרים. הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (f) GDPR")} (אינטרס לגיטימי שלנו באתר מאובטח ותקין).`,
            },
            // REVIEW(he) 2026-11-02: term and text rewritten
            {
              term: "פניות וטפסים",
              text: `כאשר נשלחת אלינו פנייה, בטופס יצירת קשר, במחשבון התשואה, בבקשה לקבל אחד המדריכים החינמיים שלנו או בטופס שיתוף הפעולה לשותפים, אנחנו שומרים את מה שהוזן בה: בדרך כלל שם, כתובת אימייל, מספר טלפון, דרך ההתקשרות המועדפת ותוכן ההודעה, וכן תשובות שאינן חובה, אם נמסרו (למשל תקציב, לוח זמנים, סוג נכס או אזרחות). אנחנו רושמים גם את העמוד שממנו נשלחה הפנייה ואת הדרך שבה הגעתם לאתר (ראו "ייחוס קמפיינים"). אנחנו משיבים באימייל, בטלפון או ב-${bidiIsolate("WhatsApp")}, שולחים את המדריך או את החישוב שביקשתם, ושומרים את הפנייה במערכת ניהול הלקוחות שלנו, כדי שהיועץ המלווה אתכם יראה את ההיסטוריה שלה. הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (b) GDPR")} (פעולות טרום-חוזיות לבקשתכם).`,
            },
            // REVIEW(he) 2026-11-02: new
            {
              term: `התכתבות באימייל וב-${bidiIsolate("WhatsApp")}`,
              text: `הודעות שאתם מחליפים איתנו באימייל או ב-${bidiIsolate("WhatsApp")} מתויקות יחד עם הפנייה שלכם, כדי שמי שמשיב לכם יידע מה כבר נדון. הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (b) GDPR")}, וכן ${bidiIsolate("Art. 6 (1) (f) GDPR")} (אינטרס לגיטימי שלנו בתיעוד מלא של הייעוץ שלנו).`,
            },
            // REVIEW(he) 2026-11-02: new
            {
              term: `פניות דרך טופסי לידים ב-${bidiIsolate("Facebook")} וב-${bidiIsolate("Instagram")}`,
              text: `אם אתם ממלאים טופס לידים בתוך אחת המודעות שלנו ב-${bidiIsolate("Facebook")} או ב-${bidiIsolate("Instagram")}, ${bidiIsolate("Meta Platforms Ireland Limited")} מעבירה לנו את הפרטים שהזנתם שם (בדרך כלל שם, פרטי קשר והתשובות שלכם). אנחנו מטפלים בהם כמו בכל פנייה אחרת. הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (b) GDPR")}.`,
            },
            // REVIEW(he) 2026-11-02: new
            {
              term: "הפניות מצד השותפים שלנו",
              text: `אם שותף, למשל סוכן או יועץ אחר, הפנה אתכם אלינו, קיבלנו את הפרטים שלכם מאותו שותף. בפורטל השותפים שלנו השותף יכול לעקוב אחר השלב שבו נמצאת ההפניה שלו ואחר מצגות הנכסים שהכנו. הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (b) GDPR")} ו-${bidiIsolate("Art. 6 (1) (f) GDPR")} (אינטרס לגיטימי שלנו בעבודה עם השותפים שמפנים אלינו לקוחות).`,
            },
            // REVIEW(he) 2026-11-02: new
            {
              term: "מצגות נכסים אישיות",
              text: `ייתכן שנשלח לכם קישור אישי למבחר נכסים. כאשר אתם פותחים אותו, אנחנו רושמים מתי וכמה זמן צפיתם בו ואילו נכסים סימנתם כמועדפים, והיועץ שהכין אותו מקבל על כך הודעה, כדי שנוכל להמשיך את הקשר סביב מה שמעניין אתכם בפועל. תוקף הקישור פג לאחר 30 ימים, אלא אם סוכם אחרת. הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (b) GDPR")} ו-${bidiIsolate("Art. 6 (1) (f) GDPR")} (אינטרס לגיטימי שלנו בהתאמה אישית של הייעוץ שלנו).`,
            },
            // REVIEW(he) 2026-11-02: video-call sentence added
            {
              term: "תיאום פגישות",
              text: `כאשר מוצע או מאושר מועד דרך עמוד תיאום הפגישות, אנחנו מעבדים את השעות שהוצעו, את אזור הזמן ואת פרטי הקשר שלכם, כדי לקבוע את הפגישה ולאשר אותה. אם סוכם על פגישה בשיחת וידאו, ספק שירות הווידאו שבו אנחנו משתמשים (למשל ${bidiIsolate("Zoom")}) מעבד את הנתונים הדרושים לחיבור השיחה. הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (b) GDPR")}.`,
            },
            // REVIEW(he) 2026-11-02: withdrawal address added
            {
              term: "ניוזלטר",
              text: `בהרשמה לניוזלטר אנחנו מעבדים את כתובת האימייל שלכם כדי לשלוח לכם אותו. הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (a) GDPR")} (הסכמה). אפשר לבטל את ההסכמה בכל עת בהודעה לכתובת ${ltrIsolate("office@cyprusvipestates.com")}.`,
            },
            // REVIEW(he) 2026-11-02: term and text rewritten
            {
              term: "מדידת שימוש באתר (מדידה עצמית, ללא עוגיות)",
              text: `אנחנו סופרים צפיות בעמודים בשרת שלנו, ללא עוגיות וללא צד שלישי כלשהו. לכל צפייה בעמוד אנחנו שומרים את העמוד והשפה, את הדומיין של האתר שממנו הגעתם, את מחרוזת הדפדפן ואת סוג המכשיר, את המדינה שנגזרת מכתובת ה-${bidiIsolate("IP")}, פרמטרים של קמפיין שמופיעים בקישור, אם יש (${bidiIsolate("utm_source, utm_medium, utm_campaign")}), סימון אם הגבתם לבאנר העוגיות, וקוד שמחושב מכתובת ה-${bidiIsolate("IP")}, ממחרוזת הדפדפן ומהתאריך. הקוד הזה מתחלף מדי יום, וכתובת ה-${bidiIsolate("IP")} עצמה אינה נשמרת. בעמודי הפרויקטים אנחנו רושמים גם עד כמה גללתם ובאילו כפתורים השתמשתם. אנחנו משתמשים בנתונים סטטיסטיים אלה רק במצטבר, כדי לראות אילו תכנים מועילים, ולעולם לא כדי לזהות אתכם. הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (f) GDPR")} (אינטרס לגיטימי שלנו בהבנת אופן השימוש באתר).`,
            },
            // REVIEW(he) 2026-11-02: new
            {
              term: "ייחוס קמפיינים",
              text: `אם הגעתם דרך מודעה, קישור של קמפיין או קישור הפניה של שותף, הדפדפן שלכם שומר את מקור הביקור (פרמטרים של הקמפיין, מזהי הקלקה על מודעות כגון ${bidiIsolate("gclid")} או ${bidiIsolate("fbclid")}, הכתובת שממנה הגעתם וקוד שותף) באחסון של לשונית הדפדפן הנוכחית, והאחסון הזה נמחק כאשר סוגרים את הלשונית. אם נשלחת פנייה במהלך אותו ביקור, המקור נשמר יחד איתה, כדי שנדע איזה קמפיין או שותף הביא אתכם אלינו. רק אם אתם מאשרים עוגיות, אנחנו שומרים אותו גם בעוגייה ("${bidiIsolate("cve_attr")}") למשך 90 ימים, כדי שגם פנייה שתישלח מאוחר יותר תיוחס כראוי. הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (f) GDPR")} (אינטרס לגיטימי שלנו לדעת מאיזה שותף או קמפיין הגיעה פנייה) לאחסון בלשונית, ו-${bidiIsolate("Art. 6 (1) (a) GDPR")} (הסכמה) לעוגייה.`,
            },
            // REVIEW(he) 2026-11-02: consent condition reworded ("accept cookies")
            {
              term: `${bidiIsolate("Google Tag Manager")}, ${bidiIsolate("Google Analytics")} ו-${bidiIsolate("Google Ads")}`,
              text: `רק אם אישרתם את העוגיות נטען ${bidiIsolate("Google Tag Manager")} (${bidiIsolate("Google Ireland Limited")}), והוא מפעיל את ${bidiIsolate("Google Analytics 4")} למדידת חשיפה ואת ${bidiIsolate("Google Ads")} למדידת המרות ולשיווק מחדש. הכלי עצמו רק מנהל את התגים; התגים שהוא טוען הם שמעבדים את הנתונים שלכם. הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (a) GDPR")} (הסכמה).`,
            },
            {
              term: bidiIsolate("Meta Pixel"),
              text: `רק בכפוף להסכמתכם. הספק: ${bidiIsolate("Meta Platforms Ireland Limited")}. הכלי מודד אם ביקור הגיע בעקבות אחת המודעות שלנו, ומאפשר לפנות לקהלים דומים. הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (a) GDPR")} (הסכמה).`,
            },
            // REVIEW(he) 2026-11-02: new
            {
              term: bidiIsolate("Meta Conversions API"),
              text: `רק אם אישרתם את העוגיות, אנחנו מדווחים גם על שני אירועים ישירות מהשרת שלנו אל ${bidiIsolate("Meta Platforms Ireland Limited")}: שליחת פנייה ("${bidiIsolate("Lead")}") ויצירת קשר ב-${bidiIsolate("WhatsApp")}, בטלפון או באימייל ("${bidiIsolate("Contact")}"). בפנייה אנחנו שולחים את כתובת האימייל ואת מספר הטלפון שלכם בצורה פסאודונימית (כערכי גיבוב ${bidiIsolate("SHA-256")}, ולעולם לא כטקסט גלוי); בשני האירועים אנחנו שולחים את כתובת ה-${bidiIsolate("IP")}, את מחרוזת הדפדפן, את כתובת העמוד ואת מזהי העוגיות של ${bidiIsolate("Meta")} (${bidiIsolate("_fbp, _fbc")}). מזהה אירוע מבטיח ש-${bidiIsolate("Meta")} תספור כל אירוע פעם אחת בלבד, גם כאשר הוא מגיע גם מהדפדפן שלכם וגם מהשרת שלנו. ${bidiIsolate("Meta")} משתמשת בנתונים אלה כדי למדוד ולשפר את הפרסום שלנו; אנחנו ו-${bidiIsolate("Meta")} אחראים במשותף לעיבוד זה (${bidiIsolate("Art. 26 GDPR")}). הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (a) GDPR")} (הסכמה).`,
            },
            {
              term: bidiIsolate("LinkedIn Insight Tag"),
              text: `רק בכפוף להסכמתכם. הספק: ${bidiIsolate("LinkedIn Ireland Unlimited Company")}. הכלי מודד את ביצועי הקמפיינים שלנו ב-${bidiIsolate("LinkedIn")} ומאפשר מיקוד קהלים באותה פלטפורמה. הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (a) GDPR")} (הסכמה).`,
            },
            {
              term: `${bidiIsolate("Microsoft Clarity")}, לרבות הקלטת גלישה`,
              text: `${bidiIsolate("Clarity")} (${bidiIsolate("Microsoft Ireland Operations Limited")}) מראה לנו כיצד נעשה שימוש בעמודים בפועל: תנועת עכבר, גלילה, הקלקות ופעולות בעמוד. הכלי יכול לשחזר אותן כהקלטה אנונימית ולרכז אותן במפות חום. מדובר בפעולה מרחיקת לכת יותר מספירת ביקורים, ולכן היא מפורטת כאן בנפרד. הסקריפט נטען בכל עמוד, אך הוא פועל לפי בחירת העוגיות שלכם: בלי הסכמה הוא פועל במצב המוגבל של ${bidiIsolate("Microsoft")}, שאינו מציב עוגיות ואינו בונה פרופיל; עם הסכמה הוא מתעד את הביקור במלואו. הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (a) GDPR")} (הסכמה) למצב המלא, ו-${bidiIsolate("Art. 6 (1) (f) GDPR")} (אינטרס לגיטימי שלנו בזיהוי מקומות שבהם האתר מבלבל) למצב המוגבל. אפשר להתנגד למצב המוגבל בכל עת לפי ${bidiIsolate("Art. 21")}.`,
            },
            // REVIEW(he) 2026-11-02: new
            {
              term: "מפות ותוכן מוטמע אחר",
              text: `להצגת מפות, חלק מהעמודים טוענים אריחי מפה ישירות מ-${bidiIsolate("OpenFreeMap")} ומ-${bidiIsolate("OpenStreetMap Foundation")}, ותצוגות מפה ישנות יותר טוענות תמונות של סמני מיקום מרשת התוכן של ${bidiIsolate("Cloudflare")}. שדה מספר הטלפון טוען תמונות קטנות של דגלי מדינות מ-${bidiIsolate("GitHub Pages")}, וחלק מהעמודים כוללים סרטונים מוטמעים מ-${bidiIsolate("YouTube")} (${bidiIsolate("Google")}). כאשר הדפדפן שלכם טוען תוכן כזה, הספק מקבל את כתובת ה-${bidiIsolate("IP")} ואת פרטי הדפדפן שלכם, כמו בכל בקשה באינטרנט. הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (f) GDPR")} (אינטרס לגיטימי שלנו בהצגת מיקומים וסרטונים בצורה נוחה לשימוש).`,
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
        // REVIEW(he) 2026-11-02: "contact details" -> "data"
        { kind: "p", text: "בהתאם לפנייה, הנתונים שלכם עשויים להימסר לגורמים אלה:" },
        {
          kind: "list",
          items: [
            // REVIEW(he) 2026-11-02: registration with the developer added
            `יזמי נדל"ן בקפריסין, לצורך רישומכם כלקוחות שלנו ולצורך תיאום סיורים והצעות לנכסים שמעניינים אתכם. לצורך הרישום אנחנו שולחים את שמכם, את הנכסים שמעניינים אתכם ואת התקציב שלכם, וכן מספר טלפון שחלק מספרותיו מוסתרות; אם אתם מתקדמים לסיור או להצעה, היזם מקבל את פרטי הקשר הדרושים לכך. הבסיס המשפטי: ${bidiIsolate("Art. 6 (1) (b) GDPR")}.`,
            "עורכי דין עצמאיים, לבדיקות משפטיות ולניסוח חוזים, כאשר אתם מבקשים שנפנה אתכם אליהם. הם פועלים כבעלי שליטה נפרדים בנתונים וכפופים לחובת הסודיות המקצועית שלהם.",
            // REVIEW(he) 2026-11-02: new
            "השותף שהפנה אתכם אלינו, אם יש כזה. השותף רואה את השלב שבו נמצאת ההפניה שלו ואת המצגות שהכנו (ראו סעיף 2).",
            // REVIEW(he) 2026-11-02: new
            `שירותי ההודעות של הצוות שלנו. כל פנייה חדשה מועברת לקבוצות הצ'אט של הצוות שלנו ב-${bidiIsolate("Telegram")} (${bidiIsolate("Telegram FZ-LLC")}, איחוד האמירויות הערביות) וב-${bidiIsolate("WhatsApp")} (${bidiIsolate("WhatsApp Ireland Limited")}), כדי שנוכל להשיב במהירות, ואם תבחרו בכך, אנחנו מתכתבים איתכם ב-${bidiIsolate("WhatsApp")}.`,
            // REVIEW(he) 2026-11-02: providers named (Hostinger, Anthropic, video call)
            `ספקי שירותי המחשוב שלנו, הפועלים כמעבדי נתונים לפי ${bidiIsolate("Art. 28 GDPR")} ורק לפי הנחיותינו המתועדות: ${bidiIsolate("Hostinger International Ltd.")} (אחסון השרת ואימייל), ${bidiIsolate("Anthropic")} (עוזר בינה מלאכותית שהצוות שלנו משתמש בו לסיכום פניות, לניסוח טיוטות של תשובות ולמיון התשובות של היזמים; הוא רואה את תוכן הפנייה ואת ההיסטוריה שלה), וספק שיחות הווידאו לפגישות שאתם מסכימים להן.`,
            // REVIEW(he) 2026-11-02: new
            `${bidiIsolate("Meta")}, ${bidiIsolate("Google")}, ${bidiIsolate("LinkedIn")} ו-${bidiIsolate("Microsoft")}, כמתואר בסעיף 2, ורק בכפוף להסכמתכם במקרים שבהם סעיף 2 קובע זאת.`,
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
        // REVIEW(he) 2026-11-02: Anthropic, Zoom, Cloudflare, GitHub added
        {
          kind: "p",
          text: `${bidiIsolate("Google")}, ${bidiIsolate("Meta")}, ${bidiIsolate("Microsoft")} ו-${bidiIsolate("LinkedIn")} מתקשרות איתנו דרך הישויות האיריות שלהן, אך עיבוד בתשתיות שלהן עשוי לכלול העברה לארצות הברית, וכך גם השימוש שלנו ב-${bidiIsolate("Anthropic")}, ב-${bidiIsolate("Zoom")}, ב-${bidiIsolate("Cloudflare")} וב-${bidiIsolate("GitHub")}. העברות אלה נשענות על החלטת הנאותות של הנציבות האירופית בעניין ${bidiIsolate("EU-US Data Privacy Framework")} כאשר מקבל הנתונים רשום במסגרת זו, ובכל מקרה אחר על תניות חוזיות סטנדרטיות לפי ${bidiIsolate("Art. 46 (2) (c) GDPR")}.`,
        },
        // REVIEW(he) 2026-11-02: new
        {
          kind: "p",
          text: `הודעות על פניות חדשות מועברות דרך ${bidiIsolate("Telegram")}, שירות שהחברה המפעילה אותו ממוקמת באיחוד האמירויות הערביות, מדינה שאין לגביה החלטת נאותות של האיחוד האירופי. אנחנו משתמשים בו רק כדי לטפל בפנייה שלכם במהירות, לבקשתכם (${bidiIsolate("Art. 49 (1) (b) GDPR")}).`,
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
            // REVIEW(he) 2026-11-02: fixed period of 14 days
            "קובצי יומן של השרת: 14 ימים, ולאחר מכן הם נמחקים.",
            // REVIEW(he) 2026-11-02: presentation views and 90-day purge added
            "פניות, התכתבות ונתוני צפייה במצגות: כל עוד אנחנו בקשר איתכם בעניין, ולאחר מכן רק כל עוד הדבר עשוי להוביל לשיחת המשך. כאשר אנחנו מוחקים פנייה, היא מוסרת לצמיתות מהמערכת שלנו לאחר 90 ימים.",
            "נתונים הקשורים לעסקה שהושלמה: למשך התקופה שדיני המסחר והמס בקפריסין מחייבים לשמור אותם.",
            "הרשמות לניוזלטר: עד להסרה מהרשימה.",
            // REVIEW(he) 2026-11-02: new (replaces "consent records")
            "בחירת העוגיות שלכם: נשמרת בדפדפן שלכם למשך 180 ימים, ולאחר מכן נשאל שוב. עוגיית ייחוס הקמפיינים (רק בכפוף להסכמה): 90 ימים. האחסון בלשונית: עד לסגירת הלשונית.",
            // REVIEW(he) 2026-11-02: new
            "קישורים שאנחנו שולחים לכם: תוקפם של קישורי ההורדה של המדריכים שלנו ושל הקישורים האישיים למצגות פג לאחר 30 ימים.",
            // REVIEW(he) 2026-11-02: new (replaces "cookieless analytics")
            "הנתונים הסטטיסטיים על השימוש באתר: נשמרים רק כרשומות הפסאודונימיות המתוארות בסעיף 2, ונמחקים כאשר אינם נחוצים עוד להשוואת השימוש באתר לאורך זמן.",
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
        // REVIEW(he) 2026-11-02: new (one choice instead of three categories); quoted labels are the he banner buttons
        {
          kind: "p",
          text: `באנר העוגיות שלנו מציע בחירה אחת: אישור של כל העוגיות שאינן הכרחיות ("אישור הכל"), או הרשאה לעוגיות ההכרחיות בלבד ("רק ההכרחיות"). האישור חל על הקטגוריות "אנליטיקה" ו"שיווק" שלהלן; הסירוב משאיר רק את מה שהכרחי.`,
        },
        {
          kind: "definitions",
          items: [
            // REVIEW(he) 2026-11-02: rewritten
            {
              term: "הכרחיות",
              text: `נדרשות כדי שהאתר יעבוד: העוגייה "${bidiIsolate("cookieConsent")}", ששומרת את הבחירה שלכם למשך 180 ימים, והאחסון בלשונית לצורך ייחוס קמפיינים, המתואר בסעיף 2. השפה שלכם היא חלק מכתובת העמוד, ולכן אין צורך בעוגייה בשבילה. הן מוצבות על בסיס ${bidiIsolate("Art. 6 (1) (f) GDPR")}.`,
            },
            // REVIEW(he) 2026-11-02: cookie names added
            {
              term: "אנליטיקה",
              text: `${bidiIsolate("Google Analytics 4")} (דרך ${bidiIsolate("Google Tag Manager")}) ו-${bidiIsolate("Microsoft Clarity")} במצב המלא, שמציבים עוגיות משלהם (למשל ${bidiIsolate("_ga, _clck, _clsk")}). מוצבות רק לאחר אישורכם.`,
            },
            // REVIEW(he) 2026-11-02: Conversions API, cookie names and cve_attr added
            {
              term: "שיווק",
              text: `${bidiIsolate("Google Ads")}, ${bidiIsolate("Meta Pixel")}, ${bidiIsolate("Meta Conversions API")} ו-${bidiIsolate("LinkedIn Insight Tag")}, שמציבים עוגיות משלהם (למשל ${bidiIsolate("_gcl_au, _fbp, _fbc")} ועוגיות ה-${bidiIsolate("li_")} של ${bidiIsolate("LinkedIn")}), וכן עוגיית ייחוס הקמפיינים שלנו "${bidiIsolate("cve_attr")}" (90 ימים). מוצבות רק לאחר אישורכם.`,
            },
          ],
        },
        // REVIEW(he) 2026-11-02: withdrawal via the "Cookie settings" footer link, reload
        {
          kind: "p",
          text: `אפשר לשנות את הבחירה או לבטל אותה בכל עת דרך הקישור "${bidiIsolate("Cookie settings")}" בתחתית כל עמוד; בעת ביטול, העמוד נטען מחדש בלי הכלים שאינם הכרחיים. הביטול אינו פוגע בחוקיות העיבוד שנעשה קודם לכן. אפשר גם לחסום או למחוק עוגיות בהגדרות הדפדפן, אך אז חלקים מהאתר עלולים שלא לפעול כמתוכנן.`,
        },
      ],
    },
    {
      id: "rights",
      title: "7. הזכויות שלכם",
      blocks: [
        { kind: "p", text: `לפי ${bidiIsolate("GDPR")} עומדות לכם הזכויות שלהלן:` },
        {
          kind: "list",
          items: [
            `עיון: לקבל מאיתנו אישור אם הנתונים שלכם מעובדים, וכן עותק שלהם (${bidiIsolate("Art. 15")}).`,
            `תיקון: לדרוש שנתקן נתונים שגויים או נשלים נתונים חסרים (${bidiIsolate("Art. 16")}).`,
            `מחיקה: לדרוש שנמחק את הנתונים כאשר מתקיימת אחת העילות שב-${bidiIsolate("Art. 17")}.`,
            `הגבלה: לדרוש שהנתונים יישמרו בלבד, כל עוד מחלוקת לגביהם לא הוכרעה (${bidiIsolate("Art. 18")}).`,
            `ניידות: לקבל את הנתונים שמסרתם בפורמט מובנה וקריא במכונה, או לבקש שנעביר אותם ישירות לבעל שליטה אחר (${bidiIsolate("Art. 20")}).`,
            `התנגדות: להתנגד בכל עת לעיבוד המבוסס על אינטרס לגיטימי שלנו, ולעיבוד לצורכי שיווק ישיר ללא סייג (${bidiIsolate("Art. 21")}).`,
            `ביטול הסכמה: בכל עת, עם תוקף לעתיד (${bidiIsolate("Art. 7 (3)")}).`,
          ],
        },
        {
          kind: "p",
          text: `למימוש אחת מזכויות אלה יש לכתוב לכתובת ${ltrIsolate("office@cyprusvipestates.com")}. אנחנו משיבים בתוך חודש; בבקשה מורכבת נוכל להאריך את המועד בחודשיים נוספים, ונסביר מדוע.`,
        },
        {
          kind: "callout",
          text: `עומדת לכם גם הזכות להגיש תלונה לרשות פיקוח. בקפריסין זהו משרד נציב הגנת הנתונים האישיים, ${ltrIsolate("Iasonos 1, 1082")} ניקוסיה (${ltrIsolate("commissioner@dataprotection.gov.cy")}). אפשר לפנות גם לרשות שבמקום המגורים או העבודה שלכם.`,
        },
      ],
    },
    {
      id: "security",
      title: "8. אבטחת מידע",
      blocks: [
        {
          kind: "p",
          text: `האתר מוגש בחיבור מוצפן (${bidiIsolate("TLS")}), ולכן התוכן שנשלח אלינו מוצפן בעת ההעברה, והדפדפן מציג "${ltrIsolate("https://")}" ומנעול. אנחנו נוקטים אמצעים טכניים וארגוניים שמתאימים לרמת הסיכון, ומגבילים את הגישה לנתוני הפניות לעובדים שזקוקים להם כדי לתת לכם מענה.`,
        },
      ],
    },
    {
      id: "automated-decisions",
      title: "9. קבלת החלטות אוטומטית",
      blocks: [
        // REVIEW(he) 2026-11-02: property suggestions and AI assistant named
        {
          kind: "p",
          text: `איננו משתמשים בקבלת החלטות אוטומטית או ביצירת פרופיל שיש להן השפעה משפטית עליכם או השפעה משמעותית דומה, כמשמעותן ב-${bidiIsolate("Art. 22 GDPR")}. התוכנה שלנו מציעה נכסים שמתאימים להעדפות שמסרתם לנו, והצוות שלנו משתמש בעוזר בינה מלאכותית לסיכום פניות ולניסוח טיוטות של תשובות (ראו סעיף 3); אדם בודק תמיד את התוצאה, והוא שמחליט מה נעשה בהמשך.`,
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
    `אפשר לכתוב לכתובת ${ltrIsolate("office@cyprusvipestates.com")} או להתקשר למספר ${ltrIsolate("+357 99 278 285")}. ${HE_LANGUAGE_NOTE} נשמח להסביר כל סעיף במדיניות זו בשפה פשוטה.`,
};
