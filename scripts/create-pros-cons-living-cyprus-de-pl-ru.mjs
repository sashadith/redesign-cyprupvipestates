/* Content Offensive Plan Track B — "Pros and Cons of Living in Cyprus",
   DE/PL/RU localizations (the user pushed back on the plan's own
   EN-only default for this topic, correctly: unlike the persona-specific
   UK/US/Canada landing pages, "pros and cons of living somewhere" has no
   audience mismatch — every market wants this). Real localization, not
   translation: DE cross-references the banking article's CRS section to
   avoid an apparent contradiction between "tax benefits" and "automatic
   reporting"; PL expands the North/South Cyprus section specifically,
   since that was the most-searched, least-served PL topic found in
   today's competitor deep-dive (cypr południowy, 2,900/mo).

   Both user corrections from the EN review applied from the start this
   time: keyword-carrying H2/H3s, and substantive (3-5 sentence) FAQ
   answers with real added information, not restated summaries.

   SCHEDULED for Fri 02.10 09:00 Cyprus time, same slot as the EN version
   and villas-limassol. Linked under the EN post's translationGroupId
   (assigning one since it was null). */
import fs from "node:fs";
import crypto from "node:crypto";
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
let k = 0;
const key = () => `pcx${(k++).toString(36)}`;
const SCHEDULED_AT = new Date("2026-10-02T06:00:00.000Z");

function span(text, strong) { return { _key: key(), _type: "span", marks: strong ? ["strong"] : [], text }; }
function para(...parts) { return { _key: key(), _type: "block", style: "normal", markDefs: [], children: parts.map((p) => (Array.isArray(p) ? span(p[0], true) : span(p, false))) }; }
function empty() { return para(""); }
function h2(text) { return { _key: key(), _type: "block", style: "h2", markDefs: [], children: [span(text)] }; }
function h3(text) { return { _key: key(), _type: "block", style: "h3", markDefs: [], children: [span(text)] }; }
function textBlock(content) { return { _key: key(), _type: "textContent", textAlign: "left", content }; }
function faqItem(question, answerText) { return { _key: key(), question, answer: [para(answerText)] }; }
function faqBlock(items) { return { _key: key(), _type: "faqBlock", marginBottom: "medium", faq: { _type: "accordionBlock", items: items.map(([q, a]) => faqItem(q, a)) } }; }

const CONFIG = {
  de: { slug: "vor-und-nachteile-leben-auf-zypern", authorId: "d037f6f1-061a-4f0a-9d71-07539a6ba946", categoryId: "96f238cd-946b-4071-b50a-c0574925d8ac" },
  pl: { slug: "wady-i-zalety-zycia-na-cyprze", authorId: "9a01d81f-61b3-4b25-b072-1a84584f90bd", categoryId: "81f962cd-0f16-4acc-a7e6-584a5337a892" },
  ru: { slug: "plyusy-i-minusy-zhizni-na-kipre", authorId: "1253fa77-5bd7-4243-9d64-da11cb2d8ae6", categoryId: "f5af70ed-8b6c-45d9-96d2-222384da2cfa" },
};

