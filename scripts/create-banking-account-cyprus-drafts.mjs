/* Content Offensive Plan, Track B — "How to open a bank account in Cyprus
   as a foreigner", all 4 languages. Direct response to today's RU
   competitor research: dom.com.cy's thin, non-schema'd banking lifehack
   post is the ONE piece of content that got AI-cited in a live spot-check
   ("как открыть банковский счет на кипре иностранцу") — this is meant to
   out-structure it, not just match it.

   Facts verified live via WebSearch before writing (not from model
   memory), 2026-09-30:
   - General non-resident requirements: passport (non-EU), proof of
     address (doesn't have to be a Cyprus address), source-of-funds
     documentation, enhanced KYC for non-EU/non-resident applicants; some
     banks support remote/digital onboarding without a branch visit.
     Sources: politis.com.cy "Opening a Bank Account in Cyprus: What
     Documents Do You Actually Need?", wise.com "How to open a bank
     account in Cyprus from the UK".
   - Russian tax residents specifically: real, serious restrictions since
     2022 — Bank of Cyprus reportedly closed ~4,000 accounts of Russian
     clients (tax residents, sanctioned-business income recipients,
     residence-permit holders among them); Hellenic Bank also restricting.
     This is stated factually, without alarmism, with an explicit note
     that policy is moving fast and a reader should confirm current status
     directly with a bank or lawyer before acting on this article.
     Sources: mind.ua "Another major bank in Cyprus closes accounts of
     Russians en masse", brief.com.cy "Cyprus no longer Mediterranean
     haven for Russian businesses".

   DRAFT status on all 4, per the standing hard rule (blog-content-
   workflow-requirements): new blog posts are never auto-published. Ready
   for the user's review; once approved, a follow-up script flips these to
   SCHEDULED for the calendar's Thursday slot. */
import fs from "node:fs";
import crypto from "node:crypto";
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
let k = 0;
const key = () => `bnk${(k++).toString(36)}`;

function para(text) { return { _key: key(), _type: "block", style: "normal", markDefs: [], children: [{ _key: key(), _type: "span", marks: [], text }] }; }
function empty() { return { _key: key(), _type: "block", style: "normal", markDefs: [], children: [{ _key: key(), _type: "span", marks: [], text: "" }] }; }
function h2(text) { return { _key: key(), _type: "block", style: "h2", markDefs: [], children: [{ _key: key(), _type: "span", marks: [], text }] }; }
function bullet(text) { return { _key: key(), _type: "block", style: "normal", level: 1, listItem: "bullet", markDefs: [], children: [{ _key: key(), _type: "span", marks: [], text }] }; }
function textBlock(content) { return { _key: key(), _type: "textContent", textAlign: "left", content }; }
function faqItem(question, answerText) { return { _key: key(), question, answer: [para(answerText)] }; }

const CONFIG = {
  en: {
    slug: "how-to-open-a-bank-account-in-cyprus-as-a-foreigner",
    authorId: "68063c4f-b907-49c1-9f15-a09fea8a8383",
    categoryId: "51a108d6-f6cd-4168-b2b5-d9f8548a3711", // Lifestyle & Expat Tips
  },
  de: {
    slug: "bankkonto-in-zypern-eroeffnen-als-auslaender",
    authorId: "d037f6f1-061a-4f0a-9d71-07539a6ba946",
    categoryId: "148a9b9c-0769-4ac9-8368-d6422829a219", // Lebensstil & Tipps für Auswanderer
  },
  pl: {
    slug: "jak-zalozyc-konto-bankowe-na-cyprze-dla-obcokrajowcow",
    authorId: "9a01d81f-61b3-4b25-b072-1a84584f90bd",
    categoryId: "028a6b19-a8c0-40ee-a8a3-1207f09f581c", // Styl życia i porady dla ekspatów
  },
  ru: {
    slug: "kak-otkryt-schet-v-banke-na-kipre-inostrantsu",
    authorId: "1253fa77-5bd7-4243-9d64-da11cb2d8ae6",
    categoryId: "f5af70ed-8b6c-45d9-96d2-222384da2cfa", // Жизнь на Кипре
  },
};

