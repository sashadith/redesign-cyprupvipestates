/* Content Offensive Plan, Track B — approved PL localization saved onto
   the existing DRAFT row. See update-banking-article-drafts-approved.mjs
   (EN) for full context. */
import fs from "node:fs";
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
let k = 0;
const key = () => `bkpl${(k++).toString(36)}`;
function span(text, strong) { return { _key: key(), _type: "span", marks: strong ? ["strong"] : [], text }; }
function para(...parts) { return { _key: key(), _type: "block", style: "normal", markDefs: [], children: parts.map((p) => (Array.isArray(p) ? span(p[0], true) : span(p, false))) }; }
function empty() { return para(""); }
function h2(text) { return { _key: key(), _type: "block", style: "h2", markDefs: [], children: [span(text)] }; }
function h3(text) { return { _key: key(), _type: "block", style: "h3", markDefs: [], children: [span(text)] }; }
function bullet(...parts) { return { _key: key(), _type: "block", style: "normal", level: 1, listItem: "bullet", markDefs: [], children: parts.map((p) => (Array.isArray(p) ? span(p[0], true) : span(p, false))) }; }
function textBlock(content) { return { _key: key(), _type: "textContent", textAlign: "left", content }; }
function table(columns, rows) { return { _key: key(), _type: "tableBlock", columns, rows: rows.map((cells) => ({ _key: key(), _type: "tableRow", cells })) }; }
function faqItem(question, answerText) { return { _key: key(), question, answer: [para(answerText)] }; }
function faqBlock(items) { return { _key: key(), _type: "faqBlock", marginBottom: "medium", faq: { _type: "accordionBlock", items: items.map(([q, a]) => faqItem(q, a)) } }; }

const ROW_ID = "5476a35e-daf1-4634-85a2-d7019e9598c3";

