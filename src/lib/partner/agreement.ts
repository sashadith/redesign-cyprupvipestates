/**
 * Partner agreement per locale. Rendered on /agreement (public) and accepted at registration and,
 * for existing partners, on the acceptance screen when the version changes (version + timestamp +
 * IP are stored). The English text is binding (clause 14.2). To change the agreement, write a new
 * version and bump PARTNER_AGREEMENT_VERSION; never edit a published version's text in place.
 *
 * Facts it states are the portal's own rules: shares (Partner.handoverShare / fixShare, tiers.ts),
 * protection (claimState.ts), payouts and credit notes (payoutRules.ts, creditNote.ts), VAT modes.
 * Keep them in step when the program changes.
 */
import type { PartnerLocale } from "./i18n";

export const PARTNER_AGREEMENT_VERSION = "2026-11";

export type AgreementText = {
  title: string;
  intro: string;
  parties: { name: string; lines: string[] }[];
  sections: { heading: string; clauses: string[] }[];
};

const CVE_ADDRESS = ["Palaion Patron Germanou 11, 8011 Paphos, Cyprus", "VAT CY60038766O · Reg. HE450005"];

const en: AgreementText = {
  title: "Partner Agreement",
  intro: "This agreement governs the co-operation between Cyprus VIP Estates and the Partner when the Partner introduces clients who want to buy property in Cyprus.",
  parties: [
    { name: "SecretBrand Solutions LTD", lines: ["trading as Cyprus VIP Estates", ...CVE_ADDRESS, "represented by Sascha Dith, Director (“Cyprus VIP Estates”, “we”)"] },
    { name: "The Partner", lines: ["as registered in the partner portal: name or company, address, country and, where applicable, VAT or tax number (“Partner”)"] },
  ],
  sections: [
    { heading: "1. Purpose and nature of the co-operation", clauses: [
      "1.1 Cyprus VIP Estates markets new-build property of developers in the Republic of Cyprus under agreements with those developers. The Partner introduces clients who are interested in buying such property.",
      "1.2 The co-operation is non-exclusive for both parties.",
      "1.3 The Partner acts as an independent contractor. The Partner is not our employee, agent or representative and may not make declarations, accept payments or give promises on behalf of Cyprus VIP Estates or a developer.",
      "1.4 The Partner is responsible for complying with the laws of its own country, in particular on licensing or registration as an intermediary, advertising, consumer protection and taxes.",
    ] },
    { heading: "2. Conclusion of the agreement and partner account", clauses: [
      "2.1 This agreement is concluded when the Partner accepts it electronically in the partner portal and Cyprus VIP Estates approves the application. We record the version accepted, the date and time and the IP address. We may decline an application without giving reasons.",
      "2.2 The Partner provides complete and correct registration details and keeps them up to date, in particular billing name and address, VAT status and bank details. Companies registered in the European Union provide their VAT number.",
      "2.3 Access to the partner portal is personal. The Partner keeps its login details confidential and is responsible for all activity under its account.",
    ] },
    { heading: "3. Ways of working: Handover and Fix", clauses: [
      "3.1 When submitting a client, the Partner chooses one of two ways of working.",
      "Handover: the Partner introduces the client and Cyprus VIP Estates takes over all further contact, advice, viewings and support through to completion.",
      "Fix: the Partner stays the client's main contact and accompanies the purchase together with us, including the first consultation, the preparation of the viewing trip in co-ordination with us and the follow-up with the client. Cyprus VIP Estates handles the developer, the viewings in Cyprus and the co-ordination of the purchase contract. A Fix submission relates to one specific project.",
      "3.2 The way of working can only be changed by agreement before a reservation agreement is signed. A message in the partner portal is sufficient.",
    ] },
    { heading: "4. Client submission, review and protection", clauses: [
      "4.1 The Partner submits clients through the partner portal with the client's name and contact details, and only with the client's consent (clause 9).",
      "4.2 We review each submission. If the client is already known to us, the submission is not accepted and the Partner receives a short notice without details of the existing contact. An accepted submission is shown in the portal as an active claim.",
      "4.3 We register the client with the developer before the first viewing. If the developer declines the registration because the client is already registered with it, directly or through another agent, no commission is due to either party for that developer's projects.",
      "4.4 A client is protected for six (6) months from the later of (a) the acceptance of the submission and (b) the last real contact between our team and the client by call, email or messenger. Internal notes do not extend the protection. Once a reservation or purchase agreement has been signed within the protection period, the protection for that purchase no longer expires.",
      "4.5 The protection covers every property the client reserves with us during the protection period.",
      "4.6 The status, dates and amounts shown in the partner portal are the record of the co-operation. The Partner may raise objections within 14 days of a change becoming visible.",
    ] },
    { heading: "5. Commission", clauses: [
      "5.1 The Partner is entitled to commission if, within the protection period, a protected client signs a reservation or purchase agreement for a property marketed by Cyprus VIP Estates and the developer pays our commission for that sale.",
      "5.2 The commission is a share of the net commission (excluding VAT) that Cyprus VIP Estates actually receives from the developer for that sale. The starting shares are 30% for Handover and 50% for Fix.",
      "5.3 Shares rise with the partner tiers shown in the portal. At the date of this version they are: Silver 30% (Handover) / 50% (Fix); Gold 35% / 55% from 3 closed deals within 12 months; Platinum 40% / 60% from 6 closed deals within 12 months. We confirm a tier change in the portal; tiers are not lowered automatically. Shares agreed individually in writing take precedence. The share applying to a sale is the one in force for the Partner when the deal is recorded.",
      "5.4 Expected amounts and the commission calculator in the portal are estimates and do not create an entitlement.",
      "5.5 Commission is calculated and paid in euros. Expenses such as travel costs are not reimbursed unless agreed in writing in advance.",
    ] },
    { heading: "6. Payment, credit notes and VAT", clauses: [
      "6.1 Commission becomes due only once Cyprus VIP Estates has received its commission from the developer in full. Developers usually pay once the buyer has paid 40% to 50% of the purchase price.",
      "6.2 We inform the Partner within two (2) working days of receiving the developer's payment, in the portal and by email or Telegram.",
      "6.3 The Partner agrees to self-billing: Cyprus VIP Estates issues a credit note in the Partner's name for each payout, numbered CVE-GS-year-number and available in the portal. The Partner does not issue its own invoice for the same commission and may object to errors in a credit note within 14 days of it becoming available.",
      "6.4 We transfer the commission to the bank account saved in the Partner's profile within seven (7) days of receiving our commission from the developer.",
      "6.5 VAT: for a Partner registered for VAT in another EU member state, the reverse charge mechanism applies and no Cypriot VAT is charged. For a Partner registered for VAT in Cyprus, Cypriot VAT at the applicable rate (currently 19%) is added. In all other cases no VAT is shown. The Partner is responsible for its own income tax and social contributions and for the correctness of its VAT details.",
      "6.6 For security, payouts are paused for seven (7) days after a change of bank account. The Partner receives an email confirming the change.",
      "6.7 If a sale is cancelled and the developer reclaims or reduces our commission, the Partner's commission is reduced in the same proportion. The Partner repays any amount already received within 30 days of our request; we may set it off against future payouts.",
    ] },
    { heading: "7. Conduct", clauses: [
      "7.1 Clients must come from the Partner's own genuine relationships. Lead generators, purchased or rented contact lists and unsolicited mass messages are not allowed.",
      "7.2 The Partner does not promise prices, discounts, returns, availability, completion dates or legal, tax or residency outcomes. Such questions are passed on to our team.",
      "7.3 The Partner presents itself as an independent partner introducing the client to Cyprus VIP Estates and does not present our name or brand as its own. Advertising that uses our name or logo requires our prior written approval.",
      "7.4 The Partner does not publish our listings, photos, plans or prices on portals, marketplaces or its own advertising. Presentations created in the portal may be shared with the client they were made for.",
      "7.5 Rights under this agreement are personal. The Partner may not appoint sub-partners or share commission with third parties for introductions.",
      "7.6 Neither party circumvents the other: the Partner does not approach developers presented by us directly in relation to clients covered by this agreement, and Cyprus VIP Estates does not bypass the Partner for a protected client.",
    ] },
    { heading: "8. Information and materials", clauses: [
      "8.1 Through the partner portal we provide information on projects, availability, prices, the Partner's shares, materials and presentations. This information comes from the developers, may change at any time and does not guarantee availability; the developer's current information prevails.",
      "8.2 The Partner uses this information only to advise its own clients and does not pass it on to third parties.",
      "8.3 When the agreement ends, portal access ends. The Partner deletes all materials it has downloaded and confirms the deletion in writing on request.",
    ] },
    { heading: "9. Data protection", clauses: [
      "9.1 Each party is an independent controller under the GDPR for the personal data it processes.",
      "9.2 The Partner submits a client's personal data only with the client's consent and informs the client that Cyprus VIP Estates will contact them and process their data for the purchase.",
      "9.3 We process the Partner's data in line with our privacy policy. Bank details are stored encrypted.",
    ] },
    { heading: "10. Confidentiality", clauses: [
      "10.1 Both parties keep confidential all non-public information received in the co-operation, in particular commission rates and terms, client data, prices and internal processes. This obligation continues after the agreement ends.",
    ] },
    { heading: "11. Liability", clauses: [
      "11.1 The Partner is liable for breaches of this agreement and indemnifies Cyprus VIP Estates against third-party claims arising from unlawful promotion, missing client consent or promises made in breach of clause 7.",
      "11.2 Cyprus VIP Estates is not liable for the performance of developers, the completion of projects or the accuracy of information provided by developers. Except in cases of intent or gross negligence, our liability is limited to the commission payable to the Partner under this agreement.",
    ] },
    { heading: "12. Term and termination", clauses: [
      "12.1 The agreement runs for an indefinite period. Either party may terminate it with one (1) month's notice to the end of a calendar month, by email or through the portal.",
      "12.2 Either party may terminate with immediate effect for good cause, in particular for a breach of clauses 7, 9 or 10, false registration details or fraud. Cyprus VIP Estates may suspend the partner account while such a case is being examined.",
      "12.3 Commission remains payable for purchases by clients who were protected when the agreement ended, if the reservation or purchase agreement is signed within their protection period. This does not apply if we terminated for good cause relating to that client.",
      "12.4 Clauses 6.7, 8.3, 9, 10 and 11 continue to apply after the agreement ends.",
    ] },
    { heading: "13. Changes to this agreement", clauses: [
      "13.1 We may change this agreement for the future and announce a new version by email and in the portal, as a rule at least 30 days in advance. The new version applies once the Partner accepts it in the portal; until then the Partner can use the portal only to read and accept it. A Partner who does not accept may terminate under clause 12.1. Changes never affect commission on deals already recorded.",
    ] },
    { heading: "14. Final provisions", clauses: [
      "14.1 This agreement is governed by the laws of the Republic of Cyprus. The courts of the Republic of Cyprus have jurisdiction.",
      "14.2 The English version is binding. Translations in the portal are provided for convenience.",
      "14.3 Changes and additions require text form; email and messages in the partner portal are sufficient.",
      "14.4 If any provision is invalid, the remaining provisions stay in force. The parties replace the invalid provision with a valid one that comes closest to its purpose.",
      "14.5 This agreement replaces earlier arrangements on the same subject, except shares agreed individually in writing.",
    ] },
  ],
};