const CONTENT = {
  de: {
    title: "Vor- und Nachteile des Lebens auf Zypern (2026)",
    excerpt: "Die ehrliche, aktuelle Version für 2026 — echte Zahlen zu Sicherheit, Gesundheitssystem, Wirtschaft, Schengen-Status und den realen Nachteilen.",
    seo: { metaTitle: "Vor- und Nachteile Zypern 2026: Leben auf der Insel", metaDescription: "Reale Zahlen 2026 zum Leben auf Zypern: Sicherheit, Gesundheitssystem GeSY, Wirtschaft, Schengen-Status, Lebenshaltungskosten und ehrliche Nachteile." },
    intro: "Die meisten \"Vor- und Nachteile\"-Ratgeber zu Zypern wiederholen dieselbe Liste, oft mit veralteten Zahlen. Hier die ehrliche, aktuelle Version für 2026 — mit echten Zahlen statt recycelten Eindrücken.",
    pros: [
      ["Ist Zypern sicher? Ein Land mit wirklich niedriger Kriminalität", "Zypern erreicht 90 von 100 Punkten im Sicherheitsindex. Schwere Kriminalität ist selten, die meisten erfassten Delikte sind Kleindiebstähle in touristischen Zonen — kein Faktor für den Alltag in Wohngebieten."],
      ["Gesundheitssystem auf Zypern: Wie GeSY funktioniert", "Das staatliche Gesundheitssystem GeSY (seit 2019) gibt registrierten Einwohnern Zugang zu Hausärzten, Fachärzten, Krankenhausbehandlung und Medikamenten, finanziert über einkommensabhängige Beiträge. Wartezeiten bei manchen Fachärzten können länger sein als privat, aber es ist ein echtes, funktionierendes System."],
      ["Die Wirtschaft Zyperns 2026: stärker als der EU-Durchschnitt", "Die zyprische Wirtschaft wuchs im ersten Halbjahr 2026 um 3,3% — mehr als dreimal so schnell wie der EU-Durchschnitt, getragen von Tourismus, Finanzdienstleistungen und Bauwirtschaft. Die Inflation liegt bei rund 3,5% (Stand August 2026)."],
      ["Ist Zypern im Schengen-Raum?", "Noch nicht — Zypern ist neben Irland eines von nur zwei EU-Mitgliedstaaten außerhalb Schengens. Das ändert sich gerade: Die EU-Kommission gab Mitte 2026 eine positive Bewertung der technischen Bereitschaft ab, im September 2026 ging die Frage zur Abstimmung an den Rat der EU — einstimmige Zustimmung der 25 bereits teilnehmenden Staaten vorausgesetzt."],
      ["Steuervorteile auf Zypern für Einwohner und Investoren", "Keine Erbschaftssteuer, niedrige Grunderwerbskosten und — für qualifizierende Non-Dom-Steuerresidenten — erhebliche Befreiungen auf Dividenden- und Zinserträge. Ein realer struktureller Vorteil, dessen Details individuell geprüft werden sollten. Zur Steuertransparenz: Zypern meldet Kontodaten automatisch im Rahmen von CRS — die steuerlichen Vorteile bestehen unabhängig davon und sind kein Widerspruch zur Meldepflicht."],
    ],
    cons: [
      ["Bürokratie auf Zypern: Warum alles länger dauert", "Die häufigste Beschwerde unter Auswanderern: Fahrzeugzulassung, Aufenthaltsgenehmigungen und andere Behördengänge dauern regelmäßig länger als angegeben. Mit Zeitpuffer planen."],
      ["Öffentlicher Nahverkehr auf Zypern: Warum Sie ein Auto brauchen", "Es gibt kein Schienennetz. Busse sind günstig, aber Taktung und Zuverlässigkeit schwanken stark je nach Region — dicht in Nikosia und Limassol, dünn fast überall sonst."],
      ["Wasserknappheit auf Zypern: ein reales Thema", "Zypern ist eine wasserarme Insel, abhängig von Entsalzung und Reservoirmanagement. In trockenen Jahren kommt es zu Einschränkungen bei Gartenbewässerung und Poolbefüllung."],
      ["Sommerhitze auf Zypern: wie intensiv es wirklich wird", "Spitzentemperaturen erreichen im Landesinneren regelmäßig 40°C, auch Küstengebiete verzeichnen wochenlang hohe 30er-Werte. Juli und August bedeuten reale Anpassung, nicht nur \"sonniges Mittelmeerklima\"."],
      ["Der Arbeitsmarkt auf Zypern: enger als die Broschüren suggerieren", "Tourismus, Finanz- und Rechtsdienstleistungen sowie Immobilien florieren. Tech, Forschung und Kreativberufe sind dünn gesät, Gehälter liegen meist unter westeuropäischem Niveau."],
      ["Die Kosten für importierte Waren auf Zypern", "Als Inselwirtschaft zahlt Zypern einen realen Aufschlag auf importierte Waren — spürbar im Supermarkt und bei allem, was nicht lokal produziert wird."],
    ],
    faq: [
      ["Ist Zypern 2026 ein guter Ort zum Leben?", "Das hängt stark davon ab, was Ihnen wichtig ist. Für Rentner, Remote-Arbeitende mit ausländischem Einkommen und Investoren spricht die Kombination aus Sicherheit, Klima, funktionierendem Gesundheitssystem und echten Steuervorteilen klar dafür — zumal die Wirtschaft aktuell dreimal so schnell wächst wie der EU-Durchschnitt. Schwächer geeignet ist Zypern für alle, die lokal außerhalb von Tourismus, Finanzwesen oder Immobilien Karriere machen wollen, da Gehälter in den meisten anderen Branchen unter westeuropäischem Niveau liegen, und für alle, die nicht bereit sind, viel Auto zu fahren oder mit langsamer Verwaltung zu leben."],
      ["Ist Zypern im Schengen-Raum?", "Noch nicht, Stand September 2026. Neben Irland ist Zypern eines von nur zwei EU-Staaten außerhalb Schengens — in der Praxis bedeutet das Passkontrollen bei Ein- und Ausreise, auch für EU-Bürger. Das ändert sich gerade real: die EU-Kommission gab Mitte 2026 eine positive Bewertung ab, im September 2026 ging die Frage an den Rat der EU, der einstimmige Zustimmung der 25 bereits teilnehmenden Staaten benötigt. Bis ein konkretes Beitrittsdatum feststeht, sollte man die zusätzliche Zeit für Passkontrollen realistisch einplanen."],
      ["Ist Zypern sicher?", "Ja, mit 90 von 100 Punkten im Sicherheitsindex gehört Zypern zu den sichereren Ländern Europas, und schwere Kriminalität ist tatsächlich selten. Was an Kriminalität vorkommt, konzentriert sich auf Kleindiebstähle in dicht besuchten Touristenzonen zur Hochsaison — ein anderes Risikoprofil als das, was Einwohner in ruhigen Küstenorten typischerweise erleben. Das stellt Zypern deutlich vor den meisten westeuropäischen Großstädten bei der alltäglichen persönlichen Sicherheit."],
      ["Wie hoch sind die Lebenshaltungskosten auf Zypern?", "Eine realistische Basis für 2026 liegt bei rund 2.100 $/Monat für eine Einzelperson inklusive Miete, oder 2.000–2.500 €/Monat für ein Paar. Die Miete ist der größte Schwankungsfaktor: eine Stadtwohnung in Limassol kostet spürbar mehr als eine vergleichbare Wohnung in Paphos. Im Vergleich zu Portugal ist Zypern für Alleinstehende rund 8% günstiger — insgesamt günstiger als die meisten westeuropäischen Hauptstädte, aber solides Mittelfeld, kein Billigziel."],
      ["Was ist der größte Nachteil beim Leben auf Zypern?", "Bürokratie wird am häufigsten genannt — Behördengänge dauern regelmäßig länger als offiziell angegeben, ohne verlässliche Abkürzung außer eingeplantem Zeitpuffer. Direkt danach folgt die Autoabhängigkeit: ohne Schienennetz und mit lückenhaftem Busangebot außerhalb von Nikosia und Limassol schränkt ein fehlendes Auto den Alltag spürbar ein. Beides ist kein Ausschlusskriterium, sollte aber von Anfang an eingeplant werden."],
    ],
  },
  pl: {
    title: "Wady i zalety życia na Cyprze (2026)",
    excerpt: "Uczciwa, aktualna wersja na 2026 rok — prawdziwe liczby o bezpieczeństwie, opiece zdrowotnej, gospodarce, statusie Schengen i realnych wadach.",
    seo: { metaTitle: "Wady i zalety Cypru 2026: życie na wyspie", metaDescription: "Realne dane 2026 o życiu na Cyprze: bezpieczeństwo, system GeSY, gospodarka, status Schengen, koszty życia i uczciwe wady." },
    intro: "Większość poradników \"wady i zalety\" o Cyprze powtarza tę samą listę, często z nieaktualnymi danymi. Oto uczciwa, aktualna wersja na 2026 rok — z prawdziwymi liczbami, nie z przepisywanymi wrażeniami.",
    pros: [
      ["Czy Cypr jest bezpieczny? Kraj o naprawdę niskiej przestępczości", "Cypr osiąga 90 na 100 punktów w indeksie bezpieczeństwa. Poważna przestępczość jest rzadka, większość odnotowanych przestępstw to drobne kradzieże w strefach turystycznych."],
      ["Opieka zdrowotna na Cyprze: jak działa system GeSY", "Powszechny system opieki zdrowotnej GeSY (od 2019) daje zarejestrowanym mieszkańcom dostęp do lekarzy rodzinnych, specjalistów, leczenia szpitalnego i leków, finansowany ze składek zależnych od dochodu."],
      ["Gospodarka Cypru w 2026 roku: szybciej niż średnia UE", "Gospodarka Cypru wzrosła o 3,3% w pierwszej połowie 2026 roku — ponad trzykrotnie szybciej niż średnia UE, napędzana turystyką, usługami finansowymi i budownictwem. Inflacja wynosi około 3,5% (sierpień 2026)."],
      ["Czy Cypr należy do strefy Schengen?", "Jeszcze nie — obok Irlandii, Cypr jest jednym z tylko dwóch państw UE poza Schengen. To się zmienia: Komisja Europejska wydała w połowie 2026 roku pozytywną ocenę gotowości technicznej, a we wrześniu 2026 sprawa trafiła pod głosowanie Rady UE, wymagające jednomyślnej zgody 25 państw już uczestniczących."],
      ["Korzyści podatkowe na Cyprze dla mieszkańców i inwestorów", "Brak podatku od spadków, niskie koszty przeniesienia własności oraz — dla kwalifikujących się nierezydentów podatkowych (non-dom) — istotne zwolnienia z podatku od dywidend i odsetek. Realna, strukturalna korzyść, której szczegóły warto zweryfikować indywidualnie."],
    ],
    cons: [
      ["Biurokracja na Cyprze: dlaczego wszystko trwa dłużej", "Najczęstsza skarga wśród emigrantów: rejestracja pojazdów, pozwolenia na pobyt i inne procesy urzędowe regularnie trwają dłużej niż deklarowane terminy."],
      ["Transport publiczny na Cyprze: dlaczego potrzebny jest samochód", "Na wyspie nie ma sieci kolejowej. Autobusy są tanie, ale częstotliwość i niezawodność mocno zależą od regionu — gęste w Nikozji i Limassol, rzadkie niemal wszędzie indziej."],
      ["Niedobór wody na Cyprze: realny problem", "Cypr to wyspa z realnym deficytem wody, zależna od odsalania i zarządzania zbiornikami. W suchych latach pojawiają się ograniczenia dotyczące podlewania ogrodów czy napełniania basenów."],
      ["Upały na Cyprze: jak naprawdę intensywne są lata", "Szczytowe temperatury w głębi lądu regularnie sięgają 40°C, a nawet obszary nadmorskie notują tygodniami wysokie 30 stopni. Lipiec i sierpień to realna adaptacja, nie tylko \"słoneczny klimat śródziemnomorski\"."],
      ["Rynek pracy na Cyprze: węższy, niż sugerują broszury", "Turystyka, usługi finansowe i prawne oraz nieruchomości rozwijają się prężnie. Branże technologiczne, badawcze i kreatywne mają znacznie mniej ofert, a wynagrodzenia w większości sektorów są niższe niż w Europie Zachodniej."],
      ["Koszt towarów importowanych na Cyprze", "Jako gospodarka wyspiarska, Cypr płaci realną premię za towary importowane — odczuwalną w supermarkecie i przy wszystkim, co nie jest produkowane lokalnie."],
    ],
    faq: [
      ["Czy Cypr to dobre miejsce do życia w 2026 roku?", "To mocno zależy od tego, co jest priorytetem. Dla emerytów, pracujących zdalnie z zagranicznym dochodem i inwestorów połączenie bezpieczeństwa, klimatu, działającej opieki zdrowotnej i realnych korzyści podatkowych stanowi mocny argument, tym bardziej że gospodarka rośnie obecnie trzykrotnie szybciej niż średnia UE. Cypr jest słabszym wyborem dla kogoś, kto musi zbudować lokalną karierę poza turystyką, finansami czy nieruchomościami, oraz dla osób, które nie są gotowe jeździć wszędzie samochodem lub mierzyć się z wolno działającą administracją."],
      ["Czy Cypr należy do strefy Schengen?", "Jeszcze nie, stan na wrzesień 2026 roku. Obok Irlandii, Cypr jest jednym z tylko dwóch państw UE pozostających poza Schengen, co w praktyce oznacza kontrolę paszportową przy wjeździe i wyjeździe, również dla obywateli UE. To się realnie zmienia: Komisja Europejska wydała w połowie 2026 roku pozytywną ocenę, a we wrześniu 2026 sprawa trafiła pod głosowanie Rady UE, wymagające jednomyślnej zgody 25 państw już uczestniczących. Do czasu potwierdzenia konkretnej daty akcesji warto uwzględnić dodatkowy czas na kontrolę paszportową."],
      ["Czy Cypr jest bezpieczny?", "Tak, z wynikiem 90 na 100 w indeksie bezpieczeństwa Cypr należy do bezpieczniejszych miejsc w Europie, a poważna przestępczość jest rzeczywiście rzadka. To, co się zdarza, koncentruje się na drobnych kradzieżach w gęsto zaludnionych strefach turystycznych w sezonie — inny profil ryzyka niż ten, którego doświadczają mieszkańcy spokojnych miejscowości nadmorskich. Stawia to Cypr wyraźnie przed większością dużych miast zachodnioeuropejskich pod względem codziennego bezpieczeństwa."],
      ["Ile kosztuje życie na Cyprze?", "Realistyczny punkt odniesienia na 2026 rok to około 2100 $/miesiąc dla osoby samotnej z wynajmem, lub 2000–2500 €/miesiąc dla pary. Czynsz jest największym czynnikiem zmienności: mieszkanie w centrum Limassol kosztuje wyraźnie więcej niż porównywalne mieszkanie w Pafos. W porównaniu z Portugalią Cypr jest o około 8% tańszy dla osoby samotnej — taniej niż większość zachodnioeuropejskich stolic, ale solidne, średnie koszty, nie okazja cenowa."],
      ["Jaka jest największa wada życia na Cyprze?", "Biurokracja pojawia się najczęściej — procesy urzędowe regularnie trwają dłużej niż deklarowane terminy, bez niezawodnego skrótu poza zaplanowanym zapasem czasu. Zaraz za nią plasuje się zależność od samochodu: bez sieci kolejowej i przy nierównym pokryciu autobusowym poza Nikozją i Limassol, brak samochodu realnie ogranicza codzienne życie. Żadna z tych rzeczy nie jest przeszkodą nie do pokonania, ale obie warto uwzględnić od pierwszego dnia."],
    ],
    northSouthHeading: "Cypr Południowy a Cypr Północny: dlaczego to ważne",
    northSouth: "Każdy uczciwy artykuł o życiu na Cyprze musi to poruszyć wprost. Wyspa jest podzielona od 1974 roku: uznawana międzynarodowo Republika Cypryjska (członek UE, część południowa) oraz samozwańcza Turecka Republika Cypru Północnego, uznawana wyłącznie przez Turcję. Dla każdego, kto planuje mieszkać, inwestować lub kupić nieruchomość, to rozróżnienie ma realne znaczenie prawne, nie tylko polityczne — bezpośrednio wpływa na to, które zakupy są objęte ochroną prawną UE.",
  },
  ru: {
    title: "Плюсы и минусы жизни на Кипре (2026)",
    excerpt: "Честная, актуальная версия на 2026 год — реальные цифры о безопасности, здравоохранении, экономике, статусе Шенгена и настоящих минусах.",
    seo: { metaTitle: "Плюсы и минусы Кипра 2026: жизнь на острове", metaDescription: "Реальные данные 2026 о жизни на Кипре: безопасность, система GeSY, экономика, статус Шенгена, стоимость жизни и честные минусы." },
    intro: "Большинство статей «плюсы и минусы» о Кипре повторяют один и тот же список, часто с устаревшими данными. Вот честная, актуальная версия на 2026 год — с реальными цифрами, а не переписанными впечатлениями.",
    pros: [
      ["Безопасен ли Кипр? Страна с реально низкой преступностью", "Кипр набирает 90 из 100 баллов по индексу безопасности. Серьёзная преступность редка, большинство зафиксированных правонарушений — мелкие кражи в туристических зонах."],
      ["Здравоохранение на Кипре: как работает система GeSY", "Государственная система здравоохранения GeSY (с 2019 года) даёт зарегистрированным резидентам доступ к терапевтам, специалистам, стационарному лечению и лекарствам, финансируется через взносы, зависящие от дохода."],
      ["Экономика Кипра в 2026 году: быстрее среднего по ЕС", "Экономика Кипра выросла на 3,3% в первом полугодии 2026 года — более чем втрое быстрее среднего по ЕС, за счёт туризма, финансовых услуг и строительства. Инфляция составляет около 3,5% (август 2026)."],
      ["Входит ли Кипр в Шенгенскую зону?", "Пока нет — наряду с Ирландией, Кипр остаётся одной из всего двух стран ЕС вне Шенгена. Ситуация меняется: Еврокомиссия дала положительную оценку технической готовности в середине 2026 года, а в сентябре 2026 вопрос вынесен на голосование Совета ЕС, требующее единогласного одобрения 25 уже участвующих стран."],
      ["Налоговые преимущества Кипра для резидентов и инвесторов", "Отсутствие налога на наследство, низкие расходы на передачу собственности и — для квалифицирующихся налоговых резидентов без статуса «домициль» — значительные льготы на дивидендный и процентный доход. Реальное структурное преимущество, детали которого стоит уточнять индивидуально."],
    ],
    cons: [
      ["Бюрократия на Кипре: почему всё занимает больше времени", "Самая частая жалоба среди экспатов: регистрация автомобиля, оформление резидентства и другие процессы в госучреждениях регулярно занимают больше времени, чем заявлено официально."],
      ["Общественный транспорт на Кипре: почему нужна машина", "На острове нет железнодорожной сети. Автобусы недорогие, но частота и надёжность сильно различаются по регионам — плотное покрытие в Никосии и Лимассоле, скудное почти везде ещё."],
      ["Дефицит воды на Кипре: реальная проблема", "Кипр — остров с реальным дефицитом воды, зависящий от опреснения и управления резервуарами. В засушливые годы вводятся ограничения на полив сада и наполнение бассейнов."],
      ["Летняя жара на Кипре: насколько это реально интенсивно", "Пиковые температуры в глубине острова регулярно достигают 40°C, даже прибрежные районы неделями держат высокие 30-градусные значения. Июль и август — это реальная адаптация, а не просто «солнечный средиземноморский климат»."],
      ["Рынок труда на Кипре: уже, чем кажется по рекламным буклетам", "Туризм, финансовые и юридические услуги, недвижимость — процветают. IT, исследования и креативные индустрии представлены гораздо слабее, зарплаты в большинстве секторов ниже западноевропейского уровня."],
      ["Стоимость импортных товаров на Кипре", "Как островная экономика, Кипр платит реальную надбавку за импортные товары — заметно в супермаркете и на всём, что не производится локально."],
    ],
    faq: [
      ["Хорошее ли место Кипр для жизни в 2026 году?", "Сильно зависит от того, что для вас приоритетно. Для пенсионеров, удалённо работающих с иностранным доходом и инвесторов сочетание безопасности, климата, работающей системы здравоохранения и реальных налоговых льгот выглядит убедительно — тем более что экономика сейчас растёт втрое быстрее среднего по ЕС. Кипр — менее удачный выбор для тех, кому нужно строить местную карьеру вне туризма, финансов или недвижимости, и для тех, кто не готов постоянно ездить на машине или сталкиваться с медленной бюрократией."],
      ["Входит ли Кипр в Шенгенскую зону?", "Пока нет, по состоянию на сентябрь 2026 года. Наряду с Ирландией, Кипр — одна из всего двух стран ЕС вне Шенгена, что на практике означает паспортный контроль при въезде и выезде даже для граждан ЕС. Ситуация реально меняется: Еврокомиссия дала положительную оценку в середине 2026 года, а в сентябре 2026 вопрос вынесен на голосование Совета ЕС, требующее единогласного одобрения 25 уже участвующих стран. До подтверждения конкретной даты присоединения стоит закладывать в планы поездок дополнительное время на паспортный контроль."],
      ["Безопасен ли Кипр?", "Да, с 90 из 100 баллов по индексу безопасности Кипр — одно из самых безопасных мест в Европе, а серьёзная преступность действительно редка. То, что случается, сосредоточено в мелких кражах в плотных туристических зонах в высокий сезон — иной профиль риска по сравнению с тем, что обычно переживают жители спокойных прибрежных городков. Это ставит Кипр заметно впереди большинства крупных западноевропейских городов по повседневной безопасности."],
      ["Сколько стоит жизнь на Кипре?", "Реалистичный ориентир на 2026 год — около $2100/месяц для одного человека с учётом аренды, или €2000–2500/месяц для пары. Аренда — главный фактор колебаний: квартира в центре Лимассола стоит заметно дороже сопоставимой квартиры в Пафосе. По сравнению с Португалией Кипр примерно на 8% дешевле для одного человека — дешевле большинства западноевропейских столиц, но это уверенный средний уровень, а не бюджетный вариант."],
      ["Какой самый большой минус жизни на Кипре?", "Бюрократия упоминается чаще любой другой отдельной жалобы — процессы в госучреждениях регулярно занимают больше времени, чем заявлено официально, без надёжного способа ускорить это, кроме закладывания запаса времени. Сразу за ней — зависимость от автомобиля: без железнодорожной сети и при неравномерном автобусном покрытии за пределами Никосии и Лимассола, отсутствие машины реально ограничивает повседневную жизнь. Ни то ни другое не становится препятствием для большинства, но оба фактора стоит учитывать с первого дня."],
    ],
    northSouthHeading: "Северный и Южный Кипр: почему это важно",
    northSouth: "Любая честная статья о жизни на Кипре должна затронуть это прямо. Остров разделён с 1974 года: международно признанная Республика Кипр (член ЕС, южная часть) и самопровозглашённая Турецкая Республика Северного Кипра, признанная только Турцией. Для тех, кто планирует жить, инвестировать или покупать недвижимость, это различие имеет реальный правовой вес, а не только политический — напрямую влияет на то, какие покупки защищены законодательством ЕС.",
  },
};

