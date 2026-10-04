/* Content Offensive Plan, Track B — approved DE localization (not
   translation) saved onto the existing DRAFT row. See
   update-banking-article-drafts-approved.mjs (EN) for full context. */
import fs from "node:fs";
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
let k = 0;
const key = () => `bkde${(k++).toString(36)}`;
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

const ROW_ID = "3e9dbbb4-c74b-4ceb-95ec-dc970afac1bb";

const de = {
  title: "Bankkonto in Zypern eröffnen als Ausländer (2026)",
  excerpt: "Bankvergleich, echter 5-Schritte-Prozess, Dokumente je nach Situation (angestellt, selbstständig, Rentner), woher jedes Dokument kommt, Einlagensicherung und CRS-Meldung für DACH erklärt.",
  seo: { metaTitle: "Bankkonto Zypern eröffnen als Ausländer: Leitfaden 2026", metaDescription: "Welche zyprische Bank je nach Situation, echter Schritt-für-Schritt-Prozess, genaue Dokumente und woher sie kommen, Einlagensicherung, CRS-Meldung für Deutschland, Österreich, Schweiz — 2026." },
  blocks: [
    textBlock([para("Jede zyprische Bank funktioniert für Ausländer anders, und die meisten Ratgeber fassen das in eine einzige Checkliste zusammen. Das greift zu kurz: Welche Bank Sie wählen, entscheidet darüber, ob Sie überhaupt nach Zypern reisen müssen, und welche Dokumente Sie brauchen, hängt vollständig davon ab, ob Sie angestellt, selbstständig oder Rentner sind.")]),
    textBlock([
      h2("Kann ein Ausländer in Zypern ein Bankkonto eröffnen?"), empty(),
      para("Ja, unabhängig vom Wohnsitzstatus. Der Adressnachweis kann Ihre Adresse in Deutschland, Österreich oder der Schweiz zeigen. Nicht-EU-Bürger — das betrifft Schweizer Antragsteller — durchlaufen eine gründlichere Prüfung, aber die Staatsangehörigkeit selbst ist bei keiner der wichtigsten zyprischen Banken ein Hindernis."),
    ]),
    textBlock([
      h2("Gibt es anonyme Bankkonten auf Zypern?"), empty(),
      para("Nein — und das lohnt sich, direkt zu klären, weil danach tatsächlich gesucht wird. Anonyme Bankkonten existieren in Zypern nicht, genauso wenig wie in Deutschland, Österreich oder der Schweiz. Jede Bank in der EU ist zu vollständiger Kundenidentifizierung verpflichtet. Was manche Suchende mit \"anonym\" eigentlich meinen, ist meist ein diskret geführtes Konto mit klarer, dokumentierter Herkunft der Gelder — genau das beschreibt dieser Artikel."),
    ]),
    textBlock([
      h2("Schritt 1: die Bank wählen — das Kriterium, das wirklich zählt"), empty(),
      para("Sechs Banken bedienen realistisch ausländische Privatkunden ohne Wohnsitz: Bank of Cyprus, Hellenic Bank, Eurobank Cyprus, Astrobank, Alpha Bank Cyprus und National Bank of Greece (Cyprus). Der belegbare Unterschied liegt darin, ", ["wie viel des Prozesses aus der Ferne funktioniert", true], " — nicht in Beruf oder Einkommensart."),
    ]),
    table(
      ["Bank", "Kontoeröffnung aus der Ferne", "Typische Dauer"],
      [
        ["Bank of Cyprus", "Vollständig remote — Formulare/Dokumente per E-Mail, Identitätsprüfung per Videocall, Unterschrift aus der Ferne", "7–10 Werktage ab Eingang der Originaldokumente in Zypern"],
        ["Hellenic Bank", "Start online möglich; ein Filialbesuch ist zum Abschluss verpflichtend", "3–4 Wochen"],
        ["Eurobank Cyprus, Astrobank, Alpha Bank Cyprus, National Bank of Greece (Cyprus)", "Filialbesuch in der Regel erwartet", "Variiert je nach Filiale — vorab bestätigen lassen"],
      ],
    ),
    textBlock([
      para("Wenn Sie nicht nach Zypern reisen können oder wollen, bevor das Konto eröffnet ist, ist die Entscheidung gefallen: Bank of Cyprus. Planen Sie ohnehin eine Zypern-Reise, passt der Prozess der Hellenic Bank gut hinein."), empty(),
      h3("Unsere Empfehlung, je nach Situation"), empty(),
      para(["Angestellte oder Rentner, die den schnellsten, digitalen Weg wollen: ", true], "Bank of Cyprus. Ein Videocall reicht — es gibt keinen Grund, eine Reise dafür zu planen."), empty(),
      para(["Selbstständige oder Unternehmer mit komplexerer Herkunftsgeschichte der Gelder: ", true], "Hellenic Bank oder eine andere Filialbank. Ein persönliches Gespräch klärt Unklarheiten zum Geschäftseinkommen oft in einem Termin."), empty(),
      para(["Kauf im höheren Preissegment oder langfristig größere Guthaben: ", true], "Eurobank Cyprus — am stärksten auf größere Einlagen und Investment-nahe Konten ausgerichtet."),
    ]),
    textBlock([
      h2("Schritt 2: Ihr Dokumentenset — abhängig von Ihrer Einkommensart"), empty(),
      h3("Angestellt"), para("In der Regel: ", ["die letzten 3 Gehaltsabrechnungen", true], ", ", ["Ihr Arbeitsvertrag", true], ", teils eine kurze ", ["Gehaltsbestätigung", true], " des Arbeitgebers."), empty(),
      h3("Selbstständig oder Unternehmer"), para("Erwarten Sie: ", ["Handelsregisterauszug", true], " bzw. Gewerbeanmeldung, ", ["aktuelle Rechnungen", true], ", ", ["Steuerbescheide", true], ", ", ["geprüfte Jahresabschlüsse", true], " oder ", ["Geschäftskontoauszüge", true], ". Was zuverlässig verzögert: \"Geschäftseinkommen\" oder \"Ersparnisse\" ohne Belege."), empty(),
      h3("Rentner"), para("Sie benötigen eine ", ["Rentenbescheinigung oder den jährlichen Rentenbescheid", true], " Ihres Rentenversicherungsträgers mit der regelmäßigen Zahlungshöhe."), empty(),
      h3("Finanzierung über den Verkauf einer Immobilie"), para("Ist der ", ["Kaufvertrag selbst", true], " der Herkunftsnachweis — halten Sie den unterschriebenen Vertrag bereit."),
    ]),
    textBlock([
      h2("Jedes Dokument — und woher Sie es genau bekommen"), empty(),
      h3("Gültiger Reisepass"), para("Woher: Ihre Passbehörde. Nicht-EU-Bürger (Schweiz) benötigen einen Reisepass, keinen Personalausweis."), empty(),
      h3("Adressnachweis"), para("Woher: aktuelle Nebenkostenabrechnung oder Kontoauszug Ihrer Hausbank, nicht älter als 2-3 Monate."), empty(),
      h3("Bankreferenzschreiben"), para("Woher: bei Ihrer Hausbank anfordern, meist über Online-Banking oder telefonisch."), empty(),
      h3("Herkunftsnachweis der Gelder"), para("Woher: Personalabteilung, Steuerberater, Rentenversicherungsträger oder Immobilienanwalt, je nach Situation."), empty(),
      h3("Ansässigkeitsbescheinigung / steuerliche Selbstauskunft"), para("Woher: für Deutschland beim zuständigen Finanzamt, auf dem offiziellen Formular des Bundeszentralamts für Steuern (BZSt); in Österreich beim Finanzamt, in der Schweiz bei der kantonalen Steuerverwaltung — lokal erfragen."), empty(),
      h3("Beglaubigung und Apostille für Dokumente von außerhalb der EU"), para("Woher: in Deutschland je nach Bundesland unterschiedlich — Beispiel Berlin: zunächst Beglaubigung durch die Steuerabteilung der Senatsverwaltung für Finanzen, danach Apostille durch das LABO; andere Bundesländer über die jeweilige Landesfinanzverwaltung. Schweiz: kantonale Staatskanzlei. Als Schweizer Antragsteller (Nicht-EU) rechnen Sie mit Beglaubigung/Apostille für Passkopien und ggf. beglaubigter Übersetzung — eine Apostille dauert von wenigen Minuten (persönlicher Termin) bis zu einer Woche (postalisch)."),
    ]),
    textBlock([
      h2("Schritt 3–5: einreichen, prüfen, aktivieren"), empty(),
      h3("3. Antrag einreichen"), para("Bank of Cyprus: Formulare und Scans per E-Mail an das Kontoeröffnungsteam, Terminierung des Videocalls erbitten. Hellenic Bank: online starten, dann Filialtermin buchen."), empty(),
      h3("4. Identitätsprüfung"), para("Bank of Cyprus: im Videocall. Filialbanken: persönlich vor Ort, Originale mitbringen. Bank of Cyprus: 7–10 Werktage ab Eingang der Originale in Zypern. Hellenic Bank: 3–4 Wochen gesamt."), empty(),
      h3("5. Online-Banking aktivieren, IBAN erhalten"), para("Nach Genehmigung: IBAN, Debitkarte, Online-Banking-Zugang — sofort aktivieren."),
    ]),
    textBlock([h2("Was es kostet"), empty(), para("Keine der sechs Banken verlangt eine Gebühr für die reine Kontoeröffnung. Rechnen Sie mit moderater monatlicher Kontoführungsgebühr, SEPA-Überweisungsgebühr und teils Debitkarten-Ausgabegebühr.")]),
    textBlock([
      h2("Ist Ihr Geld auf Zypern sicher?"), empty(),
      para("Die Bankenkrise 2013 prägt das Vertrauen vieler deutschsprachiger Anleger bis heute. Heute: Einlagen geschützt unter derselben EU-Einlagensicherung wie in jedem anderen Euroland — bis ", ["100.000 € pro Einleger und Bank", true], ", gemäß EU-Richtlinie 2014/49/EU. Alle sechs Banken werden von der EZB beaufsichtigt."), empty(),
      para("Bei Guthaben über 100.000 €: auf mehrere Banken verteilen oder Überschuss nach Kaufabschluss abziehen."),
    ]),
    textBlock([
      h2("Erfährt das Finanzamt von diesem Konto?"), empty(),
      para("Ja, automatisch — für alle drei DACH-Länder, auch die Schweiz, obwohl sie nicht EU-Mitglied ist. Zypern wendet CRS seit 2016 an. Die Schweiz nimmt seit dem automatischen Informationsaustausch mit der EU (Daten ab 2017, erster Austausch 2018) vollständig am CRS teil."),
    ]),
    textBlock([h2("Kaufen Sie über uns"), empty(), para("Wir begleiten die Kontoeröffnung parallel zur Transaktion — mit Referenzschreiben Ihres Anwalts, Abstimmung mit der Bank zum Herkunftsnachweis, und einem auf Ihre Kaufvertragsfristen abgestimmten Zeitplan.")]),
    textBlock([
      h2("Häufige Gründe für Verzögerung oder Ablehnung"), empty(),
      bullet(["Vage Angaben zur Herkunft der Gelder", true], " — häufigste Ursache, besonders bei Selbstständigen"),
      bullet(["Adressnachweis älter als 2-3 Monate", true]),
      bullet(["Fehlende Apostille oder beglaubigte Übersetzung", true]),
      bullet(["Unerklärte größere Kontobewegungen", true]),
      bullet(["Fehlende steuerliche Selbstauskunft", true]),
    ]),
    faqBlock([
      ["Gibt es anonyme Bankkonten auf Zypern?", "Nein. Anonyme Konten existieren in Zypern nicht, genauso wenig wie in Deutschland, Österreich oder der Schweiz."],
      ["Welche Bank passt für Selbstständige?", "Wir empfehlen eine filialbasierte Bank wie Hellenic — ein persönliches Gespräch klärt Fragen zur Herkunft von Geschäftseinkommen meist schneller."],
      ["Muss ich persönlich nach Zypern reisen?", "Nicht mit Bank of Cyprus — der gesamte Prozess läuft per Videocall und E-Mail. Andere Banken verlangen mindestens einen Filialbesuch."],
      ["Als Schweizer Staatsbürger — gelten für mich andere Regeln?", "Die Schweiz ist kein EU-Mitglied, daher werden Schweizer wie andere Nicht-EU-Bürger behandelt — mit gründlicherer Prüfung und meist Apostille-Pflicht. Am CRS-Austausch ändert das nichts."],
      ["Ist mein Geld nach der Bankenkrise 2013 sicher?", "Einlagen bis 100.000 € pro Bank sind unter derselben EU-Einlagensicherung geschützt, alle sechs Banken werden von der EZB beaufsichtigt."],
    ]),
  ],
};

async function main() {
  const row = await prisma.blog.findUnique({ where: { id: ROW_ID } });
  if (!row) throw new Error("ABORT: DE draft row not found");
  if (row.status !== "DRAFT") throw new Error(`ABORT: status is ${row.status}, not DRAFT`);
  await prisma.blog.update({ where: { id: ROW_ID }, data: { title: de.title, excerpt: de.excerpt, seo: de.seo, contentBlocks: de.blocks } });
  console.log("DE draft updated with approved content.");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
