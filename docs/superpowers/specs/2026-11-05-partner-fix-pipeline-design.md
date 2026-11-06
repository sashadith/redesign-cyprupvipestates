# Partner-Pipeline für FIX-Kunden — Design

Stand 2026-11-05. Entscheidungen des Betreibers (Sascha) sind als **(entschieden)** markiert, Entscheidungen des Autors als **(Annahme)**.

## 1. Absicht

FIX bedeutet laut Partnervertrag: Der Partner bleibt Hauptansprechpartner des Kunden. Er führt die Erstberatung und bereitet die Besichtigungsreise vor. Heute hat er dafür im Portal kein Werkzeug. Er reicht den Kunden ein und sieht danach nur noch den Status, den wir setzen. Die eigentliche Arbeit findet außerhalb statt, und wir sehen nicht, ob sie passiert.

Ziel:

- Der Partner bekommt im Portal eine **eigene Pipeline für seine FIX-Kunden**, mit denselben Grundwerkzeugen, mit denen wir intern arbeiten.
- Sein **Manager** (der interne Betreuer am Partner, `Partner.managerUserId`) sieht diese Pipeline im CRM. So erkennt er, wo ein Kunde liegen bleibt, und kann den Partner unterstützen.
- Der Partner kann den Kunden **an den Manager übergeben**, typischerweise wenn die Besichtigung ansteht.

Erfolg heißt:

- Partner arbeiten FIX-Kunden sichtbar im Portal.
- Der Manager erkennt überfällige Kunden, ohne nachfragen zu müssen.
- Die Übergabe zur Besichtigung läuft ohne E-Mail-Pingpong.

Begriff: Es gibt keinen „Mentor“. Die Rolle heißt **Manager** **(entschieden)**.

## 2. Rollen und Rechte

| | Partner (Portal) | Manager (CRM) | Admin (CRM) |
|---|---|---|---|
| FIX-Kunden des Partners vor der Übergabe | bearbeitet | **nur lesen** + Hinweis an Partner schicken | wie Manager, für alle Partner |
| FIX-Kunden nach der Übergabe | nur lesen (Status wie heute) | bearbeitet wie jeden eigenen Lead | bearbeitet |
| Handover-Kunden | nur lesen (wie heute) | bearbeitet (wie heute) | bearbeitet |
| Kunden direkt kontaktieren (vor der Übergabe) | ja, außerhalb des Systems | **nein** | nein |

- Der Manager greift vor der Übergabe nie selbst ein. Er kann den Partner nur auf etwas hinweisen, z. B. „Wiedervorlage überfällig“ **(entschieden)**.
- Die Registrierung bleibt, wie sie ist: Partner registrieren sich selbst, und ein Admin schaltet sie frei **(entschieden)**.
- Bei der Freischaltung muss ein Manager gewählt werden. Vorbelegt ist die Person, die freischaltet **(Annahme)**. Ein Partner ohne Manager sieht die Pipeline trotzdem. Seine Kunden erscheinen dann bei allen Admins unter „ohne Manager“.

## 3. Die Pipeline des Partners (Portal)

### 3.1 Welche Kunden darin liegen

- Nur Kunden, die über eine **angenommene FIX-Einreichung** (`PartnerClaim` mode FIX, angenommen) zum Partner gehören.
- Liste und Detailseite für Handover-Kunden bleiben unverändert.
- Ein FIX-Kunde ist „beim Partner“, solange er nicht übergeben wurde. Dafür braucht der Lead ein Feld, das festhält, wer gerade arbeitet: Partner oder unser Team. **(Annahme: neues Feld, z. B. `Lead.partnerWorking` oder ein Enum `workedBy` PARTNER/STAFF. Name und Form wählt der Builder.)**

### 3.2 Stufen

- Dieselben Stufen wie intern: NEW → CONTACTED → COMMUNICATING → VIEWING_SCHEDULED → OFFER → RESERVED → CLOSED, dazu KEEP_CONTACT und LOST.
- **Der Partner kann seinen FIX-Kunden selbst bis zum Abschluss führen (entschieden)**, denn manche Kunden kaufen, ohne nach Zypern zu kommen. Eine Übergabe ist deshalb freiwillig und keine Pflichtstufe.
- **RESERVED und CLOSED durch den Partner (Annahme):**
  - Der Partner gibt Projekt, Einheit und Preis an.
  - Der Deal und die Provision entstehen wie intern (`commission.ts`), mit dem Satz aus `partnerMode`.
  - Der Manager bekommt sofort eine Nachricht und prüft den Deal.
  - Die Auszahlung läuft unverändert über den bestehenden Freigabeweg (`commissionStatus`). Eine Stufe des Partners löst keine Auszahlung aus.
