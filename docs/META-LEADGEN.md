# Meta Lead Ads → CRM + Telegram

Seit 2026-10-11. Jeder Lead aus einem Instant Form der Seite **Cyprus VIP Estates**
(Page ID `323749517499625`) landet im Lead Cockpit (Quelle `META_LEAD_AD`) und löst
eine Telegram-Nachricht aus. Zwei Wege, beide idempotent über die Meta `leadgen_id`:

| Weg | Route | Wann |
|---|---|---|
| Webhook (Hauptweg) | `POST /api/webhooks/meta-leadgen` | Sekunden nach dem Absenden |
| Poller (Sicherheitsnetz) | `GET /api/cron/meta-leadgen-poll?key=$CRON_SECRET` | alle 15 min, letzte 48 h |

Code: `src/lib/metaLeadgen/` (Mapping, Graph-Client, Verarbeitung, Telegram-Texte,
Watchdog). Tabelle `meta_leadgen_events`: eine Zeile pro `leadgen_id`
(`PROCESSING` → `DONE` / `FAILED`). Tests: `src/lib/__tests__/metaLeadgen.test.ts`.

---

## 0. ENV-Variablen (Werte nie ins Repo)

Auf dem VPS in **`/var/www/shared/.env`**, danach `pm2 reload` (bzw. der nächste Deploy):

| Variable | Woher | Schritt |
|---|---|---|
| `META_APP_SECRET` | App-Dashboard → App-Einstellungen → Allgemeines → App-Geheimcode | 2 |
| `META_WEBHOOK_VERIFY_TOKEN` | **frei gewählt** (z. B. 32 zufällige Zeichen: `openssl rand -hex 16`) | 3 |
| `META_PAGE_ACCESS_TOKEN` | dauerhafter Page-Token des System-Users | 5 |
| `META_PAGE_ID` | `323749517499625` | – |
| `META_GRAPH_API_VERSION` | optional, Standard `v23.0` | – |

Bereits vorhanden und mitbenutzt: `CRON_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`,
die SMTP-Variablen (Fehler-E-Mails), `NEXT_PUBLIC_SITE_URL` (Admin-Link).
Nur im Testbed: `NOTIFY_PREFIX="[TEST]"`.

**Crontab** (VPS, `crontab -e`):

Installiert am 2026-10-11 (gleiches Format wie die übrigen Einträge; die App lauscht auf Port 3000):

```
1,16,31,46 * * * * SECRET=$(grep "^CRON_SECRET=" /var/www/cyprusvipestates/.env | cut -d= -f2); curl -s -m 290 "http://127.0.0.1:3000/api/cron/meta-leadgen-poll?key=$SECRET" >> /var/log/meta-leadgen-poll-prod.log 2>&1
```

Reihenfolge: **erst deployen und die ENV-Variablen setzen, dann Schritt 3** —
Meta ruft die Callback-URL beim Speichern sofort auf und braucht die Antwort.

---

## 1. Meta-App anlegen (oder vorhandene nutzen)

1. <https://developers.facebook.com/apps> → **App erstellen**.
2. Anwendungsfall: **„Andere“** → App-Typ **„Business“**.
3. Name z. B. `CVE Lead Sync`, Kontakt-E-Mail, **Business-Portfolio: das Portfolio, dem
   die Seite „Cyprus VIP Estates“ gehört** (wichtig — sonst kann der System-User die App
   später nicht nutzen).
4. Gibt es schon eine Business-App in diesem Portfolio, kann die genutzt werden.

## 2. App-Grundeinstellungen

App-Dashboard → **App-Einstellungen → Allgemeines**:

1. **App-Geheimcode** → „Anzeigen“ → als `META_APP_SECRET` eintragen.
2. **Datenschutzrichtlinien-URL**: `https://cyprusvipestates.com/privacy-policy`, **App-Domain**: `cyprusvipestates.com`,
   Kategorie wählen. Ohne Datenschutz-URL lässt sich die App nicht auf Live schalten.
3. Speichern.

## 3. Produkt „Webhooks“ hinzufügen, Seite abonnieren

1. Linke Leiste → **Produkte hinzufügen** → **Webhooks** → „Einrichten“.
2. Dropdown oben: **„Page“** (Seite) auswählen → **„Dieses Objekt abonnieren“**.
3. **Callback-URL:** `https://cyprusvipestates.com/api/webhooks/meta-leadgen`
4. **Verifizierungstoken:** exakt der Wert von `META_WEBHOOK_VERIFY_TOKEN`.
5. **„Bestätigen und speichern“**. Schlägt das fehl: ENV noch nicht gesetzt / Deploy
   fehlt (Test: `curl "https://cyprusvipestates.com/api/webhooks/meta-leadgen?hub.mode=subscribe&hub.verify_token=<TOKEN>&hub.challenge=42"`
   muss `42` liefern).
6. In der Feldliste der Page **`leadgen`** suchen → **„Abonnieren“**.

## 4. Berechtigungen der App

App-Dashboard → **App-Review → Berechtigungen und Funktionen** (bzw. „Anwendungsfälle →
Anpassen“). Für eigene Assets im selben Business-Portfolio reicht **Standardzugriff** —
kein App-Review nötig. Sicherstellen, dass diese Berechtigungen hinzugefügt sind:

- `leads_retrieval`
- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_metadata` (für das Abo `subscribed_apps`)
- `pages_manage_ads` und `ads_management` — nur falls die Graph API beim Lead-Abruf einen
  Berechtigungsfehler (#10 / #200) meldet; sie schaden aber nicht.

## 5. System-User mit dauerhaftem Page Access Token

1. <https://business.facebook.com/settings> → **Nutzer → Systemnutzer** → **Hinzufügen**,
   Name z. B. `cve-lead-sync`, Rolle **Admin**.
2. Beim System-User **„Assets zuweisen“**:
   - **Seiten** → „Cyprus VIP Estates“ → Vollzugriff (mindestens „Leads“ /
     „Werbeanzeigen“ und „Inhalte“).
   - **Apps** → die App aus Schritt 1 → Vollzugriff.
3. **„Neuen Token generieren“** → App aus Schritt 1 → **Ablauf: „Nie“** → die
   Berechtigungen aus Schritt 4 anhaken → Token kopieren (= System-User-Token).
4. Daraus den **Page-Token** holen (er ist ebenfalls unbefristet):

   ```bash
   curl -s "https://graph.facebook.com/v23.0/me/accounts?fields=id,name,access_token&access_token=<SYSTEM_USER_TOKEN>"
   ```

   Den `access_token` beim Eintrag `323749517499625` als **`META_PAGE_ACCESS_TOKEN`**
   eintragen. Prüfen (soll Name und ID der Seite zeigen):

   ```bash
   curl -s "https://graph.facebook.com/v23.0/323749517499625?fields=id,name&access_token=<PAGE_TOKEN>"
   ```

## 6. App für die Seite installieren (`subscribed_apps`)

Ohne diesen Schritt schickt Meta **keine** Webhooks, auch wenn Schritt 3 grün ist:

```bash
curl -s -X POST "https://graph.facebook.com/v23.0/323749517499625/subscribed_apps?subscribed_fields=leadgen&access_token=<PAGE_TOKEN>"
# → {"success":true}
curl -s "https://graph.facebook.com/v23.0/323749517499625/subscribed_apps?access_token=<PAGE_TOKEN>"
# → die App mit "subscribed_fields":["leadgen"]
```

## 7. Lead-Zugriffsverwaltung (Lead Access Manager)

Sonst liefert die Graph API zwar 200, aber keine bzw. verweigerte Leads.

1. <https://business.facebook.com/settings> → **Integrationen → Lead-Zugriff**
   (Leads Access).
2. Seite **„Cyprus VIP Estates“** wählen.
3. Reiter **„CRMs“** → **„CRMs zuweisen“** → die App aus Schritt 1 hinzufügen.
4. Reiter **„Personen“** → den System-User `cve-lead-sync` hinzufügen.

## 8. App auf „Live“ schalten

Oben im App-Dashboard: **App-Modus: Entwicklung → Live**.
**Im Entwicklungsmodus stellt Meta nur Leads aus dem Testing Tool zu, keine echten.**

## 9. Test mit dem Lead Ads Testing Tool

1. <https://developers.facebook.com/tools/lead-ads-testing>
2. Seite „Cyprus VIP Estates“, Formular „CVE PC Briefing EN v2“ → **„Lead erstellen“**
   (bestehende Test-Leads vorher dort löschen, sonst lehnt das Tool ab).
3. **„Status verfolgen“** → die App muss mit Antwortcode **200** erscheinen.
4. Innerhalb von Sekunden: Telegram-Nachricht „🏛 New Private Collection lead (UK)“ und
   ein Lead im Cockpit (Testdaten von Meta, z. B. `test@fb.com`). Danach diesen Test-Lead
   im CRM in den Papierkorb legen.

## 10. Einmaliger Nachhol-Lauf

Nach erfolgreichem Test die Leads der letzten 7 Tage nachholen (der normale Lauf schaut
nur 48 h zurück):

```bash
# auf dem VPS:
SECRET=$(grep "^CRON_SECRET=" /var/www/cyprusvipestates/.env | cut -d= -f2)
curl -s -m 290 "http://127.0.0.1:3000/api/cron/meta-leadgen-poll?key=$SECRET&sinceHours=168"
```

Bereits verarbeitete `leadgen_id`s werden übersprungen; eine schon vorhandene E-Mail
wird nicht als neuer Lead angelegt, sondern bekommt einen Timeline-Eintrag
„Meta lead form submitted“ (Telegram: „Existing lead submitted the form again“).

---

## Verhalten und Überwachung

- **Dublette:** normalisierte E-Mail (Gmail-aware, wie Email Inbound) eines nicht
  gelöschten Leads → kein neuer Lead, nur Timeline-Eintrag; Status/Quelle bleiben.
- **Fehler bei einem Lead** (Graph, Mapping, DB): sofort Telegram **und** E-Mail mit
  `leadgen_id` und Fehlertext, **einmal pro Lead**; der Poller versucht es alle 15 min
  erneut.
- **Token abgelaufen / Rechte fehlen** (Graph-Codes 190, 10, 200–299): eigene Meldung
  „Meta lead token invalid — leads are not being imported“, höchstens täglich wiederholt.
- **Telegram nicht erreichbar:** Der Lead ist trotzdem gespeichert; der Poller schickt
  die Nachricht nach (`telegramSentAt` leer = Nachricht noch offen).
- **Poller läuft nicht mehr:** `email-inbound` (alle 5 min) meldet nach 45 min ohne
  Lauf Telegram + E-Mail; umgekehrt prüft der Poller `email-inbound` (20 min).
  Fallen beide aus, bleibt der tägliche Action-Center-Digest.
- **ENV fehlt:** Poller schreibt `ok:false` ins Cron-Log (Action Center), aber keine
  Telegram-Meldung — erwartet zwischen Deploy und Einrichtung.
- Token erneuern: Schritt 5.3–5.4 wiederholen, `META_PAGE_ACCESS_TOKEN` ersetzen,
  `pm2 reload`, dann Schritt 10 (die verpassten Leads hält Meta 90 Tage vor).