const de: AgreementText = {
  title: "Partnervereinbarung",
  intro: "Diese Vereinbarung regelt die Zusammenarbeit zwischen Cyprus VIP Estates und dem Partner, wenn der Partner Kunden vorstellt, die eine Immobilie auf Zypern kaufen möchten. Verbindlich ist die englische Fassung.",
  parties: [
    { name: "SecretBrand Solutions LTD", lines: ["handelnd als Cyprus VIP Estates", ...CVE_ADDRESS, "vertreten durch Sascha Dith, Director („Cyprus VIP Estates“, „wir“)"] },
    { name: "Der Partner", lines: ["wie im Partnerportal registriert: Name oder Firma, Anschrift, Land und gegebenenfalls USt-IdNr. oder Steuernummer („Partner“)"] },
  ],
  sections: [
    { heading: "1. Gegenstand und Art der Zusammenarbeit", clauses: [
      "1.1 Cyprus VIP Estates vermarktet Neubauimmobilien von Bauträgern in der Republik Zypern auf Grundlage von Verträgen mit diesen Bauträgern. Der Partner stellt Kunden vor, die solche Immobilien kaufen möchten.",
      "1.2 Die Zusammenarbeit ist für beide Seiten nicht exklusiv.",
      "1.3 Der Partner handelt als selbständiger Unternehmer. Er ist weder unser Angestellter noch unser Vertreter und darf keine Erklärungen abgeben, keine Zahlungen annehmen und keine Zusagen im Namen von Cyprus VIP Estates oder eines Bauträgers machen.",
      "1.4 Der Partner ist dafür verantwortlich, die Gesetze seines Landes einzuhalten, insbesondere zu Erlaubnis oder Registrierung als Vermittler, Werbung, Verbraucherschutz und Steuern.",
    ] },
    { heading: "2. Vertragsschluss und Partnerkonto", clauses: [
      "2.1 Diese Vereinbarung kommt zustande, wenn der Partner sie im Partnerportal elektronisch akzeptiert und Cyprus VIP Estates die Bewerbung freigibt. Wir speichern die akzeptierte Version, Datum, Uhrzeit und IP-Adresse. Wir können eine Bewerbung ohne Angabe von Gründen ablehnen.",
      "2.2 Der Partner macht vollständige und richtige Angaben und hält sie aktuell, insbesondere Name und Anschrift für die Abrechnung, USt-Status und Bankverbindung. Unternehmen mit Sitz in der Europäischen Union geben ihre USt-IdNr. an.",
      "2.3 Der Zugang zum Partnerportal ist persönlich. Der Partner hält seine Zugangsdaten geheim und ist für alle Vorgänge unter seinem Konto verantwortlich.",
    ] },
    { heading: "3. Arbeitsweisen: Handover und Fix", clauses: [
      "3.1 Beim Einreichen eines Kunden wählt der Partner eine von zwei Arbeitsweisen.",
      "Handover: Der Partner stellt den Kunden vor, und Cyprus VIP Estates übernimmt den gesamten weiteren Kontakt, die Beratung, die Besichtigungen und die Betreuung bis zum Abschluss.",
      "Fix: Der Partner bleibt Hauptansprechpartner des Kunden und begleitet den Kauf gemeinsam mit uns, einschließlich Erstberatung, Vorbereitung der Besichtigungsreise in Abstimmung mit uns und Nachbetreuung des Kunden. Cyprus VIP Estates übernimmt den Bauträger, die Besichtigungen auf Zypern und die Abstimmung des Kaufvertrags. Eine Fix-Einreichung bezieht sich auf ein bestimmtes Projekt.",
      "3.2 Die Arbeitsweise kann nur einvernehmlich und nur vor Unterzeichnung eines Reservierungsvertrags geändert werden. Eine Nachricht im Partnerportal genügt.",
    ] },
    { heading: "4. Einreichung, Prüfung und Schutz von Kunden", clauses: [
      "4.1 Der Partner reicht Kunden über das Partnerportal mit Namen und Kontaktdaten ein, und nur mit dem Einverständnis des Kunden (Ziffer 9).",
      "4.2 Wir prüfen jede Einreichung. Ist der Kunde uns bereits bekannt, wird die Einreichung nicht angenommen; der Partner erhält einen kurzen Hinweis ohne Angaben zum bestehenden Kontakt. Eine angenommene Einreichung erscheint im Portal als aktiver Anspruch.",
      "4.3 Wir melden den Kunden vor der ersten Besichtigung beim Bauträger an. Lehnt der Bauträger die Anmeldung ab, weil der Kunde bei ihm bereits registriert ist, direkt oder über einen anderen Vermittler, steht keiner Seite für die Projekte dieses Bauträgers eine Provision zu.",
      "4.4 Ein Kunde ist sechs (6) Monate geschützt, gerechnet ab dem späteren der beiden Zeitpunkte: (a) Annahme der Einreichung, (b) letzter echter Kontakt zwischen unserem Team und dem Kunden per Anruf, E-Mail oder Messenger. Interne Notizen verlängern den Schutz nicht. Wird innerhalb der Schutzfrist ein Reservierungs- oder Kaufvertrag unterzeichnet, läuft der Schutz für diesen Kauf nicht mehr ab.",
      "4.5 Der Schutz umfasst jede Immobilie, die der Kunde innerhalb der Schutzfrist über uns reserviert.",
      "4.6 Status, Daten und Beträge im Partnerportal sind die Grundlage der Zusammenarbeit. Der Partner kann innerhalb von 14 Tagen, nachdem eine Änderung sichtbar wurde, widersprechen.",
    ] },
    { heading: "5. Provision", clauses: [
      "5.1 Der Partner hat Anspruch auf Provision, wenn ein geschützter Kunde innerhalb der Schutzfrist einen Reservierungs- oder Kaufvertrag für eine von Cyprus VIP Estates vermarktete Immobilie unterzeichnet und der Bauträger unsere Provision für diesen Verkauf zahlt.",
      "5.2 Die Provision ist ein Anteil an der Netto-Provision (ohne USt), die Cyprus VIP Estates für diesen Verkauf tatsächlich vom Bauträger erhält. Die Startanteile betragen 30 % bei Handover und 50 % bei Fix.",
      "5.3 Die Anteile steigen mit den im Portal angezeigten Partnerstufen. Zum Datum dieser Version gilt: Silver 30 % (Handover) / 50 % (Fix); Gold 35 % / 55 % ab 3 abgeschlossenen Deals innerhalb von 12 Monaten; Platinum 40 % / 60 % ab 6 abgeschlossenen Deals innerhalb von 12 Monaten. Einen Stufenwechsel bestätigen wir im Portal; Stufen werden nicht automatisch herabgesetzt. Schriftlich individuell vereinbarte Anteile gehen vor. Für einen Verkauf gilt der Anteil, der für den Partner gilt, wenn der Deal erfasst wird.",
      "5.4 Erwartete Beträge und der Provisionsrechner im Portal sind Schätzungen und begründen keinen Anspruch.",
      "5.5 Die Provision wird in Euro berechnet und gezahlt. Auslagen wie Reisekosten werden nicht erstattet, außer dies wurde vorab schriftlich vereinbart.",
    ] },
    { heading: "6. Zahlung, Gutschriften und Umsatzsteuer", clauses: [
      "6.1 Die Provision wird erst fällig, wenn Cyprus VIP Estates seine Provision vollständig vom Bauträger erhalten hat. Bauträger zahlen in der Regel, sobald der Käufer 40 % bis 50 % des Kaufpreises bezahlt hat.",
      "6.2 Wir informieren den Partner innerhalb von zwei (2) Werktagen nach Eingang der Zahlung des Bauträgers, im Portal und per E-Mail oder Telegram.",
      "6.3 Der Partner ist mit dem Gutschriftverfahren einverstanden: Cyprus VIP Estates stellt für jede Auszahlung eine Gutschrift im Namen des Partners aus, nummeriert als CVE-GS-Jahr-Nummer und im Portal abrufbar. Der Partner stellt für dieselbe Provision keine eigene Rechnung aus und kann Fehlern in einer Gutschrift innerhalb von 14 Tagen nach Bereitstellung widersprechen.",
      "6.4 Wir überweisen die Provision innerhalb von sieben (7) Tagen nach Eingang unserer Provision vom Bauträger auf das im Profil des Partners hinterlegte Konto.",
      "6.5 Umsatzsteuer: Ist der Partner in einem anderen EU-Mitgliedstaat umsatzsteuerlich registriert, gilt das Reverse-Charge-Verfahren und es wird keine zyprische USt berechnet. Ist der Partner in Zypern umsatzsteuerlich registriert, kommt zyprische USt zum geltenden Satz (derzeit 19 %) hinzu. In allen anderen Fällen wird keine USt ausgewiesen. Der Partner ist für seine eigene Einkommensteuer und Sozialabgaben sowie für die Richtigkeit seiner USt-Angaben verantwortlich.",
      "6.6 Aus Sicherheitsgründen werden Auszahlungen nach einer Änderung der Bankverbindung sieben (7) Tage ausgesetzt. Der Partner erhält eine E-Mail, die die Änderung bestätigt.",
      "6.7 Wird ein Verkauf storniert und fordert der Bauträger unsere Provision zurück oder kürzt sie, verringert sich die Provision des Partners im gleichen Verhältnis. Der Partner zahlt bereits erhaltene Beträge innerhalb von 30 Tagen nach unserer Aufforderung zurück; wir können sie mit künftigen Auszahlungen verrechnen.",
    ] },
    { heading: "7. Verhaltensregeln", clauses: [
      "7.1 Kunden müssen aus den eigenen, echten Beziehungen des Partners stammen. Leadgeneratoren, gekaufte oder gemietete Adresslisten und unaufgeforderte Massennachrichten sind nicht erlaubt.",
      "7.2 Der Partner sagt keine Preise, Rabatte, Renditen, Verfügbarkeiten, Fertigstellungstermine oder rechtlichen, steuerlichen oder aufenthaltsrechtlichen Ergebnisse zu. Solche Fragen gibt er an unser Team weiter.",
      "7.3 Der Partner tritt als unabhängiger Partner auf, der den Kunden an Cyprus VIP Estates vermittelt, und gibt unseren Namen oder unsere Marke nicht als eigene aus. Werbung mit unserem Namen oder Logo bedarf unserer vorherigen schriftlichen Zustimmung.",
      "7.4 Der Partner veröffentlicht unsere Angebote, Fotos, Pläne oder Preise nicht auf Portalen, Marktplätzen oder in eigener Werbung. Im Portal erstellte Präsentationen dürfen mit dem Kunden geteilt werden, für den sie erstellt wurden.",
      "7.5 Die Rechte aus dieser Vereinbarung sind persönlich. Der Partner darf keine Unterpartner einsetzen und Provisionen nicht mit Dritten für Vermittlungen teilen.",
      "7.6 Keine Seite umgeht die andere: Der Partner wendet sich wegen Kunden aus dieser Vereinbarung nicht direkt an Bauträger, die wir vorgestellt haben, und Cyprus VIP Estates übergeht den Partner bei einem geschützten Kunden nicht.",
    ] },
    { heading: "8. Informationen und Materialien", clauses: [
      "8.1 Über das Partnerportal stellen wir Informationen zu Projekten, Verfügbarkeit, Preisen, den Anteilen des Partners, Materialien und Präsentationen bereit. Diese Informationen stammen von den Bauträgern, können sich jederzeit ändern und garantieren keine Verfügbarkeit; maßgeblich sind die aktuellen Angaben des Bauträgers.",
      "8.2 Der Partner nutzt diese Informationen nur zur Beratung seiner eigenen Kunden und gibt sie nicht an Dritte weiter.",
      "8.3 Mit Ende der Vereinbarung endet der Portalzugang. Der Partner löscht alle heruntergeladenen Materialien und bestätigt die Löschung auf Anfrage schriftlich.",
    ] },
    { heading: "9. Datenschutz", clauses: [
      "9.1 Jede Partei ist für die von ihr verarbeiteten personenbezogenen Daten eigenständig Verantwortlicher im Sinne der DSGVO.",
      "9.2 Der Partner übermittelt personenbezogene Daten eines Kunden nur mit dessen Einverständnis und informiert den Kunden, dass Cyprus VIP Estates ihn kontaktieren und seine Daten für den Kauf verarbeiten wird.",
      "9.3 Wir verarbeiten die Daten des Partners gemäß unserer Datenschutzerklärung. Bankdaten werden verschlüsselt gespeichert.",
    ] },
    { heading: "10. Vertraulichkeit", clauses: [
      "10.1 Beide Parteien behandeln alle nicht öffentlichen Informationen aus der Zusammenarbeit vertraulich, insbesondere Provisionssätze und Konditionen, Kundendaten, Preise und interne Abläufe. Diese Pflicht gilt auch nach Ende der Vereinbarung fort.",
    ] },
    { heading: "11. Haftung", clauses: [
      "11.1 Der Partner haftet für Verstöße gegen diese Vereinbarung und stellt Cyprus VIP Estates von Ansprüchen Dritter frei, die aus unzulässiger Werbung, fehlendem Einverständnis von Kunden oder Zusagen entgegen Ziffer 7 entstehen.",
      "11.2 Cyprus VIP Estates haftet nicht für die Leistung von Bauträgern, die Fertigstellung von Projekten oder die Richtigkeit von Angaben der Bauträger. Außer bei Vorsatz oder grober Fahrlässigkeit ist unsere Haftung auf die nach dieser Vereinbarung an den Partner zu zahlende Provision begrenzt.",
    ] },
    { heading: "12. Laufzeit und Kündigung", clauses: [
      "12.1 Die Vereinbarung läuft auf unbestimmte Zeit. Jede Partei kann sie mit einer Frist von einem (1) Monat zum Ende eines Kalendermonats per E-Mail oder über das Portal kündigen.",
      "12.2 Jede Partei kann aus wichtigem Grund fristlos kündigen, insbesondere bei Verstößen gegen die Ziffern 7, 9 oder 10, falschen Registrierungsangaben oder Betrug. Cyprus VIP Estates kann das Partnerkonto während der Prüfung eines solchen Falls sperren.",
      "12.3 Für Käufe von Kunden, die bei Vertragsende geschützt waren, bleibt die Provision geschuldet, wenn der Reservierungs- oder Kaufvertrag innerhalb ihrer Schutzfrist unterzeichnet wird. Das gilt nicht, wenn wir aus wichtigem Grund im Zusammenhang mit diesem Kunden gekündigt haben.",
      "12.4 Die Ziffern 6.7, 8.3, 9, 10 und 11 gelten nach Vertragsende fort.",
    ] },
    { heading: "13. Änderungen dieser Vereinbarung", clauses: [
      "13.1 Wir können diese Vereinbarung für die Zukunft ändern und kündigen eine neue Version per E-Mail und im Portal an, in der Regel mindestens 30 Tage im Voraus. Die neue Version gilt, sobald der Partner sie im Portal akzeptiert; bis dahin kann der Partner das Portal nur nutzen, um sie zu lesen und zu akzeptieren. Ein Partner, der nicht zustimmt, kann nach Ziffer 12.1 kündigen. Änderungen berühren niemals die Provision für bereits erfasste Deals.",
    ] },
    { heading: "14. Schlussbestimmungen", clauses: [
      "14.1 Diese Vereinbarung unterliegt dem Recht der Republik Zypern. Zuständig sind die Gerichte der Republik Zypern.",
      "14.2 Verbindlich ist die englische Fassung. Übersetzungen im Portal dienen der Information.",
      "14.3 Änderungen und Ergänzungen bedürfen der Textform; E-Mail und Nachrichten im Partnerportal genügen.",
      "14.4 Ist eine Bestimmung unwirksam, bleiben die übrigen wirksam. Die Parteien ersetzen die unwirksame Bestimmung durch eine wirksame, die ihrem Zweck am nächsten kommt.",
      "14.5 Diese Vereinbarung ersetzt frühere Absprachen zum selben Gegenstand, ausgenommen schriftlich individuell vereinbarte Anteile.",
    ] },
  ],
};