- **LOST setzt der Partner selbst, mit Pflichtgrund (entschieden).** Es gelten dieselben Gründe wie intern.
- **Punkte bei Verlust (entschieden 2026-11-05):** Ein verlorener FIX-Kunde bringt dem Partner insgesamt **0 Punkte**.
  - Die Punkte, die er bei der Annahme der Einreichung für diesen Kunden bekommen hat, werden wieder abgezogen, und zwar bei jedem Verlustgrund, auch NO_RESPONSE.
  - Wer LOST setzt, ob Partner oder unser Team, spielt keine Rolle.
  - Für FIX-Kunden wird die Prüfung `REVOKING_LOST_REASONS` also zu „jeder Verlust“.
  - Bei Handover-Kunden bleibt die Regel unverändert: Nur INVALID und UNREACHABLE entziehen Punkte, NO_RESPONSE nicht (Entscheidung 2026-11-04).
  - **(Annahme)** Wird ein verlorener Kunde wieder aktiv, z. B. durch eine Antwort, die ihn von LOST auf CONTACTED setzt, bekommt der Partner die Punkte zurück. Der Builder prüft, ob `ratingStore.ts` (Vergabe filtert entzogene Claims, `revokePoints` löscht) das schon so macht, und ergänzt es, falls nicht.
- Die Ansicht ist ein Kanban mit einer Spalte pro Stufe, auf dem Handy als Liste mit Stufenfilter **(Annahme)**.

### 3.3 Werkzeuge am Kunden

(Die Stufenrechte stehen in 3.2; Abschnitt 11 hat Vorrang, wo er abweicht.)

Gleiche Instrumente wie intern, soweit sie ohne Versand auskommen:

- **Gespräch protokollieren:** Anruf mit Ergebnis (Nicht erreicht / Mailbox / Gesprochen / Falsche Nummer), Treffen, E-Mail oder WhatsApp „außerhalb gesendet“, Notiz.
  - Das ist nur ein Protokoll, es wird nichts verschickt.
  - Es gelten dieselben Regeln wie intern (`logRule.ts`), z. B. Pflichttext bei Notiz.
- **Wiedervorlage:**
  - Datum und Uhrzeit setzt der Partner selbst.
  - Dazu werden die Ortszeit des Kunden und die Ampel angezeigt (`leadLocalTime.ts`).
  - Ein manuell gesetztes Datum überschreibt das System nie.
- **Kundendaten bearbeiten:**
  - Name, Telefon, E-Mail, Land, Sprache, Budget, Zeitrahmen, Finanzierung, Wünsche.
  - Es gelten dieselben Prüfungen wie im Cockpit, einschließlich der Hinweise zu Festnetz, Budgetwährung und unklarer Zeitzone.
- **Personal Selection (Präsentation):**
  - Der Partner stellt Projekte zusammen, ändert die persönliche Notiz und erhält den Link.
  - Das baut auf den vorhandenen Partner-Präsentationen auf (`partnerPresentations.ts`, Branding).
  - Ein Button kopiert den Link, ein „WhatsApp öffnen“ mit vorausgefülltem Text auf dem Gerät des Partners ist erlaubt.
  - **Aussehen der Präsentation (entschieden):**
    - Oben steht das Logo des Partners, wie heute (`brandLogo`).
    - **Neu:** Im Footer stehen ein **Foto des Partners** und seine Kontaktdaten (`brandName`, `brandPhone`, `brandEmail`, `brandWebsite`).
    - Das Foto lädt der Partner im Profil hoch, gespeichert wie das Logo (`brandPhoto`, `brandPhotoType`, `brandPhotoUpdatedAt`).
    - Ohne Foto erscheint der Footer mit Initialen **(Annahme)**.
    - Das gilt für alle Partner-Präsentationen, auch Handover.
- **Verlauf:** Alles, was am Kunden passiert, steht in einer Zeitleiste: Einträge des Partners, Hinweise des Managers, Präsentation geöffnet, Stufenwechsel. Jeder Eintrag zeigt, wer ihn geschrieben hat.