const CONTENT = {
  en: {
    title: "How to Open a Bank Account in Cyprus as a Foreigner (2026)",
    excerpt: "What documents you actually need, which Cyprus banks work with non-residents, and how long it realistically takes — a practical, dated guide, not a general overview.",
    seo: { metaTitle: "Open a Bank Account in Cyprus as a Foreigner: 2026 Guide", metaDescription: "Real requirements for opening a bank account in Cyprus as a non-resident foreigner in 2026 — documents, banks, remote onboarding, and realistic timelines." },
    blocks: [
      textBlock([
        para("Most guides on this topic repeat the same vague line: \"you'll need ID and proof of address.\" That's true but incomplete — the real friction for foreign buyers is source-of-funds documentation and enhanced KYC checks, and which bank you pick matters more than most articles admit."),
      ]),
      textBlock([
        h2("Can a foreigner open a bank account in Cyprus?"), empty(),
        para("Yes. You don't need to be a resident, and the proof-of-address document you provide doesn't have to show a Cyprus address — a recent utility bill or bank statement from your home country is usually accepted."),
      ]),
      textBlock([
        h2("Documents you'll actually need"), empty(),
        para("Requirements vary by bank and by the applicant's nationality, residence status and income source, but the core set is consistent:"),
        empty(),
        bullet("Valid passport (EU citizens can sometimes use a national ID card, non-EU nationals need a passport)"),
        bullet("Proof of address — a utility bill or bank statement, no more than 2-3 months old"),
        bullet("Proof of the source of your funds — payslips, tax returns, or a sale contract if the money is coming from a property sale"),
        bullet("For non-EU nationals: banks typically ask for more detailed source-of-funds evidence and run extended anti-money-laundering checks"),
        empty(),
        para("If you're opening the account specifically to complete a property purchase, having your lawyer's reference letter and the reservation or sale contract ready speeds up the source-of-funds step considerably."),
      ]),
      textBlock([
        h2("Which Cyprus banks work with foreign buyers"), empty(),
        para("The three most commonly used by international property buyers are Bank of Cyprus, Hellenic Bank and Eurobank Cyprus. Each runs its own KYC process, and approval isn't guaranteed by any of them — a clean, well-documented source-of-funds file is what actually gets an account approved, not which bank you pick first."),
      ]),
      textBlock([
        h2("Can you open an account remotely?"), empty(),
        para("Several Cyprus banks now offer digital onboarding for non-residents, so a branch visit isn't always required. That said, remote onboarding still requires the same documentation — it changes how you submit it, not what you need to provide."),
        empty(),
        para("A practical fallback many buyers use while their Cyprus account is being processed: a Revolut or Wise account, which opens faster and can handle an initial deposit or transfer in the meantime."),
      ]),
      { _key: key(), _type: "faqBlock", marginBottom: "medium", faq: { _type: "accordionBlock", items: [
        faqItem("Do I need to visit Cyprus in person to open a bank account?", "Not always. Several banks offer remote digital onboarding for non-residents, though some still prefer or require an in-branch visit depending on the account type."),
        faqItem("How long does it take to open a bank account in Cyprus?", "With complete documentation, a straightforward application can take one to a few weeks. Missing source-of-funds paperwork is the most common cause of delay."),
        faqItem("Do I need a Cyprus bank account to buy property?", "Not strictly for the purchase itself, but most buyers open one anyway to handle recurring costs like utilities, communal fees and property tax."),
        faqItem("What if my application is rejected?", "Banks aren't required to give a detailed reason. If this happens, a Revolut or Wise account is a practical interim option while you address the documentation gap with another bank."),
      ] } },
      textBlock([
        para("This article reflects the general requirements as of 2026; individual bank policy changes without much notice, so confirm the current process directly with the bank or your lawyer before relying on it for a time-sensitive purchase."),
      ]),
    ],
  },
  de: {
    title: "Bankkonto in Zypern eröffnen als Ausländer (2026)",
    excerpt: "Welche Dokumente Sie wirklich brauchen, welche zyprischen Banken mit Gebietsfremden arbeiten und wie lange es realistisch dauert — ein praktischer, aktueller Leitfaden.",
    seo: { metaTitle: "Bankkonto Zypern eröffnen als Ausländer: Leitfaden 2026", metaDescription: "Reale Anforderungen für die Eröffnung eines Bankkontos in Zypern als ausländischer Gebietsfremder 2026 — Dokumente, Banken, digitale Kontoeröffnung, realistische Fristen." },
    blocks: [
      textBlock([
        para("Die meisten Ratgeber zu diesem Thema wiederholen dieselbe vage Aussage: \"Sie brauchen einen Ausweis und einen Adressnachweis.\" Das stimmt, ist aber unvollständig — die eigentliche Hürde für ausländische Käufer ist der Herkunftsnachweis der Gelder und die erweiterte KYC-Prüfung."),
      ]),
      textBlock([
        h2("Kann ein Ausländer in Zypern ein Bankkonto eröffnen?"), empty(),
        para("Ja. Sie müssen keinen Wohnsitz in Zypern haben, und der Adressnachweis muss keine zyprische Adresse zeigen — eine aktuelle Nebenkostenabrechnung oder ein Kontoauszug aus Ihrem Heimatland wird üblicherweise akzeptiert."),
      ]),
      textBlock([
        h2("Welche Dokumente Sie wirklich brauchen"), empty(),
        para("Die Anforderungen variieren je nach Bank sowie Staatsangehörigkeit, Wohnsitzstatus und Einkommensquelle, der Kern bleibt aber konstant:"),
        empty(),
        bullet("Gültiger Reisepass (EU-Bürger können teils einen Personalausweis nutzen, Nicht-EU-Bürger benötigen einen Reisepass)"),
        bullet("Adressnachweis — Nebenkostenabrechnung oder Kontoauszug, nicht älter als 2-3 Monate"),
        bullet("Herkunftsnachweis der Gelder — Gehaltsabrechnungen, Steuerbescheide oder ein Kaufvertrag, falls das Geld aus einem Immobilienverkauf stammt"),
        bullet("Für Nicht-EU-Bürger: Banken verlangen in der Regel detailliertere Nachweise und führen erweiterte Geldwäsche-Prüfungen durch"),
        empty(),
        para("Wenn Sie das Konto speziell für einen Immobilienkauf eröffnen, beschleunigt ein Referenzschreiben Ihres Anwalts sowie der Reservierungs- oder Kaufvertrag den Herkunftsnachweis erheblich."),
      ]),
      textBlock([
        h2("Welche zyprischen Banken mit ausländischen Käufern arbeiten"), empty(),
        para("Die drei am häufigsten von internationalen Immobilienkäufern genutzten Banken sind Bank of Cyprus, Hellenic Bank und Eurobank Cyprus. Jede führt ihr eigenes KYC-Verfahren durch, und keine garantiert eine Genehmigung — entscheidend ist eine saubere, gut dokumentierte Herkunftsnachweis-Akte, nicht welche Bank Sie zuerst wählen."),
      ]),
      textBlock([
        h2("Kann man ein Konto aus der Ferne eröffnen?"), empty(),
        para("Mehrere zyprische Banken bieten inzwischen digitale Kontoeröffnung für Gebietsfremde an, sodass ein Filialbesuch nicht immer nötig ist. Die Dokumentenanforderungen bleiben dabei gleich — nur die Art der Einreichung ändert sich."),
        empty(),
        para("Ein praktischer Zwischenschritt, den viele Käufer während der Bearbeitung ihres zyprischen Kontos nutzen: ein Revolut- oder Wise-Konto, das schneller eröffnet ist und eine erste Überweisung übergangsweise abwickeln kann."),
      ]),
      { _key: key(), _type: "faqBlock", marginBottom: "medium", faq: { _type: "accordionBlock", items: [
        faqItem("Muss ich persönlich nach Zypern reisen, um ein Konto zu eröffnen?", "Nicht immer. Mehrere Banken bieten digitale Kontoeröffnung für Gebietsfremde an, manche bevorzugen oder verlangen je nach Kontotyp aber weiterhin einen Filialbesuch."),
        faqItem("Wie lange dauert die Kontoeröffnung in Zypern?", "Mit vollständigen Unterlagen dauert ein unkomplizierter Antrag ein bis wenige Wochen. Fehlende Herkunftsnachweise sind die häufigste Ursache für Verzögerungen."),
        faqItem("Brauche ich ein zyprisches Bankkonto für den Immobilienkauf?", "Nicht zwingend für den Kauf selbst, aber die meisten Käufer eröffnen trotzdem eines für laufende Kosten wie Nebenkosten, Gemeinschaftsgebühren und Grundsteuer."),
        faqItem("Was, wenn mein Antrag abgelehnt wird?", "Banken müssen keinen detaillierten Grund nennen. In diesem Fall ist ein Revolut- oder Wise-Konto eine praktische Übergangslösung, während Sie die Dokumentationslücke bei einer anderen Bank schließen."),
      ] } },
      textBlock([
        para("Dieser Artikel spiegelt die allgemeinen Anforderungen Stand 2026 wider; einzelne Bankrichtlinien ändern sich ohne große Vorankündigung — bestätigen Sie den aktuellen Prozess direkt bei der Bank oder Ihrem Anwalt, bevor Sie sich bei einem zeitkritischen Kauf darauf verlassen."),
      ]),
    ],
  },
  pl: {
    title: "Jak założyć konto bankowe na Cyprze dla obcokrajowców (2026)",
    excerpt: "Jakie dokumenty są naprawdę potrzebne, które banki cypryjskie obsługują nierezydentów i ile to realnie trwa — praktyczny, aktualny przewodnik.",
    seo: { metaTitle: "Konto bankowe na Cyprze dla obcokrajowców: przewodnik 2026", metaDescription: "Realne wymagania dotyczące założenia konta bankowego na Cyprze jako zagraniczny nierezydent w 2026 roku — dokumenty, banki, zdalne otwarcie konta, realistyczne terminy." },
    blocks: [
      textBlock([
        para("Większość poradników na ten temat powtarza tę samą ogólnikową formułę: \"potrzebujesz dowodu tożsamości i potwierdzenia adresu\". To prawda, ale niepełna — realną trudnością dla zagranicznych kupujących jest udokumentowanie pochodzenia środków oraz rozszerzona weryfikacja KYC."),
      ]),
      textBlock([
        h2("Czy obcokrajowiec może założyć konto bankowe na Cyprze?"), empty(),
        para("Tak. Nie trzeba być rezydentem, a potwierdzenie adresu nie musi dotyczyć adresu na Cyprze — zwykle akceptowany jest aktualny rachunek za media lub wyciąg bankowy z kraju zamieszkania."),
      ]),
      textBlock([
        h2("Jakie dokumenty są naprawdę potrzebne"), empty(),
        para("Wymagania różnią się w zależności od banku, obywatelstwa, statusu rezydencyjnego i źródła dochodu, ale podstawowy zestaw jest stały:"),
        empty(),
        bullet("Ważny paszport (obywatele UE mogą czasem użyć dowodu osobistego, obywatele spoza UE potrzebują paszportu)"),
        bullet("Potwierdzenie adresu — rachunek za media lub wyciąg bankowy nie starszy niż 2-3 miesiące"),
        bullet("Potwierdzenie pochodzenia środków — odcinki wypłaty, zeznania podatkowe lub umowa sprzedaży, jeśli środki pochodzą ze sprzedaży nieruchomości"),
        bullet("Dla obywateli spoza UE: banki zwykle wymagają bardziej szczegółowej dokumentacji pochodzenia środków i przeprowadzają rozszerzoną weryfikację AML"),
        empty(),
        para("Jeśli konto zakładane jest specjalnie pod zakup nieruchomości, list referencyjny od prawnika oraz umowa rezerwacyjna lub sprzedaży znacznie przyspieszają etap potwierdzania pochodzenia środków."),
      ]),
      textBlock([
        h2("Które banki cypryjskie obsługują zagranicznych kupujących"), empty(),
        para("Trzy banki najczęściej wybierane przez międzynarodowych kupujących nieruchomości to Bank of Cyprus, Hellenic Bank i Eurobank Cyprus. Każdy prowadzi własny proces KYC i żaden nie gwarantuje zatwierdzenia — decyduje dobrze udokumentowane źródło środków, a nie to, który bank wybierze się jako pierwszy."),
      ]),
      textBlock([
        h2("Czy można otworzyć konto zdalnie?"), empty(),
        para("Kilka cypryjskich banków oferuje obecnie zdalne otwieranie konta dla nierezydentów, więc wizyta w oddziale nie zawsze jest konieczna. Wymagania dokumentowe pozostają te same — zmienia się tylko sposób ich złożenia."),
        empty(),
        para("Praktyczne rozwiązanie tymczasowe, z którego korzysta wielu kupujących w trakcie oczekiwania na konto cypryjskie: konto Revolut lub Wise, które otwiera się szybciej i może obsłużyć wstępny przelew."),
      ]),
      { _key: key(), _type: "faqBlock", marginBottom: "medium", faq: { _type: "accordionBlock", items: [
        faqItem("Czy muszę osobiście przyjechać na Cypr, aby założyć konto?", "Nie zawsze. Kilka banków oferuje zdalne otwarcie konta dla nierezydentów, choć niektóre w zależności od typu konta nadal preferują lub wymagają wizyty w oddziale."),
        faqItem("Ile czasu zajmuje otwarcie konta na Cyprze?", "Przy kompletnej dokumentacji prosty wniosek zajmuje od tygodnia do kilku tygodni. Najczęstszą przyczyną opóźnień jest brak dokumentacji pochodzenia środków."),
        faqItem("Czy potrzebuję cypryjskiego konta bankowego do zakupu nieruchomości?", "Nie jest to ściśle konieczne do samego zakupu, ale większość kupujących zakłada je i tak, aby obsługiwać bieżące koszty, jak media, opłaty wspólnotowe i podatek od nieruchomości."),
        faqItem("Co jeśli mój wniosek zostanie odrzucony?", "Banki nie muszą podawać szczegółowego powodu. W takiej sytuacji konto Revolut lub Wise to praktyczne rozwiązanie tymczasowe, podczas uzupełniania dokumentacji w innym banku."),
      ] } },
      textBlock([
        para("Ten artykuł odzwierciedla ogólne wymagania na 2026 rok; polityka poszczególnych banków zmienia się bez większego wyprzedzenia — przed zakupem wrażliwym na czas warto potwierdzić aktualny proces bezpośrednio w banku lub u prawnika."),
      ]),
    ],
  },
  ru: {
    title: "Как открыть счёт в банке на Кипре иностранцу (2026)",
    excerpt: "Какие документы реально нужны, какие банки Кипра работают с нерезидентами, сколько это занимает времени — и отдельно честно про ограничения для налоговых резидентов РФ.",
    seo: { metaTitle: "Открыть счёт в банке на Кипре иностранцу: гид 2026", metaDescription: "Реальные требования для открытия счёта в банке на Кипре иностранцем-нерезидентом в 2026 году — документы, банки, дистанционное открытие, ограничения для резидентов РФ." },
    blocks: [
      textBlock([
        para("Большинство статей на эту тему ограничиваются общей фразой «нужен паспорт и подтверждение адреса». Это верно, но неполно — реальная сложность для иностранных покупателей в подтверждении происхождения средств и расширенной проверке KYC. Отдельно и честно разберём ситуацию для налоговых резидентов РФ — она сейчас действительно другая."),
      ]),
      textBlock([
        h2("Может ли иностранец открыть счёт в банке на Кипре?"), empty(),
        para("Да. Резидентство не обязательно, и подтверждение адреса не обязано быть кипрским — обычно принимают недавний счёт за коммунальные услуги или банковскую выписку из страны проживания."),
      ]),
      textBlock([
        h2("Какие документы реально нужны"), empty(),
        para("Требования отличаются в зависимости от банка, гражданства, статуса резидентства и источника дохода, но базовый набор устойчив:"),
        empty(),
        bullet("Действующий загранпаспорт (гражданам ЕС иногда достаточно ID-карты, гражданам стран вне ЕС нужен именно загранпаспорт)"),
        bullet("Подтверждение адреса — счёт за коммунальные услуги или банковская выписка не старше 2–3 месяцев"),
        bullet("Подтверждение происхождения средств — справка о доходах, налоговая декларация или договор купли-продажи, если средства получены от продажи недвижимости"),
        bullet("Для граждан стран вне ЕС банки обычно требуют более детальное подтверждение источника средств и проводят расширенную проверку по противодействию отмыванию денег"),
        empty(),
        para("Если счёт открывается специально под покупку недвижимости, референс-письмо от юриста и договор резервации или купли-продажи заметно ускоряют этап подтверждения происхождения средств."),
      ]),
      textBlock([
        h2("Какие банки Кипра работают с иностранными покупателями"), empty(),
        para("Три банка, которые чаще всего используют международные покупатели недвижимости, — Bank of Cyprus, Hellenic Bank и Eurobank Cyprus. Каждый проводит собственную проверку KYC, и ни один не гарантирует одобрение — решающий фактор — чисто оформленное досье о происхождении средств, а не то, в какой банк обратиться первым."),
      ]),
      textBlock([
        h2("Ситуация для налоговых резидентов РФ — честно"), empty(),
        para("С 2022 года крупные банки Кипра заметно ужесточили работу с клиентами — налоговыми резидентами России: по имеющимся данным, Bank of Cyprus закрыл счета порядка 4000 клиентов, связанных с Россией (в том числе налоговых резидентов РФ и держателей ВНЖ), Hellenic Bank также ограничивает обслуживание таких клиентов."),
        empty(),
        para("Важно: речь именно о налоговом резидентстве России, а не о гражданстве или языке — русскоязычный покупатель без налогового резидентства РФ проходит стандартную процедуру. Политика банков меняется быстро, поэтому актуальный статус стоит уточнять напрямую в банке или у юриста перед сделкой, а не полагаться на эту статью как на окончательный ответ."),
        empty(),
        para("Практический промежуточный вариант, которым пользуются многие покупатели, пока решается вопрос с кипрским счётом, — счёт Revolut или Wise, который открывается быстрее и может временно обслужить первый перевод."),
      ]),
      { _key: key(), _type: "faqBlock", marginBottom: "medium", faq: { _type: "accordionBlock", items: [
        faqItem("Нужно ли лично приезжать на Кипр, чтобы открыть счёт?", "Не всегда. Некоторые банки предлагают дистанционное открытие счёта для нерезидентов, но в зависимости от типа счёта некоторые банки всё ещё предпочитают или требуют личного визита в отделение."),
        faqItem("Сколько времени занимает открытие счёта на Кипре?", "При полном пакете документов простая заявка обычно занимает от недели до нескольких недель. Самая частая причина задержки — неполный пакет документов о происхождении средств."),
        faqItem("Нужен ли кипрский банковский счёт для покупки недвижимости?", "Строго для самой сделки — не обязательно, но большинство покупателей всё равно открывают счёт для текущих расходов: коммунальные услуги, взносы на содержание комплекса, налог на недвижимость."),
        faqItem("Могут ли отказать в открытии счёта налоговым резидентам РФ?", "Да, это реальный и распространённый сценарий с 2022 года. Точную политику конкретного банка на текущий момент нужно уточнять напрямую — она меняется быстро."),
      ] } },
    ],
  },
};

async function main() {
  for (const [lang, cfg] of Object.entries(CONFIG)) {
    const c = CONTENT[lang];
    const existing = await prisma.blog.findUnique({ where: { language_slug: { language: lang, slug: cfg.slug } } });
    if (existing) { console.log(`SKIPPED ${lang}: ${cfg.slug} already exists (status: ${existing.status})`); continue; }
    const created = await prisma.blog.create({
      data: {
        sanityId: `local-${crypto.randomUUID()}`,
        language: lang,
        slug: cfg.slug,
        title: c.title,
        excerpt: c.excerpt,
        status: "DRAFT",
        authorId: cfg.authorId,
        categoryId: cfg.categoryId,
        seo: c.seo,
        contentBlocks: c.blocks,
      },
    });
    console.log(`Created DRAFT ${lang}: ${cfg.slug} (id: ${created.id})`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