const pl: AgreementText = {
  title: "Umowa partnerska",
  intro: "Niniejsza umowa reguluje współpracę między Cyprus VIP Estates a Partnerem, gdy Partner poleca klientów zainteresowanych zakupem nieruchomości na Cyprze. Wiążąca jest wersja angielska.",
  parties: [
    { name: "SecretBrand Solutions LTD", lines: ["działająca jako Cyprus VIP Estates", ...CVE_ADDRESS, "reprezentowana przez Sascha Dith, Director („Cyprus VIP Estates”, „my”)"] },
    { name: "Partner", lines: ["zgodnie z danymi w portalu partnera: imię i nazwisko lub firma, adres, kraj oraz, jeśli dotyczy, numer VAT lub numer podatkowy („Partner”)"] },
  ],
  sections: [
    { heading: "1. Przedmiot i charakter współpracy", clauses: [
      "1.1 Cyprus VIP Estates sprzedaje nowe nieruchomości deweloperów w Republice Cypryjskiej na podstawie umów z tymi deweloperami. Partner poleca klientów zainteresowanych zakupem takich nieruchomości.",
      "1.2 Współpraca nie jest wyłączna dla żadnej ze stron.",
      "1.3 Partner działa jako niezależny przedsiębiorca. Nie jest naszym pracownikiem, agentem ani przedstawicielem i nie może składać oświadczeń, przyjmować płatności ani składać obietnic w imieniu Cyprus VIP Estates lub dewelopera.",
      "1.4 Partner odpowiada za przestrzeganie prawa swojego kraju, w szczególności w zakresie licencji lub rejestracji jako pośrednik, reklamy, ochrony konsumentów i podatków.",
    ] },
    { heading: "2. Zawarcie umowy i konto partnera", clauses: [
      "2.1 Umowa zostaje zawarta, gdy Partner zaakceptuje ją elektronicznie w portalu partnera, a Cyprus VIP Estates zatwierdzi zgłoszenie. Zapisujemy zaakceptowaną wersję, datę, godzinę i adres IP. Możemy odrzucić zgłoszenie bez podania przyczyn.",
      "2.2 Partner podaje pełne i prawdziwe dane i aktualizuje je, w szczególności nazwę i adres do rozliczeń, status VAT i dane bankowe. Firmy zarejestrowane w Unii Europejskiej podają numer VAT.",
      "2.3 Dostęp do portalu partnera jest osobisty. Partner zachowuje dane logowania w tajemnicy i odpowiada za wszystkie działania na swoim koncie.",
    ] },
    { heading: "3. Modele współpracy: Handover i Fix", clauses: [
      "3.1 Zgłaszając klienta, Partner wybiera jeden z dwóch modeli współpracy.",
      "Handover: Partner przedstawia klienta, a Cyprus VIP Estates przejmuje cały dalszy kontakt, doradztwo, oglądanie nieruchomości i obsługę aż do finalizacji.",
      "Fix: Partner pozostaje głównym kontaktem klienta i towarzyszy zakupowi razem z nami, w tym przy pierwszej konsultacji, przygotowaniu wyjazdu na oglądanie w porozumieniu z nami i dalszej opiece nad klientem. Cyprus VIP Estates zajmuje się deweloperem, oglądaniem na Cyprze i koordynacją umowy kupna. Zgłoszenie Fix dotyczy jednego konkretnego projektu.",
      "3.2 Model współpracy można zmienić wyłącznie za porozumieniem przed podpisaniem umowy rezerwacyjnej. Wystarczy wiadomość w portalu partnera.",
    ] },
    { heading: "4. Zgłaszanie, weryfikacja i ochrona klientów", clauses: [
      "4.1 Partner zgłasza klientów przez portal partnera, podając imię i nazwisko oraz dane kontaktowe klienta, i wyłącznie za jego zgodą (pkt 9).",
      "4.2 Weryfikujemy każde zgłoszenie. Jeśli klient jest nam już znany, zgłoszenie nie zostaje przyjęte, a Partner otrzymuje krótką informację bez szczegółów istniejącego kontaktu. Przyjęte zgłoszenie jest widoczne w portalu jako aktywne roszczenie.",
      "4.3 Rejestrujemy klienta u dewelopera przed pierwszym oglądaniem. Jeśli deweloper odmówi rejestracji, ponieważ klient jest już u niego zarejestrowany, bezpośrednio lub przez innego pośrednika, żadnej ze stron nie przysługuje prowizja za projekty tego dewelopera.",
      "4.4 Klient jest chroniony przez sześć (6) miesięcy, licząc od późniejszego z dwóch zdarzeń: (a) przyjęcia zgłoszenia, (b) ostatniego realnego kontaktu naszego zespołu z klientem telefonicznie, e-mailem lub przez komunikator. Notatki wewnętrzne nie przedłużają ochrony. Jeśli w okresie ochrony zostanie podpisana umowa rezerwacyjna lub umowa kupna, ochrona dla tego zakupu już nie wygasa.",
      "4.5 Ochrona obejmuje każdą nieruchomość, którą klient zarezerwuje przez nas w okresie ochrony.",
      "4.6 Statusy, daty i kwoty widoczne w portalu partnera stanowią zapis współpracy. Partner może zgłosić zastrzeżenia w ciągu 14 dni od chwili, gdy zmiana stała się widoczna.",
    ] },
    { heading: "5. Prowizja", clauses: [
      "5.1 Partnerowi przysługuje prowizja, jeśli chroniony klient w okresie ochrony podpisze umowę rezerwacyjną lub umowę kupna nieruchomości sprzedawanej przez Cyprus VIP Estates, a deweloper zapłaci nam prowizję za tę sprzedaż.",
      "5.2 Prowizja stanowi udział w prowizji netto (bez VAT), którą Cyprus VIP Estates faktycznie otrzymuje od dewelopera za tę sprzedaż. Udziały początkowe wynoszą 30% przy Handover i 50% przy Fix.",
      "5.3 Udziały rosną wraz z poziomami partnerskimi widocznymi w portalu. Na dzień tej wersji obowiązują: Silver 30% (Handover) / 50% (Fix); Gold 35% / 55% od 3 zamkniętych transakcji w ciągu 12 miesięcy; Platinum 40% / 60% od 6 zamkniętych transakcji w ciągu 12 miesięcy. Zmianę poziomu potwierdzamy w portalu; poziomy nie są automatycznie obniżane. Pierwszeństwo mają udziały uzgodnione indywidualnie na piśmie. Dla danej sprzedaży obowiązuje udział, który przysługuje Partnerowi w chwili zarejestrowania transakcji.",
      "5.4 Oczekiwane kwoty i kalkulator prowizji w portalu są szacunkami i nie stanowią podstawy roszczenia.",
      "5.5 Prowizja jest naliczana i wypłacana w euro. Wydatki, takie jak koszty podróży, nie są zwracane, chyba że uzgodniono to wcześniej na piśmie.",
    ] },
    { heading: "6. Płatność, faktury i VAT", clauses: [
      "6.1 Prowizja staje się wymagalna dopiero wtedy, gdy Cyprus VIP Estates otrzyma pełną prowizję od dewelopera. Deweloperzy płacą zwykle wtedy, gdy kupujący zapłacił 40% do 50% ceny zakupu.",
      "6.2 Informujemy Partnera w ciągu dwóch (2) dni roboczych od otrzymania płatności od dewelopera, w portalu oraz e-mailem lub przez Telegram.",
      "6.3 Partner wyraża zgodę na samofakturowanie: Cyprus VIP Estates wystawia za każdą wypłatę fakturę w imieniu Partnera, numerowaną CVE-GS-rok-numer i dostępną w portalu. Partner nie wystawia własnej faktury za tę samą prowizję i może zgłosić błędy w fakturze w ciągu 14 dni od jej udostępnienia.",
      "6.4 Przelewamy prowizję na rachunek bankowy zapisany w profilu Partnera w ciągu siedmiu (7) dni od otrzymania naszej prowizji od dewelopera.",
      "6.5 VAT: dla Partnera zarejestrowanego jako podatnik VAT w innym państwie członkowskim UE stosuje się mechanizm odwrotnego obciążenia i nie nalicza się cypryjskiego VAT. Dla Partnera zarejestrowanego jako podatnik VAT na Cyprze dolicza się cypryjski VAT według obowiązującej stawki (obecnie 19%). W pozostałych przypadkach VAT nie jest wykazywany. Partner odpowiada za własny podatek dochodowy i składki na ubezpieczenie społeczne oraz za poprawność swoich danych VAT.",
      "6.6 Ze względów bezpieczeństwa wypłaty są wstrzymywane na siedem (7) dni po zmianie rachunku bankowego. Partner otrzymuje e-mail potwierdzający zmianę.",
      "6.7 Jeśli sprzedaż zostanie anulowana, a deweloper zażąda zwrotu naszej prowizji lub ją obniży, prowizja Partnera zmniejsza się w tej samej proporcji. Partner zwraca już otrzymane kwoty w ciągu 30 dni od naszego wezwania; możemy je potrącić z przyszłych wypłat.",
    ] },
    { heading: "7. Zasady postępowania", clauses: [
      "7.1 Klienci muszą pochodzić z własnych, rzeczywistych relacji Partnera. Niedozwolone są generatory leadów, kupione lub wynajęte listy kontaktów i niezamówione masowe wiadomości.",
      "7.2 Partner nie obiecuje cen, rabatów, zwrotów z inwestycji, dostępności, terminów ukończenia ani skutków prawnych, podatkowych lub pobytowych. Takie pytania przekazuje naszemu zespołowi.",
      "7.3 Partner występuje jako niezależny partner, który przedstawia klienta Cyprus VIP Estates, i nie przedstawia naszej nazwy ani marki jako własnej. Reklama z użyciem naszej nazwy lub logo wymaga naszej uprzedniej pisemnej zgody.",
      "7.4 Partner nie publikuje naszych ofert, zdjęć, planów ani cen na portalach, platformach sprzedażowych ani we własnych reklamach. Prezentacje utworzone w portalu można udostępniać klientowi, dla którego zostały przygotowane.",
      "7.5 Prawa wynikające z umowy są osobiste. Partner nie może powoływać podpartnerów ani dzielić się prowizją z osobami trzecimi za polecenia.",
      "7.6 Żadna ze stron nie omija drugiej: Partner nie kontaktuje się bezpośrednio z przedstawionymi przez nas deweloperami w sprawie klientów objętych umową, a Cyprus VIP Estates nie pomija Partnera w przypadku chronionego klienta.",
    ] },
    { heading: "8. Informacje i materiały", clauses: [
      "8.1 W portalu partnera udostępniamy informacje o projektach, dostępności, cenach, udziałach Partnera, materiały i prezentacje. Informacje te pochodzą od deweloperów, mogą się w każdej chwili zmienić i nie gwarantują dostępności; decydujące są aktualne dane dewelopera.",
      "8.2 Partner wykorzystuje te informacje wyłącznie do doradzania własnym klientom i nie przekazuje ich osobom trzecim.",
      "8.3 Z chwilą zakończenia umowy dostęp do portalu wygasa. Partner usuwa wszystkie pobrane materiały i na żądanie potwierdza to na piśmie.",
    ] },
    { heading: "9. Ochrona danych", clauses: [
      "9.1 Każda ze stron jest niezależnym administratorem w rozumieniu RODO w odniesieniu do przetwarzanych przez siebie danych osobowych.",
      "9.2 Partner przekazuje dane osobowe klienta wyłącznie za jego zgodą i informuje klienta, że Cyprus VIP Estates skontaktuje się z nim i będzie przetwarzać jego dane w związku z zakupem.",
      "9.3 Przetwarzamy dane Partnera zgodnie z naszą polityką prywatności. Dane bankowe są przechowywane w formie zaszyfrowanej.",
    ] },
    { heading: "10. Poufność", clauses: [
      "10.1 Obie strony zachowują w poufności wszystkie niepubliczne informacje uzyskane w ramach współpracy, w szczególności stawki i warunki prowizji, dane klientów, ceny i procesy wewnętrzne. Obowiązek ten obowiązuje również po zakończeniu umowy.",
    ] },
    { heading: "11. Odpowiedzialność", clauses: [
      "11.1 Partner odpowiada za naruszenia umowy i zwalnia Cyprus VIP Estates z roszczeń osób trzecich wynikających z niezgodnej z prawem promocji, braku zgody klienta lub obietnic złożonych wbrew pkt 7.",
      "11.2 Cyprus VIP Estates nie odpowiada za działania deweloperów, ukończenie projektów ani prawdziwość informacji przekazanych przez deweloperów. Z wyjątkiem winy umyślnej lub rażącego niedbalstwa nasza odpowiedzialność jest ograniczona do prowizji należnej Partnerowi na podstawie umowy.",
    ] },
    { heading: "12. Czas trwania i wypowiedzenie", clauses: [
      "12.1 Umowa jest zawarta na czas nieokreślony. Każda ze stron może ją wypowiedzieć z jednomiesięcznym (1) okresem wypowiedzenia na koniec miesiąca kalendarzowego, e-mailem lub przez portal.",
      "12.2 Każda ze stron może wypowiedzieć umowę ze skutkiem natychmiastowym z ważnego powodu, w szczególności w razie naruszenia pkt 7, 9 lub 10, podania nieprawdziwych danych rejestracyjnych lub oszustwa. Cyprus VIP Estates może zawiesić konto partnera na czas wyjaśniania takiej sprawy.",
      "12.3 Prowizja pozostaje należna za zakupy klientów, którzy byli chronieni w chwili zakończenia umowy, jeśli umowa rezerwacyjna lub umowa kupna zostanie podpisana w ich okresie ochrony. Nie dotyczy to sytuacji, gdy wypowiedzieliśmy umowę z ważnego powodu związanego z tym klientem.",
      "12.4 Punkty 6.7, 8.3, 9, 10 i 11 obowiązują również po zakończeniu umowy.",
    ] },
    { heading: "13. Zmiany umowy", clauses: [
      "13.1 Możemy zmienić umowę na przyszłość i ogłaszamy nową wersję e-mailem oraz w portalu, z reguły co najmniej 30 dni wcześniej. Nowa wersja obowiązuje od chwili jej akceptacji przez Partnera w portalu; do tego czasu Partner może korzystać z portalu wyłącznie w celu jej przeczytania i akceptacji. Partner, który jej nie akceptuje, może wypowiedzieć umowę zgodnie z pkt 12.1. Zmiany nigdy nie wpływają na prowizję za transakcje już zarejestrowane.",
    ] },
    { heading: "14. Postanowienia końcowe", clauses: [
      "14.1 Umowa podlega prawu Republiki Cypryjskiej. Właściwe są sądy Republiki Cypryjskiej.",
      "14.2 Wiążąca jest wersja angielska. Tłumaczenia w portalu mają charakter informacyjny.",
      "14.3 Zmiany i uzupełnienia wymagają formy tekstowej; wystarczy e-mail lub wiadomość w portalu partnera.",
      "14.4 Jeśli którekolwiek postanowienie jest nieważne, pozostałe pozostają w mocy. Strony zastąpią nieważne postanowienie ważnym, najbliższym jego celowi.",
      "14.5 Umowa zastępuje wcześniejsze ustalenia w tym samym zakresie, z wyjątkiem udziałów uzgodnionych indywidualnie na piśmie.",
    ] },
  ],
};

