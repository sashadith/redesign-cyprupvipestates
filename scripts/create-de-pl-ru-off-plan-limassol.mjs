/* Content Offensive Plan, immediate item (not deferred to a calendar day —
   off-plan-properties-in-limassol's EN version was already differentiated
   from the Limassol cannibalization cluster on 2026-09-30; per the user's
   correction, ready work gets localized right away, not scheduled).

   Real localization, not translation, per each market's own competitor
   findings from today's deep-dive:
   - DE: buying-safety/trust is the open gap (xpert.digital/test.de own the
     "is it safe" narrative, no DE agency does) — leans into transparent
     process, verified developers, plain risk explanation.
   - PL: nieruchomoscinacyprze.pl and peers don't clearly differentiate
     South-Cyprus EU legal safety from North Cyprus — leans into that.
   - RU: Golden Visa/PR Category 6.2 framing already proven to work in this
     market (existing RU content performs well on this angle) — leans into
     investment/residency framing more than the other two.

   offPlanSnapshotBlock intentionally omitted: its live stats need a proper
   computeAvailability()-based query (the Development.unitsAvailable cache
   field is explicitly documented as unreliable), which this script doesn't
   attempt — matches off-plan-properties-in-larnaca, which also lacks this
   block already. Image asset reused from the EN page (same photo, only alt
   text localized) rather than sourcing new imagery. */
import fs from "node:fs";
import crypto from "node:crypto";
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
let k = 0;
const key = () => `olk${(k++).toString(36)}`;

function para(text) {
  return { _key: key(), _type: "block", style: "normal", markDefs: [], children: [{ _key: key(), _type: "span", marks: [], text }] };
}
function h2(text) {
  return { _key: key(), _type: "block", style: "h2", markDefs: [], children: [{ _key: key(), _type: "span", marks: [], text }] };
}
function textBlock(items) {
  return { _key: key(), _type: items.__type, content: items.filter((x) => x !== items.__type) };
}
function faqItem(question, answerText) {
  return { _key: key(), question, answer: [para(answerText)] };
}
const IMG = { alt: "", _type: "image", asset: { _ref: "image-7bbba15a54c361c20ae7dad88594db4099ab031e-1000x1000-jpg", _type: "reference" } };

const IMAGES = {
  de: { ...IMG, alt: "Off-Plan-Immobilien in Limassol | Neubauprojekte direkt vom Bauträger" },
  pl: { ...IMG, alt: "Nieruchomości na etapie budowy w Limassol | Inwestycje bezpośrednio od dewelopera" },
  ru: { ...IMG, alt: "Новостройки в Лимассоле | Покупка напрямую от застройщика" },
};