const pl = {
  title: "Jak założyć konto bankowe na Cyprze dla obcokrajowców (2026)",
  excerpt: "Porównanie banków, realny proces w 5 krokach, dokumenty zależnie od sytuacji (etat, działalność gospodarcza, emerytura), skąd wziąć każdy dokument, bezpieczeństwo depozytów i CRS.",
  seo: { metaTitle: "Konto bankowe na Cyprze dla obcokrajowców: przewodnik 2026", metaDescription: "Który bank cypryjski wybrać zależnie od sytuacji, realny proces krok po kroku, dokładne dokumenty i skąd je wziąć, bezpieczeństwo depozytów, CRS — 2026." },
  blocks: [
    textBlock([para("Każdy cypryjski bank działa inaczej wobec obcokrajowców. Wybór banku decyduje o tym, czy w ogóle trzeba pojechać na Cypr, a potrzebne dokumenty zależą całkowicie od tego, czy jest Pan/Pani zatrudniona, prowadzi działalność czy jest na emeryturze.")]),
    textBlock([h2("Czy obcokrajowiec może założyć konto bankowe na Cyprze?"), empty(), para("Tak, niezależnie od statusu rezydencyjnego. Potwierdzenie adresu może dotyczyć adresu w Polsce. Obywatele spoza UE przechodzą dokładniejszą weryfikację, ale samo obywatelstwo nie jest przeszkodą.")]),
    textBlock([
      h2("Krok 1: wybór banku — kryterium, które naprawdę się liczy"), empty(),
      para("Sześć banków realnie obsługuje zagranicznych klientów: Bank of Cyprus, Hellenic Bank, Eurobank Cyprus, Astrobank, Alpha Bank Cyprus i National Bank of Greece (Cyprus). Udokumentowana różnica dotyczy ", ["tego, ile z procesu da się załatwić zdalnie", true], "."),
    ]),
    table(
      ["Bank", "Otwarcie zdalne", "Typowy czas"],
      [
        ["Bank of Cyprus", "W pełni zdalnie — formularze mailem, weryfikacja przez wideorozmowę, podpis zdalnie", "7–10 dni roboczych od otrzymania oryginałów na Cyprze"],
        ["Hellenic Bank", "Start online, jedna wizyta w oddziale obowiązkowa", "3–4 tygodnie"],
        ["Eurobank Cyprus, Astrobank, Alpha Bank Cyprus, National Bank of Greece (Cyprus)", "Zwykle wymagana wizyta w oddziale", "Zależy od oddziału"],
      ],
    ),
    textBlock([
      para("Jeśli nie może lub nie chce Pan/Pani jechać na Cypr przed otwarciem konta, wybór jest oczywisty: Bank of Cyprus."), empty(),
      h3("Nasza rekomendacja, zależnie od sytuacji"), empty(),
      para(["Pracownik etatowy lub emeryt, chce najszybszej zdalnej ścieżki: ", true], "Bank of Cyprus."), empty(),
      para(["Przedsiębiorca z bardziej złożoną historią pochodzenia środków: ", true], "Hellenic Bank lub inny bank z oddziałem — rozmowa twarzą w twarz często wyjaśnia wątpliwości szybciej."), empty(),
      para(["Zakup w wyższym segmencie lub większe środki długoterminowo: ", true], "Eurobank Cyprus."),
    ]),
    textBlock([
      h2("Krok 2: zestaw dokumentów — zależny od rodzaju dochodu"), empty(),
      h3("Zatrudniony na etacie"), para("Zwykle: ", ["3 ostatnie odcinki wypłaty", true], ", ", ["umowa o pracę", true], ", czasem ", ["zaświadczenie od pracodawcy", true], "."), empty(),
      h3("Przedsiębiorca"), para("Proszę przygotować: ", ["wpis do CEIDG/KRS", true], ", ", ["aktualne faktury", true], ", ", ["zeznania podatkowe", true], ", ", ["sprawozdanie finansowe", true], " lub wyciągi firmowe."), empty(),
      h3("Emeryt"), para("Potrzebne: ", ["zaświadczenie z ZUS", true], " o wysokości świadczenia."), empty(),
      h3("Finansowanie ze sprzedaży nieruchomości"), para(["Sama umowa sprzedaży", true], " jest dowodem pochodzenia środków."),
    ]),
    textBlock([
      h2("Każdy dokument — i skąd go dokładnie wziąć"), empty(),
      h3("Ważny paszport"), para("Skąd: urząd paszportowy. Dla obywateli spoza UE wymagany jest paszport."), empty(),
      h3("Potwierdzenie adresu"), para("Skąd: aktualny rachunek za media lub wyciąg z banku, nie starszy niż 2-3 miesiące."), empty(),
      h3("List referencyjny z banku"), para("Skąd: własny bank w Polsce, przez bankowość internetową lub telefonicznie."), empty(),
      h3("Potwierdzenie pochodzenia środków"), para("Skąd: dział kadr, księgowy, ZUS lub prawnik prowadzący transakcję."), empty(),
      h3("Certyfikat rezydencji podatkowej"), para("Skąd: urząd skarbowy właściwy dla miejsca zamieszkania, formularz CFR-1 — osobiście, listownie lub przez e-PUAP/e-Urząd Skarbowy, wydanie w ciągu 7 dni."), empty(),
      h3("Apostille dla dokumentów spoza UE"), para("Skąd: polskie Ministerstwo Spraw Zagranicznych (MSZ), zgodnie z Konwencją haską obowiązującą w Polsce od 2005 roku. Dokumenty nie po angielsku/grecku wymagają tłumaczenia przysięgłego."),
    ]),
    textBlock([
      h2("Krok 3–5: złożenie wniosku, weryfikacja, aktywacja"), empty(),
      h3("3. Złożenie wniosku"), para("Bank of Cyprus: formularze i skany mailem, prośba o wideorozmowę. Hellenic Bank: start na portalu online, potem wizyta w oddziale."), empty(),
      h3("4. Weryfikacja tożsamości"), para("Bank of Cyprus: na wideorozmowie. Banki z oddziałem: osobiście, z oryginałami dokumentów. 7-10 dni roboczych (BoC) / 3-4 tygodnie (Hellenic)."), empty(),
      h3("5. Aktywacja bankowości internetowej, IBAN"), para("Po zatwierdzeniu: IBAN, karta debetowa, dostęp online — aktywować od razu."),
    ]),
    textBlock([h2("Ile to kosztuje"), empty(), para("Żaden bank nie pobiera opłaty za otwarcie konta. Proszę liczyć się z opłatą miesięczną, opłatą SEPA i czasem opłatą za kartę.")]),
    textBlock([
      h2("Czy pieniądze na Cyprze są bezpieczne?"), empty(),
      para("Kryzys bankowy 2013 wciąż kształtuje myślenie o tym temacie. Dziś: depozyty chronione tym samym unijnym systemem gwarancji — do ", ["100 000 € na deponenta i bank", true], ", dyrektywa UE 2014/49/EU. Nadzór: Europejski Bank Centralny."),
    ]),
    textBlock([h2("Czy polski urząd skarbowy dowie się o koncie?"), empty(), para("Tak, automatycznie. Cypr stosuje CRS od 2016 roku i zgłasza dane do kraju rezydencji podatkowej co roku.")]),
    textBlock([h2("Przy zakupie przez nas"), empty(), para("Prowadzimy otwarcie konta równolegle z transakcją — list referencyjny od prawnika, koordynacja z bankiem, harmonogram dopasowany do umowy zakupu.")]),
    textBlock([
      h2("Najczęstsze przyczyny opóźnienia lub odmowy"), empty(),
      bullet(["Niejasne potwierdzenie pochodzenia środków", true], " — najczęstsza przyczyna, zwłaszcza u przedsiębiorców"),
      bullet(["Potwierdzenie adresu starsze niż 2-3 miesiące", true]),
      bullet(["Brak apostille lub tłumaczenia przysięgłego", true]),
      bullet(["Niewyjaśnione transakcje", true]),
    ]),
    faqBlock([
      ["Który bank wybrać, jeśli prowadzę działalność?", "Polecamy bank z oddziałem, taki jak Hellenic — rozmowa twarzą w twarz zwykle szybciej wyjaśnia pytania o dochód z działalności."],
      ["Czy muszę osobiście pojechać na Cypr?", "Nie z Bank of Cyprus — cały proces przez wideorozmowę i mail. Pozostałe banki wymagają wizyty."],
      ["Ile to naprawdę trwa?", "7-10 dni roboczych (Bank of Cyprus) lub 3-4 tygodnie (Hellenic Bank) przy kompletnej dokumentacji."],
      ["Gdzie uzyskać apostille?", "W polskim MSZ, zgodnie z Konwencją haską obowiązującą od 2005 roku."],
      ["Czy pieniądze są bezpieczne po kryzysie 2013?", "Depozyty do 100 000 € na bank są chronione unijnym systemem gwarancji, nadzór ECB."],
    ]),
  ],
};

async function main() {
  const row = await prisma.blog.findUnique({ where: { id: ROW_ID } });
  if (!row) throw new Error("ABORT: PL draft row not found");
  if (row.status !== "DRAFT") throw new Error(`ABORT: status is ${row.status}, not DRAFT`);
  await prisma.blog.update({ where: { id: ROW_ID }, data: { title: pl.title, excerpt: pl.excerpt, seo: pl.seo, contentBlocks: pl.blocks } });
  console.log("PL draft updated with approved content.");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