const ru: AgreementText = {
  title: "Партнёрское соглашение",
  intro: "Настоящее соглашение регулирует сотрудничество между Cyprus VIP Estates и Партнёром, когда Партнёр рекомендует клиентов, желающих купить недвижимость на Кипре. Обязательной является английская версия.",
  parties: [
    { name: "SecretBrand Solutions LTD", lines: ["действующая под названием Cyprus VIP Estates", ...CVE_ADDRESS, "в лице Sascha Dith, Director («Cyprus VIP Estates», «мы»)"] },
    { name: "Партнёр", lines: ["согласно данным в партнёрском портале: имя или компания, адрес, страна и, если применимо, номер плательщика НДС или налоговый номер («Партнёр»)"] },
  ],
  sections: [
    { heading: "1. Предмет и характер сотрудничества", clauses: [
      "1.1 Cyprus VIP Estates продаёт новую недвижимость застройщиков в Республике Кипр на основании договоров с этими застройщиками. Партнёр рекомендует клиентов, заинтересованных в покупке такой недвижимости.",
      "1.2 Сотрудничество не является эксклюзивным ни для одной из сторон.",
      "1.3 Партнёр действует как независимый предприниматель. Он не является нашим сотрудником, агентом или представителем и не вправе делать заявления, принимать платежи или давать обещания от имени Cyprus VIP Estates или застройщика.",
      "1.4 Партнёр отвечает за соблюдение законодательства своей страны, в частности в отношении лицензирования или регистрации в качестве посредника, рекламы, защиты прав потребителей и налогов.",
    ] },
    { heading: "2. Заключение соглашения и аккаунт партнёра", clauses: [
      "2.1 Соглашение считается заключённым, когда Партнёр принимает его в электронном виде в партнёрском портале, а Cyprus VIP Estates одобряет заявку. Мы сохраняем принятую версию, дату, время и IP-адрес. Мы вправе отклонить заявку без объяснения причин.",
      "2.2 Партнёр предоставляет полные и достоверные данные и поддерживает их в актуальном состоянии, в частности имя и адрес для расчётов, статус по НДС и банковские реквизиты. Компании, зарегистрированные в Европейском союзе, указывают номер плательщика НДС.",
      "2.3 Доступ к партнёрскому порталу является персональным. Партнёр хранит данные для входа в тайне и отвечает за все действия в своём аккаунте.",
    ] },
    { heading: "3. Форматы работы: Handover и Fix", clauses: [
      "3.1 Передавая клиента, Партнёр выбирает один из двух форматов работы.",
      "Handover: Партнёр знакомит нас с клиентом, а Cyprus VIP Estates берёт на себя весь дальнейший контакт, консультации, просмотры и сопровождение до завершения сделки.",
      "Fix: Партнёр остаётся основным контактом клиента и сопровождает покупку вместе с нами, включая первую консультацию, подготовку ознакомительной поездки по согласованию с нами и дальнейшую работу с клиентом. Cyprus VIP Estates берёт на себя работу с застройщиком, просмотры на Кипре и согласование договора купли-продажи. Заявка Fix относится к одному конкретному проекту.",
      "3.2 Формат работы можно изменить только по соглашению сторон до подписания договора резервирования. Достаточно сообщения в партнёрском портале.",
    ] },
    { heading: "4. Передача, проверка и защита клиентов", clauses: [
      "4.1 Партнёр передаёт клиентов через партнёрский портал, указывая имя и контактные данные клиента, и только с его согласия (пункт 9).",
      "4.2 Мы проверяем каждую заявку. Если клиент нам уже известен, заявка не принимается, а Партнёр получает короткое уведомление без подробностей о существующем контакте. Принятая заявка отображается в портале как активная заявка.",
      "4.3 Мы регистрируем клиента у застройщика до первого просмотра. Если застройщик отказывает в регистрации, потому что клиент уже зарегистрирован у него напрямую или через другого посредника, ни одной из сторон не полагается комиссия по проектам этого застройщика.",
      "4.4 Клиент защищён в течение шести (6) месяцев, считая от более позднего из двух событий: (a) принятия заявки, (b) последнего реального контакта нашей команды с клиентом по телефону, электронной почте или в мессенджере. Внутренние заметки не продлевают защиту. Если в период защиты подписан договор резервирования или купли-продажи, защита по этой покупке больше не истекает.",
      "4.5 Защита распространяется на каждый объект, который клиент резервирует через нас в период защиты.",
      "4.6 Статусы, даты и суммы в партнёрском портале являются учётом сотрудничества. Партнёр может заявить возражения в течение 14 дней с момента, когда изменение стало видно.",
    ] },
    { heading: "5. Комиссия", clauses: [
      "5.1 Партнёр имеет право на комиссию, если защищённый клиент в период защиты подписывает договор резервирования или купли-продажи объекта, который продаёт Cyprus VIP Estates, и застройщик выплачивает нам комиссию за эту продажу.",
      "5.2 Комиссия составляет долю от чистой комиссии (без НДС), которую Cyprus VIP Estates фактически получает от застройщика за эту продажу. Начальные доли: 30% при Handover и 50% при Fix.",
      "5.3 Доли растут вместе с партнёрскими уровнями, указанными в портале. На дату этой версии действуют: Silver 30% (Handover) / 50% (Fix); Gold 35% / 55% от 3 закрытых сделок за 12 месяцев; Platinum 40% / 60% от 6 закрытых сделок за 12 месяцев. Изменение уровня мы подтверждаем в портале; уровни автоматически не понижаются. Доли, индивидуально согласованные в письменной форме, имеют приоритет. Для продажи применяется доля, действующая для Партнёра на момент регистрации сделки.",
      "5.4 Ожидаемые суммы и калькулятор комиссии в портале являются оценкой и не создают права требования.",
      "5.5 Комиссия рассчитывается и выплачивается в евро. Расходы, например на поездки, не возмещаются, если это не согласовано заранее в письменной форме.",
    ] },
    { heading: "6. Оплата, кредит-ноты и НДС", clauses: [
      "6.1 Комиссия подлежит выплате только после того, как Cyprus VIP Estates полностью получит свою комиссию от застройщика. Обычно застройщики платят, когда покупатель оплатил 40–50% цены.",
      "6.2 Мы уведомляем Партнёра в течение двух (2) рабочих дней после получения оплаты от застройщика — в портале и по электронной почте или в Telegram.",
      "6.3 Партнёр соглашается на самофактурирование: Cyprus VIP Estates выставляет за каждую выплату кредит-ноту от имени Партнёра с номером CVE-GS-год-номер, доступную в портале. Партнёр не выставляет собственный счёт за ту же комиссию и может заявить об ошибках в кредит-ноте в течение 14 дней после её появления.",
      "6.4 Мы переводим комиссию на банковский счёт, указанный в профиле Партнёра, в течение семи (7) дней после получения нашей комиссии от застройщика.",
      "6.5 НДС: для Партнёра, зарегистрированного плательщиком НДС в другом государстве — члене ЕС, применяется механизм обратного начисления, кипрский НДС не начисляется. Для Партнёра, зарегистрированного плательщиком НДС на Кипре, добавляется кипрский НДС по действующей ставке (сейчас 19%). Во всех остальных случаях НДС не указывается. Партнёр отвечает за собственный подоходный налог и социальные взносы, а также за правильность своих данных по НДС.",
      "6.6 В целях безопасности выплаты приостанавливаются на семь (7) дней после смены банковского счёта. Партнёр получает письмо с подтверждением изменения.",
      "6.7 Если продажа отменена и застройщик требует вернуть или уменьшает нашу комиссию, комиссия Партнёра уменьшается в той же пропорции. Партнёр возвращает уже полученные суммы в течение 30 дней после нашего запроса; мы вправе зачесть их в счёт будущих выплат.",
    ] },
    { heading: "7. Правила поведения", clauses: [
      "7.1 Клиенты должны приходить из собственных реальных связей Партнёра. Запрещены генераторы лидов, купленные или арендованные базы контактов и непрошеные массовые рассылки.",
      "7.2 Партнёр не обещает цены, скидки, доходность, наличие объектов, сроки завершения строительства или правовые, налоговые и миграционные результаты. Такие вопросы он передаёт нашей команде.",
      "7.3 Партнёр выступает как независимый партнёр, знакомящий клиента с Cyprus VIP Estates, и не выдаёт наше название или бренд за свои. Реклама с использованием нашего названия или логотипа требует нашего предварительного письменного согласия.",
      "7.4 Партнёр не публикует наши объявления, фотографии, планировки или цены на порталах, торговых площадках или в собственной рекламе. Презентации, созданные в портале, можно отправлять клиенту, для которого они подготовлены.",
      "7.5 Права по соглашению являются личными. Партнёр не вправе привлекать субпартнёров или делить комиссию с третьими лицами за рекомендации.",
      "7.6 Ни одна из сторон не действует в обход другой: Партнёр не обращается напрямую к застройщикам, которых мы представили, в отношении клиентов по этому соглашению, а Cyprus VIP Estates не обходит Партнёра в отношении защищённого клиента.",
    ] },
    { heading: "8. Информация и материалы", clauses: [
      "8.1 Через партнёрский портал мы предоставляем информацию о проектах, наличии, ценах, долях Партнёра, материалы и презентации. Эта информация поступает от застройщиков, может измениться в любое время и не гарантирует наличие объектов; приоритет имеют актуальные данные застройщика.",
      "8.2 Партнёр использует эту информацию только для консультирования своих клиентов и не передаёт её третьим лицам.",
      "8.3 С прекращением соглашения доступ к порталу прекращается. Партнёр удаляет все скачанные материалы и по запросу письменно подтверждает удаление.",
    ] },
    { heading: "9. Защита данных", clauses: [
      "9.1 Каждая сторона является самостоятельным контролёром по GDPR в отношении обрабатываемых ею персональных данных.",
      "9.2 Партнёр передаёт персональные данные клиента только с его согласия и сообщает клиенту, что Cyprus VIP Estates свяжется с ним и будет обрабатывать его данные в связи с покупкой.",
      "9.3 Мы обрабатываем данные Партнёра в соответствии с нашей политикой конфиденциальности. Банковские реквизиты хранятся в зашифрованном виде.",
    ] },
    { heading: "10. Конфиденциальность", clauses: [
      "10.1 Обе стороны сохраняют в тайне всю непубличную информацию, полученную в ходе сотрудничества, в частности ставки и условия комиссии, данные клиентов, цены и внутренние процессы. Это обязательство действует и после прекращения соглашения.",
    ] },
    { heading: "11. Ответственность", clauses: [
      "11.1 Партнёр несёт ответственность за нарушения соглашения и освобождает Cyprus VIP Estates от претензий третьих лиц, возникших из-за незаконной рекламы, отсутствия согласия клиента или обещаний в нарушение пункта 7.",
      "11.2 Cyprus VIP Estates не отвечает за исполнение обязательств застройщиками, завершение проектов или достоверность информации застройщиков. За исключением умысла или грубой неосторожности наша ответственность ограничена комиссией, причитающейся Партнёру по настоящему соглашению.",
    ] },
    { heading: "12. Срок действия и расторжение", clauses: [
      "12.1 Соглашение заключено на неопределённый срок. Каждая сторона может расторгнуть его с уведомлением за один (1) месяц до конца календарного месяца по электронной почте или через портал.",
      "12.2 Каждая сторона может расторгнуть соглашение немедленно по уважительной причине, в частности при нарушении пунктов 7, 9 или 10, ложных регистрационных данных или мошенничестве. Cyprus VIP Estates может заблокировать аккаунт партнёра на время проверки такого случая.",
      "12.3 Комиссия остаётся к выплате за покупки клиентов, которые были защищены на момент прекращения соглашения, если договор резервирования или купли-продажи подписан в их период защиты. Это не применяется, если мы расторгли соглашение по уважительной причине, связанной с этим клиентом.",
      "12.4 Пункты 6.7, 8.3, 9, 10 и 11 продолжают действовать после прекращения соглашения.",
    ] },
    { heading: "13. Изменения соглашения", clauses: [
      "13.1 Мы можем изменить соглашение на будущее и объявляем новую версию по электронной почте и в портале, как правило, не менее чем за 30 дней. Новая версия действует с момента её принятия Партнёром в портале; до этого Партнёр может пользоваться порталом только для того, чтобы прочитать и принять её. Партнёр, не согласный с изменениями, может расторгнуть соглашение по пункту 12.1. Изменения никогда не затрагивают комиссию по уже зарегистрированным сделкам.",
    ] },
    { heading: "14. Заключительные положения", clauses: [
      "14.1 Соглашение регулируется законодательством Республики Кипр. Споры рассматривают суды Республики Кипр.",
      "14.2 Обязательной является английская версия. Переводы в портале носят информационный характер.",
      "14.3 Изменения и дополнения требуют текстовой формы; достаточно электронного письма или сообщения в партнёрском портале.",
      "14.4 Если какое-либо положение недействительно, остальные сохраняют силу. Стороны заменяют недействительное положение действительным, наиболее близким к его цели.",
      "14.5 Соглашение заменяет прежние договорённости по тому же предмету, за исключением долей, индивидуально согласованных в письменной форме.",
    ] },
  ],
};

const TEXTS: Record<PartnerLocale, AgreementText> = { en, de, pl, ru };

export function agreementText(locale: PartnerLocale): AgreementText {
  return TEXTS[locale] ?? en;
}