function buildBlocks(c) {
  const proBlocks = [];
  c.pros.forEach(([hh, pp]) => { proBlocks.push(h3(hh), empty(), para(pp), empty()); });
  const conBlocks = [];
  c.cons.forEach(([hh, pp]) => { conBlocks.push(h3(hh), empty(), para(pp), empty()); });

  const blocks = [
    textBlock([para(c.intro)]),
    textBlock([h2(c.prosHeading || "—"), empty(), ...proBlocks]),
    textBlock([h2(c.consHeading || "—"), empty(), ...conBlocks]),
  ];
  if (c.northSouth) blocks.push(textBlock([h2(c.northSouthHeading), empty(), para(c.northSouth)]));
  blocks.push(faqBlock(c.faq));
  return blocks;
}

async function main() {
  const en = await prisma.blog.findFirst({ where: { slug: "pros-and-cons-of-living-in-cyprus", language: "en" }, select: { id: true, translationGroupId: true } });
  if (!en) throw new Error("ABORT: EN post not found");
  const groupId = en.translationGroupId || crypto.randomUUID();

  const headings = {
    de: { prosHeading: "Vorteile des Lebens auf Zypern", consHeading: "Nachteile des Lebens auf Zypern" },
    pl: { prosHeading: "Zalety życia na Cyprze", consHeading: "Wady życia na Cyprze" },
    ru: { prosHeading: "Плюсы жизни на Кипре", consHeading: "Минусы жизни на Кипре" },
  };

  for (const [lang, cfg] of Object.entries(CONFIG)) {
    const c = { ...CONTENT[lang], ...headings[lang] };
    const existing = await prisma.blog.findUnique({ where: { language_slug: { language: lang, slug: cfg.slug } } });
    if (existing) { console.log(`SKIPPED ${lang}: ${cfg.slug} already exists`); continue; }

    const created = await prisma.blog.create({
      data: {
        sanityId: `local-${crypto.randomUUID()}`,
        translationGroupId: groupId,
        language: lang,
        slug: cfg.slug,
        title: c.title,
        excerpt: c.excerpt,
        status: "SCHEDULED",
        scheduledAt: SCHEDULED_AT,
        authorId: cfg.authorId,
        categoryId: cfg.categoryId,
        seo: c.seo,
        contentBlocks: buildBlocks(c),
      },
    });
    console.log(`Created ${lang}: ${cfg.slug} (SCHEDULED for ${SCHEDULED_AT.toISOString()}, id: ${created.id})`);
  }

  if (!en.translationGroupId) {
    await prisma.blog.update({ where: { id: en.id }, data: { translationGroupId: groupId } });
    console.log("Linked EN post under the shared translationGroupId", groupId);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