const PAGES = {
  de: {
    slug: "neubau-immobilien-limassol",
    title: "Off-Plan-Immobilien in Limassol",
    seo: {
      metaTitle: "Off-Plan-Immobilien Limassol: Direkt kaufen, ohne Provision",
      metaDescription: "Neubauwohnungen und Villen in Limassol direkt vom Bauträger kaufen — mit flexiblen Zahlungsplänen, ohne Maklerprovision und mit geprüften Entwicklern.",
    },
    intro: {
      title: "Off-Plan-Immobilien in Limassol",
      subtitle: "Exklusiver Direktverkauf",
      buttonLabel: "Anfrage senden",
      description: "Entdecken Sie Off-Plan-Immobilien in Limassol, Zypern. Kaufen Sie Luxuswohnungen und Villen direkt vom Bauträger — ohne Maklerprovision, mit geprüften Entwicklern und klar dokumentiertem Kaufprozess.",
    },
    projectsTitle: "Off-Plan-Immobilien in Limassol: Aktuelle Auswahl",
    h2_1: "Off-Plan in Limassol kaufen — ohne Maklerprovision, mit geprüften Bauträgern",
    p1_1: "Cyprus VIP Estates verkauft Off-Plan-Immobilien in Limassol — von Meerblick-Apartments bis zu modernen Villen — ausschließlich in Zusammenarbeit mit geprüften Bauträgern. Wir arbeiten nur mit Entwicklern, deren frühere Projekte tatsächlich fertiggestellt und übergeben wurden — das lässt sich vor dem Kauf prüfen, und wir stellen die entsprechenden Nachweise bereit.",
    p1_2: "Limassol ist das wirtschaftliche Zentrum Zyperns, mit stabiler Nachfrage aus Großbritannien, Skandinavien, Israel und den VAE. Für deutschsprachige Käufer ist der wichtigste Punkt meist nicht die Rendite, sondern die rechtliche Sicherheit — und genau die ist bei einem Off-Plan-Kauf in der Republik Zypern (EU-Mitglied, nicht zu verwechseln mit dem türkisch besetzten Nordteil der Insel) klar geregelt.",
    h2_2: "Was Off-Plan-Kauf bedeutet — und welche Risiken real sind",
    p2_1: "Off-Plan bedeutet: Sie kaufen eine Immobilie, bevor der Bau abgeschlossen ist, meist zu einem Preis unterhalb des späteren Marktwerts. Das eigentliche Risiko liegt nicht im Konzept selbst, sondern im gewählten Bauträger — Verzögerungen und Qualitätsprobleme entstehen fast immer bei Entwicklern ohne belegbare Erfolgsbilanz.",
    p2_2: "Deshalb arbeiten wir ausschließlich mit Bauträgern, deren frühere Projekte nachweislich fertiggestellt wurden. Der Kaufvertrag wird zusätzlich beim Landregisteramt hinterlegt (Specific Performance-Schutz nach zyprischem Recht) — das schützt Ihre Zahlungen auch dann, wenn mit dem Grundstück oder dem Bauträger später etwas nicht stimmen sollte.",
    h2_3: "Vorteile des Off-Plan-Kaufs in Limassol",
    p3_1: "Günstigerer Einstiegspreis mit Wertsteigerungspotenzial",
    p3_2: "Off-Plan-Immobilien werden in der Bauphase typischerweise unter dem späteren Marktwert angeboten. Mit Baufortschritt und Fertigstellung steigt der Wert in der Regel an.",
    p3_3: "Flexible Zahlungspläne direkt mit dem Bauträger",
    p3_4: "Zahlungen werden meist an Baufortschritt-Meilensteine gekoppelt, verteilt über mehrere Monate oder Jahre — deutlich planbarer als eine Einmalzahlung.",
    p3_5: "Moderne Bauweise nach aktuellen Standards",
    p3_6: "Alle Off-Plan-Projekte in Limassol entstehen nach zeitgemäßen Energie- und Bauqualitätsstandards, häufig mit Smart-Home-Technik.",
    p3_7: "Keine Maklerprovision",
    p3_8: "Käufer bei Cyprus VIP Estates zahlen keine zusätzlichen Gebühren — wir werden ausschließlich vom Bauträger vergütet, nicht vom Käufer.",
    faq: [
      ["Kann ich als Ausländer aus der Ferne kaufen?", "Ja. Internationale Käufer können Off-Plan-Immobilien in Zypern vollständig remote erwerben — mit rechtlicher Begleitung und elektronischer oder vollmachtbasierter Abwicklung der Dokumente."],
      ["Wie sicher ist ein Off-Plan-Kauf wirklich?", "Das Hauptrisiko liegt beim Bauträger, nicht beim Kaufmodell selbst. Wir arbeiten ausschließlich mit Entwicklern, deren frühere Projekte nachweislich fertiggestellt wurden, und der Kaufvertrag wird beim Landregisteramt hinterlegt — das schützt Ihre Zahlungen rechtlich, auch bei späteren Problemen mit Grundstück oder Bauträger."],
      ["Wie lange dauert es bis zum Einzug?", "Bauzeiten variieren je nach Projekt, typischerweise 12 bis 36 Monate. Bauträger stellen detaillierte Zeitpläne und regelmäßige Baufortschrittsberichte bereit."],
      ["Berechtigt eine Off-Plan-Immobilie zur zyprischen Aufenthaltsgenehmigung?", "Ja. Ab einer Investition von 300.000 € (zzgl. MwSt.) in eine Neubauimmobilie können ausländische Käufer die unbefristete Aufenthaltsgenehmigung im Schnellverfahren (Regulation 6.2) beantragen."],
      ["Kann ich die Immobilie nach Fertigstellung vermieten?", "Ja. Nach Fertigstellung und Ausstellung der Eigentumsurkunde können Sie kurz- oder langfristig vermieten. Der Mietmarkt in Limassol ist stabil, mit entsprechend guten Renditeaussichten."],
    ],
    h2_4: "Verfügbare Off-Plan-Immobilientypen in Limassol",
    p4_1: "Off-Plan-Apartments",
    p4_2: "Luxuswohnungen und Penthouses gehören zu den gefragtesten Optionen — ob in Meereslage nahe der Limassol Marina oder in ruhigeren, familienfreundlichen Lagen.",
    p4_3: "Luxusvillen und Häuser",
    p4_4: "In Stadtteilen wie Agios Tychonas, Amathus und Pareklisia entstehen hochwertige Villenprojekte, häufig mit privatem Pool und Meerblick.",
    h2_5: "Ablauf eines Off-Plan-Kaufs in Limassol",
    p5_1: "Nach Auswahl des Projekts wird die Reservierung fixiert, der Kaufvertrag geprüft und beim Landregisteramt hinterlegt. Während der Bauphase erhalten Sie regelmäßige Fortschrittsberichte mit Fotos.",
    p5_2: "Für Käufer mit Interesse an einer zyprischen Aufenthaltsgenehmigung: Ab 300.000 € (zzgl. MwSt.) in eine qualifizierende Neubauimmobilie ist der Schnellverfahren-Antrag möglich.",
    h2_6: "Warum Limassol für Off-Plan-Investitionen",
    p6_1: "Limassol bleibt Zyperns führender Immobilienmarkt, mit anhaltender Nachfrage aus Großbritannien, Skandinavien, Israel und den VAE. Moderne Infrastruktur — Limassol Marina, internationale Schulen, Geschäftszentren — hat die Stadt in den letzten Jahren spürbar verändert.",
  },
  pl: {
    slug: "nowe-inwestycje-limassol",
    title: "Nieruchomości na etapie budowy w Limassol",
    seo: {
      metaTitle: "Nowe inwestycje Limassol: kup bezpośrednio od dewelopera",
      metaDescription: "Mieszkania i wille na etapie budowy w Limassol na Cyprze — bezpośrednio od zweryfikowanego dewelopera, bez prowizji agencyjnej, z elastycznym planem płatności.",
    },
    intro: {
      title: "Nieruchomości na etapie budowy w Limassol",
      subtitle: "Sprzedaż bezpośrednia",
      buttonLabel: "Wyślij zapytanie",
      description: "Poznaj ofertę nieruchomości na etapie budowy w Limassol na Cyprze. Kupuj luksusowe apartamenty i wille bezpośrednio od dewelopera — bez prowizji agencyjnej, z pełną dokumentacją prawną i inwestycją zabezpieczoną zgodnie z prawem cypryjskim (Republika Cypru, państwo członkowskie UE).",
    },
    projectsTitle: "Aktualne inwestycje w budowie w Limassol",
    h2_1: "Kupno nieruchomości w budowie w Limassol — bezpiecznie i bez prowizji",
    p1_1: "Cyprus VIP Estates sprzedaje nieruchomości na etapie budowy w Limassol — od apartamentów z widokiem na morze po nowoczesne wille — wyłącznie we współpracy ze zweryfikowanymi deweloperami. Współpracujemy jedynie z firmami, których wcześniejsze inwestycje zostały faktycznie ukończone i przekazane nabywcom — to można zweryfikować przed zakupem, a my udostępniamy odpowiednie dokumenty.",
    p1_2: "Limassol to gospodarcze centrum Cypru, ze stabilnym popytem z Wielkiej Brytanii, Skandynawii, Izraela i ZEA. Dla polskiego kupującego kluczowa jest często nie tylko rentowność, ale pewność prawna — a Republika Cypru jako członek UE od 2004 roku daje w tym zakresie jasne, egzekwowalne prawa (w odróżnieniu od okupowanej przez Turcję północnej części wyspy, gdzie tytuł własności nie ma takiej samej ochrony).",
    h2_2: "Na czym polega zakup na etapie budowy — i jakie ryzyko jest realne",
    p2_1: "Zakup na etapie budowy oznacza nabycie nieruchomości przed ukończeniem budowy, zwykle po cenie niższej niż późniejsza wartość rynkowa. Realne ryzyko dotyczy nie samej formuły zakupu, lecz wybranego dewelopera — opóźnienia i problemy jakościowe niemal zawsze dotyczą firm bez udokumentowanej historii ukończonych projektów.",
    p2_2: "Dlatego współpracujemy wyłącznie z deweloperami o potwierdzonej historii realizacji. Umowa kupna jest dodatkowo deponowana w Wydziale Ksiąg Wieczystych (specific performance) zgodnie z prawem cypryjskim — to chroni wpłacone środki nawet w razie problemów z gruntem lub deweloperem w przyszłości.",
    h2_3: "Zalety zakupu nieruchomości na etapie budowy w Limassol",
    p3_1: "Niższa cena wejścia i potencjał wzrostu wartości",
    p3_2: "Nieruchomości na etapie budowy są zwykle oferowane poniżej przyszłej wartości rynkowej. Wraz z postępem budowy i jej ukończeniem wartość zazwyczaj rośnie.",
    p3_3: "Elastyczny harmonogram płatności z deweloperem",
    p3_4: "Płatności są zwykle powiązane z etapami budowy, rozłożone na kilka miesięcy lub lat — znacznie wygodniejsze niż jednorazowa wpłata.",
    p3_5: "Nowoczesne standardy budowy",
    p3_6: "Wszystkie inwestycje w budowie w Limassol powstają zgodnie z aktualnymi standardami energetycznymi, często z rozwiązaniami smart home.",
    p3_7: "Brak prowizji agencyjnej",
    p3_8: "Klienci Cyprus VIP Estates nie ponoszą dodatkowych opłat — wynagrodzenie otrzymujemy wyłącznie od dewelopera, nigdy od kupującego.",
    faq: [
      ["Czy mogę kupić nieruchomość zdalnie, będąc za granicą?", "Tak. Zagraniczni nabywcy mogą kupić nieruchomość na etapie budowy na Cyprze całkowicie zdalnie — z pełnym wsparciem prawnym i dokumentacją obsługiwaną elektronicznie lub przez pełnomocnika."],
      ["Jak bezpieczny jest zakup na etapie budowy?", "Główne ryzyko dotyczy dewelopera, nie samej formuły zakupu. Współpracujemy wyłącznie z firmami o potwierdzonej historii ukończonych inwestycji, a umowa jest deponowana w Wydziale Ksiąg Wieczystych — to chroni wpłacone środki prawnie, nawet przy późniejszych problemach z gruntem lub deweloperem."],
      ["Ile czasu zajmuje budowa?", "Czas budowy zależy od projektu, zwykle od 12 do 36 miesięcy. Deweloperzy udostępniają szczegółowe harmonogramy i regularne raporty z postępu prac."],
      ["Czy zakup na etapie budowy uprawnia do pobytu stałego na Cyprze?", "Tak. Przy inwestycji od 300 000 € (plus VAT) w nową nieruchomość, zagraniczni nabywcy mogą ubiegać się o prawo stałego pobytu w trybie przyspieszonym (Regulacja 6.2)."],
      ["Czy mogę wynajmować nieruchomość po ukończeniu budowy?", "Tak. Po ukończeniu i wydaniu aktu własności można wynajmować krótko- lub długoterminowo. Rynek najmu w Limassol jest stabilny, co przekłada się na dobry zwrot z inwestycji."],
    ],
    h2_4: "Rodzaje nieruchomości w budowie dostępne w Limassol",
    p4_1: "Apartamenty na etapie budowy",
    p4_2: "Luksusowe apartamenty i penthouse'y należą do najpopularniejszych opcji — zarówno w lokalizacji nadmorskiej blisko Limassol Marina, jak i w spokojniejszych, rodzinnych dzielnicach.",
    p4_3: "Luksusowe wille i domy",
    p4_4: "W dzielnicach takich jak Agios Tychonas, Amathus i Pareklisia powstają wille wysokiej klasy, często z prywatnym basenem i widokiem na morze.",
    h2_5: "Jak przebiega zakup na etapie budowy w Limassol",
    p5_1: "Po wyborze inwestycji następuje rezerwacja, weryfikacja umowy i jej depozyt w Wydziale Ksiąg Wieczystych. W trakcie budowy otrzymują Państwo regularne raporty z postępu prac wraz ze zdjęciami.",
    p5_2: "Dla kupujących zainteresowanych pobytem stałym: przy inwestycji od 300 000 € (plus VAT) w kwalifikującą się nieruchomość możliwy jest wniosek w trybie przyspieszonym.",
    h2_6: "Dlaczego Limassol na inwestycje w budowie",
    p6_1: "Limassol pozostaje wiodącym rynkiem nieruchomości na Cyprze, z utrzymującym się popytem z Wielkiej Brytanii, Skandynawii, Izraela i ZEA. Nowoczesna infrastruktura — Limassol Marina, międzynarodowe szkoły, centra biznesowe — wyraźnie zmieniła miasto w ostatnich latach.",
  },
  ru: {
    slug: "novostroyki-v-limassole",
    title: "Новостройки в Лимассоле",
    seo: {
      metaTitle: "Новостройки в Лимассоле: купить напрямую от застройщика",
      metaDescription: "Квартиры и виллы на этапе строительства в Лимассоле — напрямую от проверенного застройщика, без комиссии агентству, с гибким графиком платежей.",
    },
    intro: {
      title: "Новостройки в Лимассоле",
      subtitle: "Прямые продажи от застройщика",
      buttonLabel: "Оставить заявку",
      description: "Подборка новостроек в Лимассоле, Кипр. Покупайте квартиры и виллы премиум-класса напрямую от застройщика — без комиссии агентству, с проверенными девелоперами и правом на Cyprus Permanent Residency при инвестиции от €300,000.",
    },
    projectsTitle: "Список новостроек в Лимассоле",
    h2_1: "Покупка новостройки в Лимассоле — без комиссии, с проверенными застройщиками",
    p1_1: "Cyprus VIP Estates продаёт новостройки в Лимассоле — от апартаментов с видом на море до современных вилл — исключительно в сотрудничестве с проверенными застройщиками. Мы работаем только с девелоперами, чьи предыдущие проекты были реально сданы, — это можно проверить до покупки, и мы предоставляем подтверждающие данные.",
    p1_2: "Лимассол — деловой центр Кипра, со стабильным спросом со стороны покупателей из Великобритании, Скандинавии, Израиля и ОАЭ. Для многих русскоязычных покупателей ключевой мотив — не только доходность, но и право на постоянный вид на жительство: инвестиция от €300,000 в новую недвижимость даёт право на ускоренное оформление ПМЖ по программе Regulation 6.2.",
    h2_2: "Что значит купить недвижимость на этапе строительства — и какие риски реальны",
    p2_1: "Покупка на этапе строительства означает приобретение объекта до завершения строительства, обычно по цене ниже будущей рыночной стоимости. Реальный риск связан не с самой схемой покупки, а с выбором застройщика — задержки и проблемы с качеством почти всегда возникают у девелоперов без подтверждённой истории сданных проектов.",
    p2_2: "Поэтому мы работаем только с застройщиками, чьи предыдущие проекты были реально завершены. Договор купли-продажи дополнительно депонируется в Земельном кадастре (Specific Performance по кипрскому законодательству) — это защищает внесённые средства даже при возможных проблемах с землёй или застройщиком в будущем.",
    h2_3: "Преимущества покупки новостройки в Лимассоле",
    p3_1: "Более низкая цена входа с потенциалом роста стоимости",
    p3_2: "Новостройки на этапе строительства обычно предлагаются ниже будущей рыночной стоимости. По мере завершения строительства цена, как правило, растёт.",
    p3_3: "Гибкий график платежей напрямую с застройщиком",
    p3_4: "Платежи обычно привязаны к этапам строительства и распределены на несколько месяцев или лет — это удобнее единовременной оплаты.",
    p3_5: "Современные стандарты строительства",
    p3_6: "Все новостройки в Лимассоле строятся по актуальным энергоэффективным стандартам, часто с технологиями умного дома.",
    p3_7: "Без комиссии агентству",
    p3_8: "Клиенты Cyprus VIP Estates не платят дополнительных комиссий — мы получаем вознаграждение только от застройщика, а не от покупателя.",
    faq: [
      ["Можно ли купить недвижимость удалённо, находясь за границей?", "Да. Иностранные покупатели могут приобрести новостройку на Кипре полностью удалённо — с полным юридическим сопровождением и оформлением документов электронно или по доверенности."],
      ["Насколько безопасна покупка на этапе строительства?", "Главный риск связан с застройщиком, а не с самой схемой покупки. Мы работаем только с девелоперами, чьи предыдущие проекты были реально сданы, а договор депонируется в Земельном кадастре — это защищает внесённые средства юридически, даже при возможных проблемах с землёй или застройщиком."],
      ["Сколько времени занимает строительство?", "Сроки строительства зависят от проекта, обычно от 12 до 36 месяцев. Застройщики предоставляют подробные графики и регулярные отчёты о ходе строительства."],
      ["Даёт ли покупка новостройки право на резидентство Кипра?", "Да. При инвестиции от €300,000 (плюс НДС) в новую недвижимость иностранные покупатели могут подать на постоянный вид на жительство по ускоренной программе Regulation 6.2."],
      ["Можно ли сдавать объект в аренду после завершения строительства?", "Да. После завершения строительства и получения права собственности объект можно сдавать в краткосрочную или долгосрочную аренду. Рынок аренды в Лимассоле стабилен и обеспечивает хорошую доходность."],
    ],
    h2_4: "Типы новостроек, доступные в Лимассоле",
    p4_1: "Квартиры на этапе строительства",
    p4_2: "Апартаменты и пентхаусы премиум-класса — один из самых востребованных вариантов, будь то у моря рядом с Limassol Marina или в более спокойных семейных районах.",
    p4_3: "Виллы и дома премиум-класса",
    p4_4: "В районах Agios Tychonas, Amathus и Pareklisia строятся виллы высокого класса, часто с собственным бассейном и видом на море.",
    h2_5: "Как проходит покупка новостройки в Лимассоле",
    p5_1: "После выбора проекта фиксируется резервация, проверяется договор, который затем депонируется в Земельном кадастре. В процессе строительства вы получаете регулярные отчёты о ходе работ с фотографиями.",
    p5_2: "Для покупателей, заинтересованных в резидентстве: при инвестиции от €300,000 (плюс НДС) в подходящий объект доступна подача заявки по ускоренной программе.",
    h2_6: "Почему Лимассол — приоритет для инвестиций в новостройки",
    p6_1: "Лимассол остаётся ведущим рынком недвижимости Кипра, с устойчивым спросом со стороны покупателей из Великобритании, Скандинавии, Израиля и ОАЭ. Современная инфраструктура — Limassol Marina, международные школы, деловые центры — заметно изменила город за последние годы.",
  },
};