**Kein automatischer Versand (entschieden).** Das System verschickt weder E-Mail noch WhatsApp im Namen des Partners an seinen Kunden. Präsentationslinks verschickt der Partner selbst.

**Keine MCP-/Claude-Werkzeuge für Partner** **(Annahme)**, auch keine KI-Entwürfe.

### 3.4 Erinnerungen an den Partner

- Ist eine Wiedervorlage fällig oder überfällig, erinnert das System den Partner über seinen gewählten Kanal (E-Mail oder Telegram).
- Die Erinnerung kommt einmal pro Tag und hält die Ruhezeiten ein **(Annahme)**.
- Sie wird über einen eigenen Schalter gesteuert oder hängt an `notifyReminders` **(Annahme: an `notifyReminders` hängen)**.

## 4. Übergabe an den Manager

### 4.1 Ablauf

1. Der Partner klickt am Kunden auf „An Manager übergeben“ und kann eine Notiz für den Manager mitgeben. Typischer Inhalt: Anreisedaten, Wünsche, was schon besprochen ist.
2. **Steht der Kunde auf „Besichtigung geplant“ (mit Termin) oder weiter:**
   - Die Übergabe geht direkt als Anfrage raus.
   - Die Provision bleibt beim FIX-Satz **(entschieden)**.
3. **Steht der Kunde davor:**
   - Der Partner sieht zuerst eine Warnung, sinngemäß: „Willst du den Kunden wirklich jetzt übergeben? Er ist noch nicht bei der Besichtigung. Nach der Bestätigung wird er von FIX auf Handover umgestellt, deine Provision sinkt von X % auf Y %.“
   - X und Y sind die echten Sätze des Partners.
   - Erst nach seiner Bestätigung geht die Anfrage raus **(entschieden)**.
4. **Der Manager nimmt die Anfrage an.**
   - Er bekommt sie per Telegram und sieht sie im CRM unter Heute/Inbox.
   - Mit der Annahme wechselt der Kunde zu unserem Team: `assignedTo` = Manager.
   - Bei einer frühen Übergabe wird `partnerMode` auf HANDOVER gesetzt.
5. **Der Manager kann bei der Annahme oder später einstellen, dass der Partner bei diesem Kunden trotzdem den FIX-Satz behält (entschieden).**
   - Technisch setzt das `partnerMode` zurück auf FIX.
   - Die Entscheidung steht im Verlauf, mit Name und Zeitpunkt.
   - Der Partner bekommt eine Nachricht.
   - Gesperrt ist die Einstellung, sobald für den Kunden ein Deal mit Provisionsdaten existiert, denn ab dann ist der Satz kopiert **(Annahme)**.
6. Nach der Annahme sieht der Partner den Kunden weiter in seiner Pipeline, als „übergeben“ markiert und nur lesend, mit dem Status, den wir setzen. So bleibt es wie heute bei Handover-Kunden.

### 4.2 Randfälle

- **Anfrage zurückziehen:** Der Partner kann eine offene Anfrage zurückziehen, solange der Manager sie nicht angenommen hat. Eine vorgemerkte Herabstufung fällt dann weg.
- **Manager reagiert nicht:** Nach 24 h bekommt der Manager eine Erinnerung, nach 48 h zusätzlich alle Admins **(Annahme)**.
- **Kein Manager:** Die Anfrage geht an alle Admins, und die erste Annahme zählt.
- **Herabstufung:** Sie wird erst mit der Annahme wirksam, nicht schon beim Klick des Partners **(Annahme)**.
- **Keine Rückgabe:** Ein übergebener Kunde geht nicht an den Partner zurück. Bei Bedarf schreibt der Manager ihm über die Partner-Nachrichten **(Annahme)**.
- **Schutzfrist:** Die Schutzfrist der FIX-Einreichung (`PROTECTION_ENDING`) läuft unverändert weiter.

## 5. Sicht des Managers (CRM)

- **Neue Ansicht „Partner-Pipelines“:**
  - Sie zeigt die FIX-Kunden, die gerade beim Partner liegen, standardmäßig nur die Partner dieses Managers, mit Filter nach Partner.
  - Admins sehen alle Partner.
  - Die Spalten sind dieselben Stufen wie oben.
