import type { LegalDoc } from "./types";

/* Datenschutzerklärung — Deutsch. Inhaltlich identisch zur englischen
   Fassung (privacy.en.ts); dort steht auch, welche DSGVO-Pflichtangaben
   gegenüber dem alten Text ergänzt wurden. Anker-IDs sind bewusst NICHT
   übersetzt, damit derselbe Abschnitt in jeder Sprache dieselbe URL hat.

   KEINE Rechtsberatung — vor Veröffentlichung anwaltlich prüfen lassen. */

export const PRIVACY_DE: LegalDoc = {
  metaTitle: "Datenschutzerklärung — Cyprus VIP Estates",
  metaDescription:
    "Wie Cyprus VIP Estates (SecretBrand Solutions LTD) Ihre personenbezogenen Daten erhebt, verwendet, weitergibt und schützt — und welche Rechte Ihnen nach der DSGVO zustehen.",
  eyebrow: "Rechtliches",
  title: "Datenschutzerklärung",
  intro:
    "Diese Erklärung beschreibt, welche personenbezogenen Daten wir erheben, wenn Sie diese Website nutzen oder uns kontaktieren, warum wir sie verarbeiten, wer sie erhält, wie lange wir sie speichern und welche Rechte Sie jederzeit ausüben können.",
  updatedLabel: "Stand",
  updated: "2026-08-21",
  tocLabel: "Auf dieser Seite",

  sections: [
    {
      id: "controller",
      title: "1. Wer verantwortlich ist",
      blocks: [
        { kind: "p", text: "Verantwortlich für die Verarbeitung Ihrer personenbezogenen Daten auf dieser Website ist:" },
        {
          kind: "list",
          items: [
            "SecretBrand Solutions LTD, handelnd unter „Cyprus VIP Estates“",
            "Palaion Patron Germanou 11, 8011 Paphos, Zypern",
            "E-Mail: office@cyprusvipestates.com",
            "Telefon: +357 99 278 285",
          ],
        },
        {
          kind: "p",
          text: "Bei jeder Frage zu Ihren Daten — Auskunft, Berichtigung, Löschung oder alles Weitere aus dieser Erklärung — schreiben Sie an die oben genannte Adresse; Ihr Anliegen erreicht dort die zuständige Person.",
        },
      ],
    },
    {
      id: "data-we-collect",
      title: "2. Was wir erheben und warum",
      blocks: [
        {
          kind: "definitions",
          items: [
            {
              term: "Server-Logfiles",
              text: "Bei jedem Seitenaufruf speichert unser Server Browsertyp und -version, Betriebssystem, Referrer-URL, Hostname des zugreifenden Geräts, Uhrzeit der Anfrage und die IP-Adresse. Das ist technisch erforderlich, um die Seite auszuliefern und Missbrauch zu erkennen. Eine Zusammenführung mit anderen Datenquellen findet nicht statt. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (unser berechtigtes Interesse an einer sicheren, funktionsfähigen Website).",
            },
            {
              term: "Kontaktformulare und Anfragen",
              text: "Wenn Sie uns eine Anfrage senden, speichern wir Ihre Angaben — in der Regel Name, Kontaktdaten, bevorzugter Kontaktweg und Ihre Nachricht — um Ihre Anfrage zu beantworten und Rückfragen zu bearbeiten. Anfragen werden in unserem Kundenverwaltungssystem gespeichert, damit die betreuende Kollegin oder der betreuende Kollege den Verlauf Ihres Anliegens sieht. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche Maßnahmen auf Ihre Anfrage).",
            },
            {
              term: "Termine",
              text: "Wenn Sie über unsere Terminseite Zeiten vorschlagen oder bestätigen, verarbeiten wir die vorgeschlagenen Zeiten, Ihre Zeitzone und Ihre Kontaktdaten, um den Termin zu vereinbaren und zu bestätigen. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.",
            },
            {
              term: "Newsletter",
              text: "Wenn Sie sich anmelden, verarbeiten wir Ihre E-Mail-Adresse, um Ihnen unseren Newsletter zu senden. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung), die Sie jederzeit widerrufen können.",
            },
            {
              term: "Website-Statistik (ohne Cookies)",
              text: "Wir zählen Seitenaufrufe über einen täglich wechselnden, nicht umkehrbaren Hash aus IP-Adresse und Browser-Kennung. Der Hash ändert sich jeden Tag, wird nie zusammen mit Ihrer IP-Adresse gespeichert und erlaubt weder Ihre Identifikation noch ein Wiedererkennen über mehrere Tage. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse zu erfahren, welche Inhalte nützlich sind), abgewogen dadurch, dass kein dauerhafter Identifikator entsteht.",
            },
            {
              term: "Google Tag Manager, Google Analytics und Google Ads",
              text: "Nur wenn Sie Analyse- und Marketing-Cookies zustimmen, laden wir den Google Tag Manager (Google Ireland Limited), der seinerseits Google Analytics 4 zur Reichweitenmessung und Google Ads zur Conversion-Messung und für Remarketing aktiviert. Der Tag Manager selbst verwaltet nur die übrigen Tags; die Datenverarbeitung erfolgt durch die von ihm geladenen Dienste. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).",
            },
            {
              term: "Meta-Pixel",
              text: "Nur mit Ihrer Einwilligung. Anbieter: Meta Platforms Ireland Limited. Es misst, ob ein Besuch auf eine unserer Anzeigen zurückgeht, und ermöglicht das Ansprechen vergleichbarer Zielgruppen. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).",
            },
            {
              term: "LinkedIn Insight Tag",
              text: "Nur mit Ihrer Einwilligung. Anbieter: LinkedIn Ireland Unlimited Company. Es misst die Wirkung unserer LinkedIn-Kampagnen und erlaubt dort die Zielgruppenansprache. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).",
            },
            {
              term: "Microsoft Clarity — einschließlich Sitzungsaufzeichnung",
              text: "Clarity (Microsoft Ireland Operations Limited) zeigt uns, wie Seiten tatsächlich genutzt werden: Mausbewegungen, Scrollen, Klicks und Interaktionen, die als anonymisierte Sitzungsaufzeichnung abgespielt und zu Heatmaps zusammengefasst werden können. Das geht deutlich weiter als bloßes Zählen von Aufrufen, weshalb wir es hier gesondert benennen. Das Clarity-Skript wird auf jeder Seite geladen, erhält dabei aber die Information, ob Sie eingewilligt haben: ohne Ihre Einwilligung läuft es im eingeschränkten Modus von Microsoft, der keine Cookies setzt und kein Profil bildet; mit Ihrer Einwilligung zeichnet es die vollständige Sitzung auf. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung) für den vollen Modus und Art. 6 Abs. 1 lit. f DSGVO (unser berechtigtes Interesse zu erkennen, wo die Seite Nutzer verwirrt) für den eingeschränkten Modus. Dem letzteren können Sie jederzeit nach Art. 21 widersprechen.",
            },
          ],
        },
      ],
    },
    {
      id: "recipients",
      title: "3. Wer Ihre Daten erhält",
      blocks: [
        {
          kind: "callout",
          text: "Die Weitergabe Ihrer Daten an einen Bauträger oder eine Anwältin ist ein Kernbestandteil unserer Leistung. Sie erfolgt ausschließlich für das konkrete Immobilieninteresse, das Sie uns genannt haben.",
        },
        { kind: "p", text: "Je nach Anliegen können Ihre Kontaktdaten weitergegeben werden an:" },
        {
          kind: "list",
          items: [
            "Bauträger auf Zypern — zur Organisation von Besichtigungen und zur Erstellung von Angeboten für die Objekte, die Sie interessieren. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.",
            "Unabhängige Anwältinnen und Anwälte — für rechtliche Prüfungen und Vertragsgestaltung, sofern Sie um eine Vermittlung bitten. Sie handeln als eigene Verantwortliche und unterliegen ihrer eigenen Verschwiegenheitspflicht.",
            "Unsere IT-Dienstleister — Hosting, E-Mail-Versand und die Systeme zur Bearbeitung von Anfragen. Diese handeln als Auftragsverarbeiter nach Art. 28 DSGVO ausschließlich nach unseren dokumentierten Weisungen.",
          ],
        },
        {
          kind: "p",
          text: "Wir verkaufen Ihre personenbezogenen Daten nicht und geben sie nicht für fremde Werbezwecke weiter.",
        },
      ],
    },
    {
      id: "transfers",
      title: "4. Übermittlung außerhalb des EWR",
      blocks: [
        {
          kind: "p",
          text: "Google, Meta, Microsoft und LinkedIn sind über ihre irischen Gesellschaften eingebunden; die Verarbeitung auf deren Infrastruktur kann jedoch Übermittlungen in die USA umfassen. Diese stützen sich auf den Angemessenheitsbeschluss der EU-Kommission zum EU-US Data Privacy Framework, soweit der Empfänger darunter zertifiziert ist, im Übrigen auf Standardvertragsklauseln nach Art. 46 Abs. 2 lit. c DSGVO.",
        },
        {
          kind: "p",
          text: "Eine Kopie der jeweiligen Garantien können Sie über die Kontaktdaten in Abschnitt 1 anfordern.",
        },
      ],
    },
    {
      id: "retention",
      title: "5. Wie lange wir speichern",
      blocks: [
        {
          kind: "p",
          text: "Wir speichern personenbezogene Daten nur so lange, wie es der Zweck ihrer Erhebung erfordert, und darüber hinaus nur, soweit eine gesetzliche Aufbewahrungspflicht besteht.",
        },
        {
          kind: "list",
          items: [
            "Server-Logfiles: nur so lange, wie es für den sicheren Betrieb und die Aufklärung von Störungen oder Missbrauch erforderlich ist, danach Löschung oder Anonymisierung.",
            "Anfragen und zugehörige Korrespondenz: solange wir zu Ihrem Anliegen mit Ihnen in Kontakt stehen, und danach nur so lange, wie daraus noch ein Folgegespräch entstehen kann.",
            "Daten zu einem abgeschlossenen Geschäft: für den Zeitraum, den zyprisches Handels- und Steuerrecht vorschreibt.",
            "Newsletter-Anmeldungen: bis zur Abmeldung.",
            "Einwilligungsnachweise: solange wir die Erteilung der Einwilligung belegen können müssen.",
            "Cookielose Statistik: ausschließlich aggregierte Zählwerte — der Tages-Hash ist zu keinem Zeitpunkt auf eine Person zurückführbar.",
          ],
        },
        {
          kind: "p",
          text: "Wenn Sie wissen möchten, wie lange wir eine bestimmte Kategorie Ihrer Daten speichern, fragen Sie uns — wir teilen es Ihnen mit.",
        },
      ],
    },
    {
      id: "cookies",
      title: "6. Cookies und Einwilligung",
      blocks: [
        {
          kind: "p",
          text: "Unser Cookie-Banner bietet dieselben drei Kategorien, die auch in dieser Erklärung verwendet werden:",
        },
        {
          kind: "definitions",
          items: [
            {
              term: "Notwendig",
              text: "Für den Betrieb der Website erforderlich — etwa zum Speichern Ihrer Sprachwahl und Ihrer Cookie-Entscheidung selbst. Grundlage: Art. 6 Abs. 1 lit. f DSGVO; diese lassen sich nicht abschalten.",
            },
            {
              term: "Analyse",
              text: "Google Analytics 4 (über den Google Tag Manager) und Microsoft Clarity im vollen Modus. Werden erst nach Ihrer Zustimmung gesetzt.",
            },
            {
              term: "Marketing",
              text: "Google Ads, das Meta-Pixel und das LinkedIn Insight Tag. Werden erst nach Ihrer Zustimmung gesetzt.",
            },
          ],
        },
        {
          kind: "p",
          text: "Sie können Ihre Entscheidung jederzeit über das Cookie-Banner ändern oder widerrufen; die Rechtmäßigkeit der bis dahin erfolgten Verarbeitung bleibt unberührt. Sie können Cookies zudem in Ihren Browsereinstellungen blockieren oder löschen — Teile der Website funktionieren dann möglicherweise nicht wie vorgesehen.",
        },
      ],
    },
    {
      id: "rights",
      title: "7. Ihre Rechte",
      blocks: [
        { kind: "p", text: "Nach der DSGVO haben Sie das Recht auf:" },
        {
          kind: "list",
          items: [
            "Auskunft — Bestätigung, ob wir Daten zu Ihnen verarbeiten, und eine Kopie davon (Art. 15).",
            "Berichtigung — Korrektur unrichtiger oder unvollständiger Daten (Art. 16).",
            "Löschung — Löschung Ihrer Daten, wenn einer der Gründe des Art. 17 vorliegt.",
            "Einschränkung — dass wir Ihre Daten nur speichern, solange ein Streit darüber geklärt wird (Art. 18).",
            "Datenübertragbarkeit — Erhalt der von Ihnen bereitgestellten Daten in einem strukturierten, maschinenlesbaren Format oder deren Übermittlung an einen anderen Verantwortlichen (Art. 20).",
            "Widerspruch — jederzeit gegen eine auf berechtigten Interessen beruhende Verarbeitung, und uneingeschränkt gegen Direktwerbung (Art. 21).",
            "Widerruf der Einwilligung — jederzeit mit Wirkung für die Zukunft (Art. 7 Abs. 3).",
          ],
        },
        {
          kind: "p",
          text: "Zur Ausübung genügt eine Nachricht an office@cyprusvipestates.com. Wir antworten innerhalb eines Monats; bei komplexen Anfragen können wir um zwei weitere Monate verlängern und teilen Ihnen die Gründe mit.",
        },
        {
          kind: "callout",
          text: "Ihnen steht außerdem ein Beschwerderecht bei einer Aufsichtsbehörde zu. In Zypern ist dies das Office of the Commissioner for Personal Data Protection, Iasonos 1, 1082 Nikosia (commissioner@dataprotection.gov.cy). Sie können sich auch an die Behörde Ihres Wohn- oder Arbeitsorts wenden.",
        },
      ],
    },
    {
      id: "security",
      title: "8. Sicherheit",
      blocks: [
        {
          kind: "p",
          text: "Diese Website wird über TLS ausgeliefert; die Inhalte, die Sie uns senden, sind auf dem Transportweg verschlüsselt — erkennbar an „https://“ und dem Schlosssymbol im Browser. Wir treffen dem Risiko angemessene technische und organisatorische Maßnahmen und beschränken den Zugriff auf Anfragedaten auf die Personen, die Sie betreuen.",
        },
      ],
    },
    {
      id: "automated-decisions",
      title: "9. Automatisierte Entscheidungen",
      blocks: [
        {
          kind: "p",
          text: "Eine automatisierte Entscheidungsfindung oder ein Profiling mit rechtlicher Wirkung oder ähnlich erheblicher Beeinträchtigung im Sinne des Art. 22 DSGVO findet nicht statt. Soweit wir Software zur Sortierung oder Zusammenfassung von Anfragen einsetzen, entscheidet stets ein Mensch über das weitere Vorgehen.",
        },
      ],
    },
    {
      id: "changes",
      title: "10. Änderungen dieser Erklärung",
      blocks: [
        {
          kind: "p",
          text: "Wir passen diese Erklärung an, wenn sich unsere Leistungen oder die rechtlichen Anforderungen ändern. Es gilt jeweils die hier veröffentlichte Fassung; das Datum am Seitenanfang zeigt den Stand der letzten Überarbeitung.",
        },
      ],
    },
  ],

  contactTitle: "Fragen zu Ihren Daten?",
  contactText:
    "Schreiben Sie an office@cyprusvipestates.com oder rufen Sie +357 99 278 285 an. Wir erklären Ihnen gern jeden Punkt dieser Erklärung in verständlicher Sprache.",
};