function buildBlocks(p) {
  return [
    { _key: key(), _type: "landingIntroBlock", image: IMAGES[p.__lang], title: p.intro.title, subtitle: p.intro.subtitle, buttonLabel: p.intro.buttonLabel, description: p.intro.description },
    { _key: key(), _type: "landingProjectsBlock", title: p.projectsTitle, filterCity: "Limassol" },
    {
      _key: key(), _type: "landingTextFirst",
      content: [
        h2(p.h2_1), para(p.p1_1), para(p.p1_2),
        h2(p.h2_2), para(p.p2_1), para(p.p2_2),
        h2(p.h2_3), para(p.p3_1), para(p.p3_2), para(p.p3_3), para(p.p3_4), para(p.p3_5), para(p.p3_6), para(p.p3_7), para(p.p3_8),
      ],
    },
    { _key: key(), _type: "landingFaqBlock", title: { de: "Häufig gestellte Fragen", pl: "Najczęściej zadawane pytania", ru: "Часто задаваемые вопросы" }[p.__lang], faq: { _type: "accordionBlock", items: p.faq.map(([q, a]) => faqItem(q, a)) } },
    {
      _key: key(), _type: "landingTextSecond",
      content: [
        h2(p.h2_4), para(p.p4_1), para(p.p4_2), para(p.p4_3), para(p.p4_4),
        h2(p.h2_5), para(p.p5_1), para(p.p5_2),
        h2(p.h2_6), para(p.p6_1),
      ],
    },
  ];
}