- **Pro Kunde sieht der Manager:**
  - Stufe und wie lange der Kunde schon in ihr steht
  - Wiedervorlage, mit Markierung bei Überfälligkeit
  - letzter Eintrag des Partners und wie lange er her ist
  - Präsentation geöffnet: wann und wie oft
- **Ampel pro Kunde:**
  - grün: in Ordnung
  - gelb: Wiedervorlage seit 1 Tag überfällig, oder 7 Tage kein Eintrag
  - rot: 3 Tage überfällig, oder 14 Tage kein Eintrag
  - Die Schwellen sind Konfiguration **(Annahme)**.
- **„Hinweis an Partner“:**
  - Der Manager schreibt einen kurzen Text oder wählt eine Vorlage („Wiedervorlage überfällig“, „Kunde hat die Präsentation geöffnet, bitte anrufen“).
  - Technisch ist das eine `PartnerMessage` am Lead.
  - Sie geht über den gewählten Kanal an den Partner und erscheint in seinem Verlauf.
- **Grenzen der Manager-Sicht:**
  - Vor der Übergabe bearbeitet der Manager diese Kunden nicht. Es gibt keine Stufen-, Daten- oder Präsentationsänderung und keinen Versand an den Kunden.
  - In der Worklist und bei den Lead-Erinnerungen (Nags) erscheinen diese Kunden nicht als Aufgabe des Managers.
- **Wochenübersicht:** Montags bekommt der Manager eine Telegram-Zusammenfassung pro Partner, z. B. „3 überfällig, 1 übergeben, 2 neue“ **(Annahme)**.

## 6. Daten und Technik (Leitplanken)

- **Ein Lead, kein zweites Modell:** Der FIX-Kunde bleibt ein normaler `Lead` mit `partnerId` und `partnerMode`. Die Pipeline des Partners ist eine Sicht auf dieselben Leads.
- **Autoren:** Einträge des Partners brauchen einen Autor, der ein `PartnerUser` ist und kein `User`. Die Aktivitätstabelle bekommt dafür ein optionales `partnerUserId`, oder es gibt einen gleichwertigen Weg. Admin und Manager sehen immer, ob ein Eintrag vom Partner oder von uns stammt.
- **Übergabe-Anfrage:** Sie wird als eigener Datensatz gespeichert, mit Zustand offen, angenommen oder zurückgezogen, sowie Notiz, Stufe zum Zeitpunkt, `downgrade` ja/nein, wer, wann und Override ja/nein.
- **Zugriff:**
  - Jede Portal-Aktion prüft serverseitig, dass Lead und Partner zusammengehören und der Kunde noch beim Partner liegt (`scope.ts`).
  - Jede CRM-Aktion prüft die Rolle (`admin-server-actions-need-own-guard`).
- **Datenumfang für den Partner:** Der Partner sieht nur, was zu seinem eigenen Kunden gehört. Interne Notizen unseres Teams zu diesem Kunden bleiben ausgeblendet, auch nach der Übergabe. Ausnahme sind ausdrücklich geteilte Partner-Nachrichten.
- **Sprachen:**
  - Portaltexte gibt es in en/de/pl/ru, wie das Portal heute.
  - CRM-Texte sind Englisch.
  - Keine Ausrufezeichen in Texten an Partner.
- **Bestehendes Verhalten bleibt:**
  - Handover-Ablauf
  - Einreichung und Annahme von Claims
  - Provisionsberechnung (`partnerShareFor` über `partnerMode`)
  - Punkte
  - Schutzfrist
  - Partner-Benachrichtigungen
- **Keine Daten löschen:** Bestehende Leads werden nicht umgeschrieben, außer wie in Abschnitt 7 beschrieben.

## 7. Bestehende FIX-Kunden

Es gibt keine (geprüft in der Produktions-DB am 2026-11-05). Vorhanden ist nur ein Partner-Lead, „Katerin Test“ vom Testpartner „Sascha Test“, und der ist HANDOVER. Es braucht also keine Datenmigration. Das neue Feld bekommt einen Default, und neue angenommene FIX-Einreichungen liegen beim Partner.

**Kennt unser Team den Kunden schon (Annahme):** Reicht ein Partner einen FIX-Kunden ein, der bei uns bereits zugewiesen ist, bleibt der Kunde bei uns, und der Partner sieht ihn nur lesend. Das wird schon bei der Prüfung des Claims entschieden.

## 8. Nicht-Ziele

