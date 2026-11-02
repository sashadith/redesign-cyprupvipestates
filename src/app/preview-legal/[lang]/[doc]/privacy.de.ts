import type { LegalDoc } from "./types";

/* Datenschutzerklärung — Deutsch. Inhaltlich identisch zur englischen
   Fassung (privacy.en.ts); dort steht auch, welche DSGVO-Pflichtangaben
   gegenüber dem alten Text ergänzt wurden und was die Überarbeitung vom
   2026-11-02 geändert hat. Anker-IDs sind bewusst NICHT übersetzt, damit
   derselbe Abschnitt in jeder Sprache dieselbe URL hat.

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
  updated: "2026-11-02",
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
              text: "Bei jedem Seitenaufruf speichert unser Server die aufgerufene Seite, Browsertyp und -version, Betriebssystem, Referrer-URL, Uhrzeit der Anfrage und die IP-Adresse. Das ist technisch erforderlich, um die Seite auszuliefern und Missbrauch zu erkennen. Eine Zusammenführung mit anderen Datenquellen findet nicht statt. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (unser berechtigtes Interesse an einer sicheren, funktionsfähigen Website).",
            },
            {
              term: "Anfragen und Formulare",
              text: "Wenn Sie uns eine Anfrage senden — über ein Kontaktformular, den Rendite-Rechner, die Anforderung eines unserer kostenlosen Ratgeber oder das Formular für Kooperationspartner — speichern wir Ihre Eingaben: in der Regel Name, E-Mail-Adresse, Telefonnummer, bevorzugter Kontaktweg und Ihre Nachricht sowie freiwillige Angaben (zum Beispiel Budget, Zeitrahmen, Objektart oder Staatsangehörigkeit). Außerdem vermerken wir, von welcher Seite Sie die Anfrage gesendet haben und wie Sie auf unsere Website gelangt sind (siehe „Kampagnen-Zuordnung“). Wir antworten per E-Mail, Telefon oder WhatsApp, senden Ihnen den angeforderten Ratgeber oder die Berechnung und speichern die Anfrage in unserem Kundenverwaltungssystem, damit die betreuende Kollegin oder der betreuende Kollege den Verlauf Ihres Anliegens sieht. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche Maßnahmen auf Ihre Anfrage).",
            },
            {
              term: "Korrespondenz per E-Mail und WhatsApp",
              text: "Nachrichten, die Sie mit uns per E-Mail oder WhatsApp austauschen, legen wir bei Ihrer Anfrage ab, damit jede Person, die Ihnen antwortet, weiß, was bereits besprochen wurde. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO sowie Art. 6 Abs. 1 lit. f DSGVO (unser berechtigtes Interesse an einer vollständigen Dokumentation unserer Beratung).",
            },
            {
              term: "Anfragen über Lead-Formulare auf Facebook und Instagram",
              text: "Wenn Sie in einer unserer Anzeigen auf Facebook oder Instagram ein Anfrageformular ausfüllen, übermittelt uns Meta Platforms Ireland Limited die dort eingegebenen Angaben (in der Regel Name, Kontaktdaten und Ihre Antworten). Wir behandeln sie wie jede andere Anfrage. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.",
            },
            {
              term: "Vermittlung durch unsere Partner",
              text: "Hat ein Partner — etwa ein anderer Makler oder Berater — Sie an uns vermittelt, haben wir Ihre Angaben von diesem Partner erhalten. Der Partner kann in unserem Partnerportal den Stand seiner Vermittlung und die für Sie erstellten Objektpräsentationen einsehen. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO sowie Art. 6 Abs. 1 lit. f DSGVO (unser berechtigtes Interesse an der Zusammenarbeit mit Partnern, die uns Kunden vermitteln).",
            },
            {
              term: "Persönliche Objektpräsentationen",
              text: "Wir senden Ihnen gegebenenfalls einen persönlichen Link zu einer Auswahl von Objekten. Wenn Sie ihn öffnen, speichern wir, wann und wie lange Sie ihn angesehen haben und welche Objekte Sie als Favoriten markiert haben, und die Person, die ihn erstellt hat, wird benachrichtigt — so können wir gezielt auf das eingehen, was Sie tatsächlich interessiert. Der Link verfällt nach 30 Tagen, sofern nichts anderes vereinbart ist. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO sowie Art. 6 Abs. 1 lit. f DSGVO (unser berechtigtes Interesse an einer auf Sie zugeschnittenen Beratung).",
            },
            {
              term: "Termine",
              text: "Wenn Sie über unsere Terminseite Zeiten vorschlagen oder bestätigen, verarbeiten wir die vorgeschlagenen Zeiten, Ihre Zeitzone und Ihre Kontaktdaten, um den Termin zu vereinbaren und zu bestätigen. Vereinbaren wir ein Videogespräch, verarbeitet der Anbieter des genutzten Videodienstes (zum Beispiel Zoom) die für die Verbindung nötigen Daten. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.",
            },
            {
              term: "Newsletter",
              text: "Wenn Sie sich anmelden, verarbeiten wir Ihre E-Mail-Adresse, um Ihnen unseren Newsletter zu senden. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung), die Sie jederzeit mit einer Nachricht an office@cyprusvipestates.com widerrufen können.",
            },
            {
              term: "Website-Statistik (eigene, ohne Cookies)",
              text: "Wir zählen Seitenaufrufe auf unserem eigenen Server, ohne Cookies und ohne Dritte. Zu jedem Seitenaufruf speichern wir die Seite und Sprache, die Domain der verweisenden Website, Ihre Browser-Kennung und den Gerätetyp, das aus Ihrer IP-Adresse abgeleitete Land, etwaige Kampagnenparameter im Link (utm_source, utm_medium, utm_campaign), ob Sie das Cookie-Banner bereits beantwortet haben, sowie einen Code, der aus Ihrer IP-Adresse, Ihrer Browser-Kennung und dem Datum berechnet wird; dieser Code wechselt täglich, und Ihre IP-Adresse selbst wird nicht gespeichert. Auf Projektseiten erfassen wir zusätzlich, wie weit Sie scrollen und welche Schaltflächen Sie nutzen. Wir werten diese Statistik nur zusammengefasst aus, um zu sehen, welche Inhalte nützlich sind — nie, um Sie zu identifizieren. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (unser berechtigtes Interesse zu verstehen, wie die Website genutzt wird).",
            },
            {
              term: "Kampagnen-Zuordnung",
              text: "Kommen Sie über eine Anzeige, einen Kampagnenlink oder den Empfehlungslink eines Partners, speichert Ihr Browser die Herkunft des Besuchs (Kampagnenparameter, Klick-Kennungen von Anzeigen wie gclid oder fbclid, die verweisende Adresse und einen Partnercode) im Speicher des aktuellen Browser-Tabs; dieser wird geleert, sobald Sie den Tab schließen. Senden Sie während dieses Besuchs eine Anfrage, wird die Herkunft mit ihr gespeichert, damit wir wissen, welche Kampagne oder welcher Partner Sie zu uns gebracht hat. Nur wenn Sie Cookies zustimmen, bewahren wir sie zusätzlich 90 Tage in einem Cookie („cve_attr“) auf, damit auch eine spätere Anfrage richtig zugeordnet wird. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (unser berechtigtes Interesse zu wissen, von welchem Partner oder welcher Kampagne eine Anfrage stammt) für den Tab-Speicher und Art. 6 Abs. 1 lit. a DSGVO (Einwilligung) für das Cookie.",
            },
            {
              term: "Google Tag Manager, Google Analytics und Google Ads",
              text: "Nur wenn Sie Cookies zustimmen, laden wir den Google Tag Manager (Google Ireland Limited), der seinerseits Google Analytics 4 zur Reichweitenmessung und Google Ads zur Conversion-Messung und für Remarketing aktiviert. Der Tag Manager selbst verwaltet nur die übrigen Tags; die Datenverarbeitung erfolgt durch die von ihm geladenen Dienste. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).",
            },
            {
              term: "Meta-Pixel",
              text: "Nur mit Ihrer Einwilligung. Anbieter: Meta Platforms Ireland Limited. Es misst, ob ein Besuch auf eine unserer Anzeigen zurückgeht, und ermöglicht das Ansprechen vergleichbarer Zielgruppen. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).",
            },
            {
              term: "Meta Conversions API",
              text: "Nur wenn Sie Cookies zugestimmt haben, übermitteln wir zusätzlich zwei Ereignisse direkt von unserem Server an Meta Platforms Ireland Limited: das Absenden einer Anfrage („Lead“) und die Kontaktaufnahme per WhatsApp, Telefon oder E-Mail („Contact“). Bei einer Anfrage senden wir Ihre E-Mail-Adresse und Telefonnummer in pseudonymisierter Form (als SHA-256-Hashwerte, niemals im Klartext); bei beiden Ereignissen Ihre IP-Adresse, Ihre Browser-Kennung, die Adresse der Seite und die Meta-Cookie-Kennungen (_fbp, _fbc). Eine Ereignis-ID stellt sicher, dass Meta ein Ereignis nur einmal zählt, auch wenn es sowohl von Ihrem Browser als auch von unserem Server eintrifft. Meta nutzt diese Daten, um unsere Werbung zu messen und zu verbessern; für diese Verarbeitung sind wir gemeinsam mit Meta verantwortlich (Art. 26 DSGVO). Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).",
            },
            {
              term: "LinkedIn Insight Tag",
              text: "Nur mit Ihrer Einwilligung. Anbieter: LinkedIn Ireland Unlimited Company. Es misst die Wirkung unserer LinkedIn-Kampagnen und erlaubt dort die Zielgruppenansprache. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).",
            },
            {
              term: "Microsoft Clarity — einschließlich Sitzungsaufzeichnung",
              text: "Clarity (Microsoft Ireland Operations Limited) zeigt uns, wie Seiten tatsächlich genutzt werden: Mausbewegungen, Scrollen, Klicks und Interaktionen, die als anonymisierte Sitzungsaufzeichnung abgespielt und zu Heatmaps zusammengefasst werden können. Das geht deutlich weiter als bloßes Zählen von Aufrufen, weshalb wir es hier gesondert benennen. Das Clarity-Skript wird auf jeder Seite geladen, erhält dabei aber die Information, ob Sie eingewilligt haben: ohne Ihre Einwilligung läuft es im eingeschränkten Modus von Microsoft, der keine Cookies setzt und kein Profil bildet; mit Ihrer Einwilligung zeichnet es die vollständige Sitzung auf. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung) für den vollen Modus und Art. 6 Abs. 1 lit. f DSGVO (unser berechtigtes Interesse zu erkennen, wo die Seite Nutzer verwirrt) für den eingeschränkten Modus. Dem letzteren können Sie jederzeit nach Art. 21 widersprechen.",
            },
            {
              term: "Karten und andere eingebundene Inhalte",
              text: "Zur Darstellung von Karten laden einige Seiten Kartenkacheln direkt von OpenFreeMap und der OpenStreetMap Foundation; ältere Kartenansichten laden Markierungssymbole aus dem Content-Netzwerk von Cloudflare. Das Feld für die Telefonnummer lädt kleine Länderflaggen von GitHub Pages, und einige Seiten binden Videos von YouTube (Google) ein. Lädt Ihr Browser solche Inhalte, erhält der Anbieter — wie bei jeder Anfrage im Internet — Ihre IP-Adresse und Browserinformationen. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (unser berechtigtes Interesse, Lagen und Videos gut nutzbar darzustellen).",
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
        { kind: "p", text: "Je nach Anliegen können Ihre Daten erhalten:" },
        {
          kind: "list",
          items: [
            "Bauträger auf Zypern — um Sie als unseren Kunden zu registrieren und Besichtigungen und Angebote für die Objekte zu organisieren, die Sie interessieren. Für die Registrierung übermitteln wir Ihren Namen, Ihr Immobilieninteresse und Budget sowie eine teilweise unkenntlich gemachte Telefonnummer; kommt es zu einer Besichtigung oder einem Angebot, erhält der Bauträger die dafür nötigen Kontaktdaten. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.",
            "Unabhängige Anwältinnen und Anwälte — für rechtliche Prüfungen und Vertragsgestaltung, sofern Sie um eine Vermittlung bitten. Sie handeln als eigene Verantwortliche und unterliegen ihrer eigenen Verschwiegenheitspflicht.",
            "Der Partner, der Sie gegebenenfalls vermittelt hat — er sieht den Stand seiner Vermittlung und die für Sie erstellten Präsentationen (siehe Abschnitt 2).",
            "Die Messenger-Dienste unseres Teams — jede neue Anfrage wird in unsere Team-Chats auf Telegram (Telegram FZ-LLC, Vereinigte Arabische Emirate) und WhatsApp (WhatsApp Ireland Limited) weitergeleitet, damit wir schnell antworten können; wenn Sie es wünschen, korrespondieren wir mit Ihnen über WhatsApp.",
            "Unsere IT-Dienstleister, die als Auftragsverarbeiter nach Art. 28 DSGVO ausschließlich nach unseren dokumentierten Weisungen handeln: Hostinger International Ltd. (Server-Hosting und E-Mail), Anthropic (ein KI-Assistent, mit dem unser Team Anfragen zusammenfasst, Antworten entwirft und Rückmeldungen von Bauträgern sortiert — er sieht den Inhalt der Anfrage und ihren Verlauf) sowie der Anbieter des Videodienstes für mit Ihnen vereinbarte Gespräche.",
            "Meta, Google, LinkedIn und Microsoft — wie in Abschnitt 2 beschrieben und, wo es dort so steht, nur mit Ihrer Einwilligung.",
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
          text: "Google, Meta, Microsoft und LinkedIn sind über ihre irischen Gesellschaften eingebunden; die Verarbeitung auf deren Infrastruktur kann jedoch Übermittlungen in die USA umfassen, ebenso unsere Nutzung von Anthropic, Zoom, Cloudflare und GitHub. Diese Übermittlungen stützen sich auf den Angemessenheitsbeschluss der EU-Kommission zum EU-US Data Privacy Framework, soweit der Empfänger darunter zertifiziert ist, im Übrigen auf Standardvertragsklauseln nach Art. 46 Abs. 2 lit. c DSGVO.",
        },
        {
          kind: "p",
          text: "Benachrichtigungen über neue Anfragen laufen über Telegram, dessen Betreiber seinen Sitz in den Vereinigten Arabischen Emiraten hat, einem Land ohne Angemessenheitsbeschluss der EU. Wir nutzen den Dienst ausschließlich, um Ihre Anfrage auf Ihren Wunsch zügig zu bearbeiten (Art. 49 Abs. 1 lit. b DSGVO).",
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
            "Server-Logfiles: 14 Tage, danach Löschung.",
            "Anfragen, Korrespondenz und Aufrufe von Präsentationen: solange wir zu Ihrem Anliegen mit Ihnen in Kontakt stehen, und danach nur so lange, wie daraus noch ein Folgegespräch entstehen kann. Löschen wir eine Anfrage, wird sie nach 90 Tagen endgültig aus unserem System entfernt.",
            "Daten zu einem abgeschlossenen Geschäft: für den Zeitraum, den zyprisches Handels- und Steuerrecht vorschreibt.",
            "Newsletter-Anmeldungen: bis zur Abmeldung.",
            "Ihre Cookie-Entscheidung: 180 Tage in Ihrem Browser, danach fragen wir erneut. Das Cookie zur Kampagnen-Zuordnung (nur mit Einwilligung): 90 Tage. Der Tab-Speicher: bis Sie den Tab schließen.",
            "Links, die wir Ihnen senden: Download-Links zu unseren Ratgebern und persönliche Präsentationslinks verfallen nach 30 Tagen.",
            "Website-Statistik: nur in der in Abschnitt 2 beschriebenen pseudonymen Form, und gelöscht, sobald sie für den Vergleich der Nutzung über die Zeit nicht mehr benötigt wird.",
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
          text: "Unser Cookie-Banner lässt Ihnen eine Wahl: alle optionalen Cookies akzeptieren oder nur die notwendigen zulassen. Die Zustimmung umfasst die unten genannten Kategorien Analyse und Marketing; lehnen Sie ab, bleibt nur das Notwendige.",
        },
        {
          kind: "definitions",
          items: [
            {
              term: "Notwendig",
              text: "Für den Betrieb der Website erforderlich: das Cookie „cookieConsent“, das Ihre Entscheidung 180 Tage speichert, und der in Abschnitt 2 beschriebene Tab-Speicher zur Kampagnen-Zuordnung. Ihre Sprache ist Teil der Seitenadresse, dafür wird kein Cookie benötigt. Grundlage: Art. 6 Abs. 1 lit. f DSGVO.",
            },
            {
              term: "Analyse",
              text: "Google Analytics 4 (über den Google Tag Manager) und Microsoft Clarity im vollen Modus, die eigene Cookies setzen (zum Beispiel _ga, _clck, _clsk). Werden erst nach Ihrer Zustimmung gesetzt.",
            },
            {
              term: "Marketing",
              text: "Google Ads, das Meta-Pixel und die Conversions API sowie das LinkedIn Insight Tag, die eigene Cookies setzen (zum Beispiel _gcl_au, _fbp, _fbc und die li_-Cookies von LinkedIn), und unser Cookie zur Kampagnen-Zuordnung „cve_attr“ (90 Tage). Werden erst nach Ihrer Zustimmung gesetzt.",
            },
          ],
        },
        {
          kind: "p",
          text: "Sie können Ihre Entscheidung jederzeit über den Link „Cookie-Einstellungen“ am Ende jeder Seite ändern oder widerrufen; nach einem Widerruf lädt die Seite ohne die optionalen Dienste neu. Die Rechtmäßigkeit der bis dahin erfolgten Verarbeitung bleibt unberührt. Sie können Cookies zudem in Ihren Browsereinstellungen blockieren oder löschen — Teile der Website funktionieren dann möglicherweise nicht wie vorgesehen.",
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
          text: "Eine automatisierte Entscheidungsfindung oder ein Profiling mit rechtlicher Wirkung oder ähnlich erheblicher Beeinträchtigung im Sinne des Art. 22 DSGVO findet nicht statt. Unsere Software schlägt Objekte vor, die zu den von Ihnen genannten Wünschen passen, und unser Team nutzt einen KI-Assistenten, um Anfragen zusammenzufassen und Antworten zu entwerfen (siehe Abschnitt 3); das Ergebnis prüft stets ein Mensch, der auch über das weitere Vorgehen entscheidet.",
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