async function main() {
  const en = await prisma.singlepage.findFirst({ where: { slug: "off-plan-properties-in-limassol", language: "en" }, select: { id: true, translationGroupId: true } });
  if (!en) throw new Error("ABORT: EN source page not found");

  const groupId = en.translationGroupId || crypto.randomUUID();
  const created = [];
  for (const lang of ["de", "pl", "ru"]) {
    const p = { ...PAGES[lang], __lang: lang };
    const existing = await prisma.singlepage.findUnique({ where: { language_slug: { language: lang, slug: p.slug } } });
    if (existing) {
      console.log(`SKIPPED ${lang}: ${p.slug} already exists (status: ${existing.status})`);
      continue;
    }
    const row = await prisma.singlepage.create({
      data: {
        sanityId: `local-${crypto.randomUUID()}`,
        translationGroupId: groupId,
        language: lang,
        slug: p.slug,
        title: p.title,
        excerpt: p.intro.description.slice(0, 200),
        status: "PUBLISHED",
        previewImage: IMAGES[lang],
        seo: p.seo,
        contentBlocks: buildBlocks(p),
      },
    });
    created.push({ lang, slug: p.slug, id: row.id });
    console.log(`Created ${lang}: ${p.slug}`);
  }

  if (!en.translationGroupId) {
    await prisma.singlepage.update({ where: { id: en.id }, data: { translationGroupId: groupId } });
    console.log("Linked EN page under the shared translationGroupId", groupId);
  }

  console.log("\nDone.", created.length, "new language versions created.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