- kein automatischer E-Mail- oder WhatsApp-Versand an Kunden des Partners
- keine Claude-, MCP- oder KI-Werkzeuge für Partner
- keine Änderung an der Registrierung
- kein Bearbeiten durch den Manager vor der Übergabe
- keine Rückgabe übergebener Kunden an den Partner
- keine Team-Funktionen im Partnerbüro, also nicht mehrere Partner-Mitarbeiter mit eigenen Rechten

## 9. Anti-Ziele (wäre ein Fehlschlag, auch wenn es technisch funktioniert)

- Der Manager kontaktiert den Kunden des Partners an ihm vorbei, oder das System macht das möglich. Das zerstört das Vertrauen der Partner.
- Ein Partner verliert Provision, ohne es vorher klar gesehen zu haben.
- Der Partner sieht interne Notizen oder Daten anderer Kunden.

## 10. Dem Builder überlassen

- Feldnamen, Tabellen und Migrationen (additiv)
- genaues Layout von Kanban und Liste
- Aufteilung in PRs; Vorschlag: (1) Datenmodell und Portal-Pipeline, (2) Übergabe, (3) Manager-Sicht und Hinweise, (4) Partnerfoto im Präsentations-Footer
- ob vorhandene Cockpit-Komponenten wiederverwendet oder fürs Portal nachgebaut werden

## 11. Präzisierungen nach Builder-Check (Annahmen des Autors)

- **Stufen im Code:** Der Partner darf alle Stufen seines FIX-Kunden setzen (siehe 3.2). NO_RESPONSE ist ein `LostReason`, kein Status.
- **VIEWING_SCHEDULED** verlangt `Lead.viewingScheduledAt`, also das vorhandene Feld, wie intern.
- **`assignedTo`** bleibt null, solange der Kunde beim Partner liegt. Ein bestehender Wert bleibt stehen, wird aber ignoriert (siehe Abschnitt 7). Kunden, die beim Partner liegen, sind ausgenommen aus:
  - Worklist
  - Nags
  - Heute/Inbox-Aufgaben
  - unassigned-Erinnerungen
  - Follow-up-Kadenz
  - MCP `crm_worklist`

  Sichtbar bleiben sie für Admins und Manager weiterhin in Suche, Lead-Detail (nur lesen, Banner „Worked by partner X“) und der neuen Ansicht „Partner-Pipelines“.
- **Verlauf** = `LeadInteraction` (Cockpit-Zeitleiste):
  - Neues optionales Autorenfeld `createdByPartnerUserId`; der Name wird wie heute in `createdByName` gespeichert.
  - Partner-Einträge zählen für `lastRealContactAt` und die Ampel des Managers. Für die interne Kontakt-Statistik des Teams zählen sie nicht.
  - Hinweise des Managers sind `PartnerMessage` und erscheinen in beiden Zeitleisten.
- **`partnerMode` bleibt pro Lead die Quelle für die Provision.**
  - `PartnerClaim.mode` bleibt FIX, als Historie der Einreichung.
  - Die Schutzfrist und die Claim-Listen des Partners laufen unverändert über den Claim.
  - Die Kundenliste zeigt den aktuellen `partnerMode` am Lead.
- **Herabstufung und Override:**
  - Beides ist nicht möglich, sobald der Lead einen Deal hat.
  - Hat er schon einen Deal, z. B. von vor dem Claim, gibt es keine Herabstufung. Die Übergabe läuft dann ohne Satzänderung, und der Manager sieht einen Hinweis.
- **Personal Selection:**
  - Sie wird über die vorhandenen Partner-Präsentationen angelegt (`ClientPresentation.partnerId` gesetzt, `advisorId` null), mit Partner-Branding wie heute.
  - „Präsentation geöffnet“ nutzt die vorhandenen View-Events.
  - Nach der Übergabe bleiben bestehende Partner-Präsentationen aktiv. Neue Präsentationen erstellt dann unser Team.
- **Erinnerungen:**
  - Neue `PartnerNotification`-Art `FOLLOW_UP_DUE`, gesteuert über `notifyReminders`.
  - Es gelten die vorhandenen Telegram-Ruhezeiten.
  - Die Erinnerung kommt höchstens einmal pro Kunde und Tag.
- **Cron:** Erinnerungen an Partner, Eskalation offener Übergaben und die Wochenübersicht für Manager hängen an vorhandenen Cron-Läufen, außerhalb der Deploy-Ruhefenster.
